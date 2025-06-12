import os
import subprocess
import cv2
import pytesseract
import xml.etree.ElementTree as ET

# IMAGE À TRAITER
image_path = "test1.png"  # Change ici si besoin
image_name = os.path.splitext(os.path.basename(image_path))[0]

# Dossiers
SCRIPT_DIR = os.path.dirname(__file__)  # src/backend/api
PYRAMIDTABNET_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "pyramidtabnet"))
PYRAMID_OUTPUT_XML = os.path.join(PYRAMIDTABNET_DIR, "output", image_name, "table_structure.xml")
LOCAL_XML = os.path.join(SCRIPT_DIR, "table_structure.xml")

# Commande PyramidTabNet
PYRAMID_CMD = [
    "python", "model/tsr.py",
    "--config-file", "model/config/ptn.py",
    "--input", os.path.abspath(os.path.join(SCRIPT_DIR, image_path)),  # chemin absolu ici
    "--structure-weights", "weights/ptn_detection.pth",
    "--cell-weights", "weights/ptn_cells.pth",
    "--device", "cuda",
    "--save"
]

def remove_overlapping_cells(cells, overlap_threshold=0.5):
    """
    Supprime les cellules qui se recouvrent significativement.
    Conserve la plus grande en cas de collision.
    """
    cleaned = []
    for i, (x1, y1, w1, h1) in enumerate(cells):
        keep = True
        rect1 = (x1, y1, x1 + w1, y1 + h1)
        area1 = w1 * h1

        for j, (x2, y2, w2, h2) in enumerate(cells):
            if i == j:
                continue
            rect2 = (x2, y2, x2 + w2, y2 + h2)
            area2 = w2 * h2

            # Intersection
            inter_x1 = max(rect1[0], rect2[0])
            inter_y1 = max(rect1[1], rect2[1])
            inter_x2 = min(rect1[2], rect2[2])
            inter_y2 = min(rect1[3], rect2[3])
            inter_w = max(0, inter_x2 - inter_x1)
            inter_h = max(0, inter_y2 - inter_y1)
            inter_area = inter_w * inter_h

            # Si la zone d'intersection est significative
            if inter_area / min(area1, area2) > overlap_threshold:
                if area1 < area2:
                    keep = False
                    break  # Plus petit → on supprime

        if keep:
            cleaned.append((x1, y1, w1, h1))
    return cleaned

# Spécifie le binaire tesseract si besoin
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

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

def expand_cells(cells, image_shape, ratio=0.1):
    """
    Agrandit chaque cellule de `ratio` pour chaque côté.
    Par défaut, 10% sur chaque bord.
    """
    height, width = image_shape[:2]
    expanded = []

    for (x, y, w, h) in cells:
        dx = int(w * ratio)
        dy = int(h * ratio)

        new_x = max(x - dx, 0)
        new_y = max(y - dy, 0)
        new_w = min(x + w + dx, width) - new_x
        new_h = min(y + h + dy, height) - new_y

        expanded.append((new_x, new_y, new_w, new_h))

    return expanded

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

def draw_cells_on_image(image, cells, output_path="cells_visualisation.png"):
    """
    Dessine des rectangles rouges autour de chaque cellule.
    """
    image_copy = image.copy()
    for (x, y, w, h) in cells:
        cv2.rectangle(image_copy, (x, y), (x + w, y + h), (0, 0, 255), 2)  # rouge
    cv2.imwrite(output_path, image_copy)
    
def extract_text_from_cells(image, rows):
    table_data = []
    for row in rows:
        row_data = []
        for x, y, w, h in row:
            roi = image[y:y+h, x:x+w]
            gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            _, binary_roi = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            config = '--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.,:-()'
            text = pytesseract.image_to_string(binary_roi, config=config).strip()
            row_data.append(text)
        table_data.append(row_data)
    return table_data

if __name__ == "__main__":
    # 1. Générer le XML si nécessaire
    if not os.path.exists(PYRAMID_OUTPUT_XML):
        print(f"[INFO] Génération du XML pour {image_path} via PyramidTabNet...")
        try:
            os.chdir(PYRAMIDTABNET_DIR)
            subprocess.run(PYRAMID_CMD, check=True)
        except subprocess.CalledProcessError as e:
            print(f"[ERREUR] Échec PyramidTabNet : {e}")
            exit(1)
        finally:
            os.chdir(SCRIPT_DIR)  # revenir à api/

    # 2. Vérifie si le XML a bien été généré
    if not os.path.exists(PYRAMID_OUTPUT_XML):
        print("[ERREUR] Le fichier XML n'a pas été trouvé après la génération.")
        exit(1)

    # 3. Copier le XML localement
    with open(PYRAMID_OUTPUT_XML, "rb") as src, open(LOCAL_XML, "wb") as dst:
        dst.write(src.read())

    # 4. Charger l’image
    image = cv2.imread(image_path)
    if image is None:
        print(f"[ERREUR] Image introuvable : {image_path}")
        exit(1)

    # 5. Extraire et afficher les données
    cells = parse_cells_from_xml(LOCAL_XML)

# Nettoyage des doublons
    cells = remove_overlapping_cells(cells)
    cells = expand_cells(cells, image.shape, ratio=0.1)
# Visualisation des cellules
    draw_cells_on_image(image, cells, output_path=f"{image_name}_cells_visualised.png")
    rows = group_cells_by_rows(cells)
    table = extract_text_from_cells(image, rows)

    print(f"\n[OCR pour {image_path}]\n")
    for row in table:
        print(row)
