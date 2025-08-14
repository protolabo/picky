import os
import subprocess
import cv2
import pytesseract
import xml.etree.ElementTree as ET
from collections import defaultdict

def extract_table_from_image(image_path):
    """
    Fonction principale qui extrait les données d'une table à partir d'une image
    @param image_path: Chemin de l'image à traiter
    @return: Liste 2D contenant les données du tableau

    Cette fonction coordonne tout le processus d'extraction:
    1. Génère une analyse structurelle via PyramidTabNet
    2. Traite le XML généré pour extraire les cellules
    3. Nettoie et optimise les zones de cellules
    4. Groupe les cellules en lignes
    5. Effectue l'OCR sur chaque cellule
    6. Retourne les données du tableau sous forme de liste 2D"""
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
    """
        Groupe les cellules en lignes selon leur position verticale
        @param cells: Liste des cellules (x, y, w, h)
        @param threshold: Seuil de distance verticale pour considérer deux cellules dans la même ligne
        @return: Liste de lignes, chaque ligne étant une liste de cellules

        Le processus:
        1. Trie les cellules par position y puis x
        2. Regroupe les cellules proches verticalement (selon threshold)
        3. Trie chaque ligne horizontalement
    """
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
        """
        Aligne verticalement les cellules d'une même ligne tout en évitant les collisions
        @param rows: Liste de lignes de cellules
        @return: Liste de lignes avec cellules alignées

        Pour chaque ligne:
        1. Détermine la zone verticale cible (min_y à max_y)
        2. Tente d'aligner chaque cellule
        3. Vérifie les collisions avec les autres lignes
        4. Conserve la position originale en cas de collision
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
        """
Extrait les coordonnées des cellules depuis le fichier XML
@param xml_path: Chemin du fichier XML à parser
@return: Liste de tuples (x, y, w, h) représentant les cellules

Processus:
1. Parse le XML avec ElementTree
2. Extrait les points de coordonnées de chaque cellule
3. Calcule les dimensions (x, y, w, h) à partir des points
"""
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
        """
        Étend les cellules sans créer de chevauchements significatifs
        @param cells: Liste des cellules à étendre
        @param image_shape: Dimensions de l'image
        @param w_ratio, h_ratio: Ratios d'extension en largeur et hauteur
        @param safety_margin: Marge de tolérance pour les chevauchements mineurs
        @return: Liste des cellules étendues

        Pour chaque cellule:
        1. Calcule l'extension désirée
        2. Vérifie les chevauchements avec les autres cellules
        3. Conserve la taille originale si chevauchement significatif
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



def detect_vertical_merges(rows):
        """
        Marque les cellules fusionnées verticalement à l’aide d’un balayage horizontal
        au centre de chaque ligne. Retourne un dict : cell_index -> nb de lignes traversées.
        """
        """
        Détecte les fusions verticales de cellules
        @param rows: Liste de lignes de cellules
        @return: Dictionnaire associant l'index de cellule au nombre de lignes traversées

        Méthode:
        1. Calcule le centre vertical de chaque ligne
        2. Pour chaque cellule, compte le nombre de lignes qu'elle traverse
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
        """
        Ajoute l'information de fusion aux cellules
        @param rows: Liste de lignes de cellules
        @return: Liste de lignes avec cellules annotées (cellule, nombre_lignes)

        Processus:
        1. Obtient les informations de fusion via detect_vertical_merges
        2. Annote chaque cellule avec son nombre de lignes
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
        Crée une grille complète avec cellules vides pour les fusions
        @param annotated_rows: Lignes avec informations de fusion
        @return: Grille 2D avec cellules vides aux positions fusionnées

        Pour chaque cellule:
        1. Place la cellule dans la grille
        2. Ajoute des cellules vides pour représenter la fusion verticale
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
        """
        Supprime les cellules qui se chevauchent trop
        @param cells: Liste des cellules
        @param iou_threshold: Seuil de chevauchement (IoU)
        @return: Liste de cellules sans chevauchements significatifs

        Processus:
        1. Trie les cellules par taille décroissante
        2. Calcule l'IoU entre les cellules
        3. Conserve uniquement les cellules avec IoU < seuil
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
        """
        Élargit les cellules trop étroites
        @param cells: Liste des cellules
        @param image_shape: Dimensions de l'image
        @param min_width: Largeur minimale désirée
        @return: Liste des cellules avec largeurs ajustées

        Pour chaque cellule:
        1. Vérifie si la largeur est inférieure au minimum
        2. Étend symétriquement si nécessaire
        3. Respecte les limites de l'image
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
        """
        Génère un nouveau fichier XML avec les coordonnées des cellules
        @param cells: Liste des cellules à écrire
        @param output_path: Chemin du fichier de sortie
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
        """
        Visualise les cellules détectées sur l'image
        @param image: Image source
        @param cells: Liste des cellules à dessiner
        @param output_path: Chemin de sauvegarde de l'image

        Dessine des rectangles rouges autour de chaque cellule
        """
        image_copy = image.copy()
        for cell in cells:
            if cell == '':
                continue
            x, y, w, h = cell
            cv2.rectangle(image_copy, (x, y), (x + w, y + h), (0, 0, 255), 2)  # rouge
        cv2.imwrite(output_path, image_copy)


def insert_missing_cells_from_overlap(rows):
    """
    Aligne les cellules d'une ligne en fonction de la ligne de référence
    @param rows: Liste de lignes de cellules
    
    @return: Liste de lignes avec cellules alignées

    Processus:
    1. Identifie la ligne de référence (celle avec le plus de cellules)
    2. Aligne les autres lignes en fonction des colonnes de la ligne de référence
    """
# Ligne avec le plus de cellules = structure de référence
    ref_row = max(rows, key=lambda r: len(r))
    col_spans = [(x, x + w) for (x, y, w, h) in ref_row]

    # TOLÉRANCE dynamique basée sur la largeur moyenne des cellules
    avg_width = sum(w for x, y, w, h in ref_row) / len(ref_row)
    tolerance = avg_width * 0.4  # ex. 40% = ± flexibilité d’alignement

    aligned = []
    for row in rows:
        new_row = []
        used = [False] * len(row)

        for col_start, col_end in col_spans:
            found = False

            for j, (x, y, w, h) in enumerate(row):
                if used[j]:
                    continue
                center = x + w / 2

                # Vérifie si le centre tombe dans la colonne de référence ± tolérance
                if (col_start - tolerance) <= center <= (col_end + tolerance):
                    new_row.append((x, y, w, h))
                    used[j] = True
                    found = True
                    break

            if not found:
                new_row.append('')  # Cellule manquante

        aligned.append(new_row)

    return aligned# Ligne avec le plus de cellules = structure de référence
  
   
def corrected_extract_text_from_cells(image, rows):
        """
        Extrait le texte de chaque cellule via OCR
        @param image: Image source
        @param rows: Liste de lignes de cellules
        @return: Liste 2D contenant le texte extrait

        Pour chaque cellule:
        1. Extrait la région d'intérêt (ROI)
        2. Prétraite l'image (binarisation)
        3. Applique l'OCR avec Tesseract
        4. Nettoie et stocke le texte extrait
        """
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