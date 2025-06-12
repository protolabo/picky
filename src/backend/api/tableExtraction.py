import cv2
import numpy as np
import pytesseract

def get_optimal_resize_dimensions(image, target_area=4000000):
    """
    Calcule les dimensions optimales pour le redimensionnement
    en se basant sur l'aire de l'image plutôt qu'une largeur/hauteur fixe
    """
    height, width = image.shape[:2]
    current_area = height * width
    scale_factor = np.sqrt(target_area / current_area)

    new_width = int(width * scale_factor)
    new_height = int(height * scale_factor)

    return new_width, new_height

def get_seuils(image):
    """
    Calcule dynamiquement les seuils pour la détection des lignes
    et des cellules en fonction de la taille de l'image
    """
    height, width = image.shape[:2]

    # Seuil pour nouvelle ligne (environ 0.1% de la hauteur)
    seuil_nv_ligne = max(int(height * 0.001), 5)

    # Seuil minimum pour les cellules (environ 0.5% de la largeur/hauteur)
    min_cell_dim = max(int(min(width, height) * 0.005), 3)

    return seuil_nv_ligne, min_cell_dim

def image_to_2d_array(image):
    # Redimensionner avec les dimensions optimales
    new_width, new_height = get_optimal_resize_dimensions(image)
    resized_image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)

    # Convertir l'image en niveaux de gris
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Appliquer un seuillage adaptatif pour mieux séparer le texte
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

    # Dilater l'image pour connecter les lignes du tableau
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    # Trouver les contours avec leur hiérarchie
    contours, hierarchy = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    hierarchy = hierarchy[0]

    # Obtenir les seuils dynamiques
    seuil_nv_ligne, min_cell_dim = get_seuils(resized_image)

    # Trouver le plus grand contour, censé correspondre au tableau
    main_contour = None
    max_area = 0
    main_idx = -1
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area > max_area:
            max_area = area
            main_contour = contour
            main_idx = i

    # Extraire les cellules : enfants directs du contour principal
    cells = []
    for i, h in enumerate(hierarchy):
        if h[3] == main_idx:  # h[3] = parent
            x, y, w, h = cv2.boundingRect(contours[i])
            if w > min_cell_dim and h > min_cell_dim:
                cells.append((x, y, w, h))

    # Trier les cellules par ligne (y) puis par colonne (x)
    cells.sort(key=lambda c: (c[1], c[0]))

    # Grouper les cellules en lignes
    rows = []
    current_row = []
    last_y = cells[0][1]
    for cell in cells:
        if cell[1] > last_y + seuil_nv_ligne:
            rows.append(current_row)
            current_row = []
        current_row.append(cell)
        last_y = cell[1]
    rows.append(current_row)

    # Trier chaque ligne horizontalement
    for row in rows:
        row.sort(key=lambda c: c[0])

    # Extraire le texte de chaque cellule
    table_data = []
    for row_index, row in enumerate(rows):
        row_data = []
        for cell_index, cell in enumerate(row):
            x, y, w, h = cell

            # Appliquer le prétraitement uniquement pour les grandes cellules
            use_enhancement = w > 50 and h > 20
            if use_enhancement:
                # Ajouter un padding autour de la cellule
                pad = 5
                x1 = max(x - pad, 0)
                y1 = max(y - pad, 0)
                x2 = min(x + w + pad, image.shape[1])
                y2 = min(y + h + pad, image.shape[0])
                roi = image[y1:y2, x1:x2]

                # Redimensionner pour améliorer l'OCR
                roi = cv2.resize(roi, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

                # Passer en niveaux de gris
                gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

                # Appliquer un filtre de netteté
                kernel_sharpen = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
                sharpened = cv2.filter2D(gray_roi, -1, kernel_sharpen)

                # Binariser avec Otsu
                _, binary_roi = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            else:
                # Pas de prétraitement si cellule trop petite
                roi = image[y:y+h, x:x+w]
                gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                _, binary_roi = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # Définir la configuration OCR
            config = '--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.,:-()'

            # Première tentative de lecture
            
            # Première tentative d'OCR sur image en niveaux de gris
            text = pytesseract.image_to_string(gray_roi, config=config).strip()
            
            # Si vide, appliquer netteté + seuillage Otsu
            if not text:
                kernel_sharpen = np.array([[0, -1, 0], [-1, 5,-1], [0, -1, 0]])
                sharpened = cv2.filter2D(gray_roi, -1, kernel_sharpen)
                _, binary_roi = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                text = pytesseract.image_to_string(binary_roi, config=config).strip()
    
            # Si rien n'est lu, tenter un fallback plus simple
            if len(text) == 0:
                raw_roi = image[y:y+h, x:x+w]
                text = pytesseract.image_to_string(raw_roi, config=config).strip()

            row_data.append(text)
        table_data.append(row_data)

    # Normaliser le tableau (même nombre de colonnes par ligne)
    max_length = max(len(row) for row in table_data)
    normalized_table = [
        row + [''] * (max_length - len(row))
        for row in table_data
    ]

    return normalized_table

"""
TESTER LE SCRIPT DANS LE TERMINAL:
"""
# Charger l'image
image_path = 'test.png'
image = cv2.imread(image_path)

# Utilisation de la fonction
result = image_to_2d_array(image)

# Affichage du résultat textuel
for row in result:
    print(row)
