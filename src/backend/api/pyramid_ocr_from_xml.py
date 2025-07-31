import os
import subprocess
import cv2
import pytesseract
import xml.etree.ElementTree as ET
from collections import defaultdict

def extract_table_from_image(image_path):
    # IMAGE À TRAITER
    
    image_name = os.path.splitext(os.path.basename(image_path))[0]

    # Dossiers
    SCRIPT_DIR = os.path.dirname(__file__)  # src/backend/api
    PYRAMIDTABNET_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "pyramidtabnet"))
    PYRAMID_OUTPUT_XML = os.path.join(PYRAMIDTABNET_DIR, "output", image_name, "table_structure.xml")
    LOCAL_XML = os.path.join(SCRIPT_DIR, "table_structure.xml")

    # Commande PyramidTabNet
    import sys
    PYRAMID_CMD = [
        sys.executable,
        "model/tsr.py",
        "--config-file", "model/config/ptn.py",
        "--input", os.path.basename(image_path),  # rempli dynamiquement
        "--structure-weights", "weights/ptn_detection.pth",
        "--cell-weights", "weights/ptn_cells.pth",
        "--device", "cuda",
        "--save" 
    ]

# Spécifie le binaire tesseract si besoin
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


    if not os.path.exists(PYRAMID_OUTPUT_XML):

        # 1. Copier automatiquement l'image dans pyramidtabnet si elle n'existe pas
        PYRAMID_IMAGE_PATH = os.path.join(PYRAMIDTABNET_DIR, os.path.basename(image_path))
        if not os.path.exists(PYRAMID_IMAGE_PATH):
            print(f"[INFO] Copie de l'image vers pyramidtabnet : {PYRAMID_IMAGE_PATH}")
            from shutil import copyfile
            copyfile(os.path.join(SCRIPT_DIR, image_path), PYRAMID_IMAGE_PATH)
            
        # 2. Générer le XML avec PyramidTabNet
        print(f"[INFO] Génération du XML pour {image_path} via PyramidTabNet...")
        try:
            os.chdir(PYRAMIDTABNET_DIR)
            subprocess.run(PYRAMID_CMD, check=True)
            
        except subprocess.CalledProcessError as e:
            print(f"[ERREUR] Échec PyramidTabNet : {e}")
            return None
            
        finally:
            os.chdir(SCRIPT_DIR)  # revenir à api/

        # 2. Vérifie si le XML a bien été généré
        if not os.path.exists(PYRAMID_OUTPUT_XML):
            print("[ERREUR] Le fichier XML n'a pas été trouvé après la génération.")
            return None

        # 3. Copier le XML localement
        with open(PYRAMID_OUTPUT_XML, "rb") as src, open(LOCAL_XML, "wb") as dst:
            dst.write(src.read())

        # 4. Charger l’image
        
    image = cv2.imread(os.path.join(PYRAMIDTABNET_DIR, os.path.basename(image_path)))

    if image is None:
        print(f"[ERREUR] Image introuvable : {image_path}")
        return None
    # Étape 1 : Nettoyage des cellules brutes
    cells = parse_cells_from_xml(LOCAL_XML)
    cells = remove_overlapping_cells(cells)
    cells = expand_cells_without_overlap(cells, image.shape, w_ratio=0.15, h_ratio=0.3)
    cells = expand_narrow_cells_fixed_threshold(cells, image.shape, min_width=10)


    # Étape 2 : Grouper en lignes
    rows = group_cells_by_rows(cells)

    # Étape 3 : Aligner chaque ligne verticalement sans collision
    rows = align_cells_in_rows_no_collision(rows)

    # Étape 4 : Compléter les cellules manquantes avec '' en se basant sur les recouvrements
    rows = insert_missing_cells_from_overlap(rows)

    # Étape 5 : Visualiser les cellules alignées
    flattened_cells = [cell for row in rows for cell in row if cell != '']
    
    corrected_draw_cells_on_image(image, flattened_cells, output_path=f"{image_name}_cells_visualised.png")
    table = corrected_extract_text_from_cells(image, rows)

    return table

def group_cells_by_rows(cells, threshold=15):
        cells = sorted(cells, key=lambda c: (c[1], c[0]))
        rows = []
        current_row = []
        last_y = None

        for cell in cells:
            x, y, w, h = cell
            if last_y is None or abs(y - last_y) > threshold:
                if current_row:
                    rows.append(current_row)
                current_row = [cell]
                last_y = y
            else:
                current_row.append(cell)
        
        if current_row:
            rows.append(current_row)

        for row in rows:
            row.sort(key=lambda c: c[0])

        return rows
def align_cells_in_rows_no_collision(rows):
        """
        Aligne les cellules dans une ligne à la même hauteur,
        uniquement si cela ne provoque pas de collision avec les cellules d'autres lignes.
        """
        aligned_rows = []
        for row_idx, row in enumerate(rows):
            if not row:
                continue

            # Déterminer la zone cible (min y, max y) de la ligne
            min_y = min(y for (_, y, _, _) in row)
            max_y = max(y + h for (_, y, _, h) in row)

            new_row = []
            for col_idx, (x, y, w, h) in enumerate(row):
                new_y = min_y
                new_h = max_y - min_y

                # Vérifier collisions avec les lignes précédentes et suivantes
                has_collision = False
                for other_row in rows[:row_idx] + rows[row_idx + 1:]:
                    for (ox, oy, ow, oh) in other_row:
                        if x < ox + ow and x + w > ox:  # chevauchement horizontal
                            if new_y < oy + oh and new_y + new_h > oy:  # chevauchement vertical
                                has_collision = True
                                break
                    if has_collision:
                        break

                # Si collision détectée, garder la hauteur d’origine
                if has_collision:
                    new_row.append((x, y, w, h))
                else:
                    new_row.append((x, new_y, w, new_h))

            aligned_rows.append(new_row)

        return aligned_rows

def parse_cells_from_xml(xml_path):
        tree = ET.parse(xml_path)
        root = tree.getroot()
        cells = []
        
        for cell in root.findall(".//cell"):
            coords_str = cell.find("Coords").attrib["points"]
            points = [tuple(map(int, pt.split(','))) for pt in coords_str.strip().split()]
            xs = [pt[0] for pt in points]
            ys = [pt[1] for pt in points]
            x_min, y_min, x_max, y_max = min(xs), min(ys), max(xs), max(ys)
            cells.append((x_min, y_min, x_max - x_min, y_max - y_min))
        
        return cells

def expand_cells_without_overlap(cells, image_shape, w_ratio=0.05, h_ratio=0.3, safety_margin=2):
        """
        Agrandit chaque cellule en évitant tout chevauchement significatif.
        Si un chevauchement mineur est détecté (moins de safety_margin), on autorise.
        """
        height, width = image_shape[:2]
        expanded_cells = []

        for i, (x, y, w, h) in enumerate(cells):
            dx = int(w * w_ratio)
            dy = int(h * h_ratio)

            new_x = max(x - dx, 0)
            new_y = max(y - dy, 0)
            new_w = min(x + w + dx, width) - new_x
            new_h = min(y + h + dy, height) - new_y
            new_box = (new_x, new_y, new_w, new_h)

            intersects = False
            for j, (ox, oy, ow, oh) in enumerate(cells):
                if i == j:
                    continue

                # Intersection
                ix1 = max(new_x, ox)
                iy1 = max(new_y, oy)
                ix2 = min(new_x + new_w, ox + ow)
                iy2 = min(new_y + new_h, oy + oh)
                iw = max(0, ix2 - ix1)
                ih = max(0, iy2 - iy1)
                inter_area = iw * ih

                # Si intersection non négligeable (hors bord)
                if inter_area > safety_margin * safety_margin:
                    intersects = True
                    break

            if intersects:
                expanded_cells.append((x, y, w, h))  # on garde la boîte originale
            else:
                expanded_cells.append(new_box)

        return expanded_cells


def align_cells_in_rows_no_collision(rows):
        """
        Aligne les cellules dans une ligne à la même hauteur,
        uniquement si cela ne provoque pas de collision avec les cellules d'autres lignes.
        """
        aligned_rows = []
        for row_idx, row in enumerate(rows):
            if not row:
                continue

            # Déterminer la zone cible (min y, max y) de la ligne
            min_y = min(y for (_, y, _, _) in row)
            max_y = max(y + h for (_, y, _, h) in row)

            new_row = []
            for col_idx, (x, y, w, h) in enumerate(row):
                new_y = min_y
                new_h = max_y - min_y

                # Vérifier collisions avec les lignes précédentes et suivantes
                has_collision = False
                for other_row in rows[:row_idx] + rows[row_idx + 1:]:
                    for (ox, oy, ow, oh) in other_row:
                        if x < ox + ow and x + w > ox:  # chevauchement horizontal
                            if new_y < oy + oh and new_y + new_h > oy:  # chevauchement vertical
                                has_collision = True
                                break
                    if has_collision:
                        break

                # Si collision détectée, garder la hauteur d’origine
                if has_collision:
                    new_row.append((x, y, w, h))
                else:
                    new_row.append((x, new_y, w, new_h))

            aligned_rows.append(new_row)

        return aligned_rows

def detect_vertical_merges(rows):
        """
        Marque les cellules fusionnées verticalement à l’aide d’un balayage horizontal
        au centre de chaque ligne. Retourne un dict : cell_index -> nb de lignes traversées.
        """
        all_cells = [cell for row in rows for cell in row]
        row_y_centers = [
            (min(y for (_, y, _, _) in row) + max(y + h for (_, y, _, h) in row)) // 2
            for row in rows if row
        ]

        cell_crossings = defaultdict(int)
        for i, (x, y, w, h) in enumerate(all_cells):
            for line_y in row_y_centers:
                if y <= line_y <= y + h:
                    cell_crossings[i] += 1
        return cell_crossings

def annotate_cells_with_merge_info(rows):
        """
        Renvoie une version de `rows` où chaque cellule est annotée avec le nombre de lignes qu'elle couvre.
        """
        all_cells = [cell for row in rows for cell in row]
        crossings = detect_vertical_merges(rows)

        annotated = []
        i = 0
        for row in rows:
            new_row = []
            for _ in row:
                merge = crossings.get(i, 1)
                new_row.append((all_cells[i], merge))
                i += 1
            annotated.append(new_row)
        return annotated

def expand_annotated_table_to_grid(annotated_rows):
        """
        Reconstruit un tableau complet avec des '' vides pour refléter les fusions verticales.
        """
        max_cols = max(len(row) for row in annotated_rows)
        num_rows = len(annotated_rows)
        table_grid = [['' for _ in range(max_cols)] for _ in range(num_rows)]

        for row_idx, row in enumerate(annotated_rows):
            col_idx = 0
            for (cell, rowspan) in row:
                x, y, w, h = cell
                while col_idx < max_cols and table_grid[row_idx][col_idx] != '':
                    col_idx += 1
                for r in range(rowspan):
                    if row_idx + r < num_rows:
                        table_grid[row_idx + r][col_idx] = (cell if r == 0 else '')
                col_idx += 1

        return table_grid  


def remove_overlapping_cells(cells, iou_threshold=0.3):
        """
        Supprime les cellules qui se superposent trop fortement (basé sur IoU).
        On garde la plus grande en cas de conflit.
        """
        def iou(cell1, cell2):
            x1, y1, w1, h1 = cell1
            x2, y2, w2, h2 = cell2

            # Définir les rectangles
            xA = max(x1, x2)
            yA = max(y1, y2)
            xB = min(x1 + w1, x2 + w2)
            yB = min(y1 + h1, y2 + h2)

            interArea = max(0, xB - xA) * max(0, yB - yA)
            area1 = w1 * h1
            area2 = w2 * h2
            unionArea = area1 + area2 - interArea

            return interArea / unionArea if unionArea > 0 else 0

        # Supprimer les doublons en utilisant IoU
        filtered = []
        cells = sorted(cells, key=lambda c: c[2] * c[3], reverse=True)  # plus grande surface en premier

        for i, cell in enumerate(cells):
            keep = True
            for other in filtered:
                if iou(cell, other) > iou_threshold:
                    keep = False
                    break
            if keep:
                filtered.append(cell)

        return filtered

    
    
def expand_narrow_cells_fixed_threshold(cells, image_shape, min_width=10):
        """
        Élargit les cellules trop étroites (moins de min_width pixels).
        On étire de manière symétrique sans sortir de l'image.
        """
        height, width = image_shape[:2]
        expanded = []

        for (x, y, w, h) in cells:
            if w >= min_width:
                expanded.append((x, y, w, h))
                continue

            extra = (min_width - w) // 2
            new_x = max(x - extra, 0)
            new_w = min(x + w + extra, width) - new_x
            expanded.append((new_x, y, new_w, h))

        return expanded


        # 1. Générer le XML si nécessaire
    

def overwrite_table_structure_xml(cells, output_path="table_structure.xml"):
        """
        Écrit une nouvelle version du fichier XML avec les coordonnées fournies.
        Chaque cellule aura des indices de ligne/colonne égaux à son index.
        """
        root = ET.Element("document")

        for idx, (x, y, w, h) in enumerate(cells):
            cell_elem = ET.SubElement(root, "cell")
            cell_elem.set("start-col", str(idx))
            cell_elem.set("start-row", "0")
            cell_elem.set("end-col", str(idx))
            cell_elem.set("end-row", "0")

            coords = f"{x},{y} {x},{y+h} {x+w},{y+h} {x+w},{y}"
            coords_elem = ET.SubElement(cell_elem, "Coords")
            coords_elem.set("points", coords)

        tree = ET.ElementTree(root)
        tree.write(output_path, encoding="UTF-8", xml_declaration=True)

def corrected_draw_cells_on_image(image, cells, output_path="cells_visualisation.png"):
        image_copy = image.copy()
        for cell in cells:
            if cell == '':
                continue
            x, y, w, h = cell
            cv2.rectangle(image_copy, (x, y), (x + w, y + h), (0, 0, 255), 2)  # rouge
        cv2.imwrite(output_path, image_copy)

def corrected_draw_cells_on_image(image, cells, output_path="cells_visualisation.png"):
        image_copy = image.copy()
        for cell in cells:
            if cell == '':
                continue
            x, y, w, h = cell
            cv2.rectangle(image_copy, (x, y), (x + w, y + h), (0, 0, 255), 2)  # rouge
        cv2.imwrite(output_path, image_copy)

def insert_missing_cells_from_overlap(rows, tolerance=20):
        """
        Pour chaque ligne avec moins de colonnes que la ligne la plus complète,
        vérifie les cellules verticalement superposées dans les autres lignes,
        et ajoute des '' là où une cellule fusionnée manque.
        """
        max_cols = max(len(row) for row in rows)
        aligned = []

        # Obtenir les colonnes "x-spans" de la ligne la plus complète
        ref_row = max(rows, key=lambda r: len(r))
        col_spans = [(x, x + w) for (x, y, w, h) in ref_row]

        for row in rows:
            new_row = []
            used = [False] * len(row)

            # index de cellule en cours
            cell_idx = 0
            for col_start, col_end in col_spans:
                # Chercher une cellule existante qui chevauche cette colonne
                found = False
                for j, (x, y, w, h) in enumerate(row):
                    if used[j]:
                        continue
                    cx1, cx2 = x, x + w
                    if cx1 - tolerance <= col_start <= cx2 + tolerance or cx1 - tolerance <= col_end <= cx2 + tolerance:
                        new_row.append((x, y, w, h))
                        used[j] = True
                        found = True
                        break
                if not found:
                    new_row.append('')  # rien ne recouvre cet espace → cellule fusionnée absente

            aligned.append(new_row)

        return aligned
   
def corrected_extract_text_from_cells(image, rows):
        table_data = []
        for row in rows:
            row_data = []
            for cell in row:
                if cell == '':
                    row_data.append('')  # cellule vide
                    continue

                x, y, w, h = cell
                roi = image[y:y+h, x:x+w]
                gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                _, binary_roi = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                config = '--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.,:-()#%/+=_'
                text = pytesseract.image_to_string(binary_roi, config=config).strip()
                row_data.append(text)
            table_data.append(row_data)
        return table_data
#image_path= "123.png"   Change ici si besoin
#table = extract_table_from_image(image_path)   Change ici si besoin
# Affichage final
#print(f"\n[OCR pour {image_path}]\n")
#for row in table:
   # print(row)