import cv2
import numpy as np
import pytesseract

def get_optimal_resize_dimensions(image, target_area=4000000):
    """
    Calcule les dimensions optimales pour le redimensionnement
    en se basant sur l'aire de l'image plutôt qu'une largeur/ hauteur fixe
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
    area = height * width

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

    # Appliquer un flou gaussien pour réduire le bruit
    #blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Appliquer un seuillage adaptatif
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

    # Dilater l'image pour mieux connecter les lignes du tableau
    kernel = np.ones((3,3), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    # Trouver les contours avec leur hiérarchie
    contours, hierarchy = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    hierarchy = hierarchy[0]

    # Obtenir les seuils dynamiques
    seuil_nv_ligne, min_cell_dim = get_seuils(resized_image)

    # Trouver le contour externe du tableau (le plus grand contour)
    main_contour = None
    max_area = 0
    main_idx = -1

    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area > max_area:
            max_area = area
            main_contour = contour
            main_idx = i

    # Extraire les cellules (contours enfants directs du contour principal)
    cells = []
    for i, h in enumerate(hierarchy):
        # h[3] est l'index du parent
        if h[3] == main_idx:  # Si le parent est le contour principal
            x, y, w, h = cv2.boundingRect(contours[i])
            if w > min_cell_dim and h > min_cell_dim:  # Filtre minimal pour éviter le bruit
                cells.append((x, y, w, h))


    # Trier les cellules par position
    cells.sort(key=lambda c: (c[1], c[0]))

    # Déterminer les lignes en regroupant les cellules par coordonnée y similaire
    rows = []
    current_row = []
    last_y = cells[0][1]
    for cell in cells:
        if cell[1] > last_y + seuil_nv_ligne: # on passe à nouvelle ligne si la différence en y est significative (maintenant 20 est universel car on resize les images pourqu'elles soient de presque même taille)
            rows.append(current_row)
            current_row = []
        current_row.append(cell)
        last_y = cell[1]
    rows.append(current_row)

    # Trier chaque ligne par coordonnée x
    for row in rows:
        row.sort(key=lambda c: c[0])

    # Extraire le texte de chaque cellule et dessiner les rectangles
    table_data = []
    for row_index, row in enumerate(rows):
        row_data = []
        for cell_index, cell in enumerate(row):
            x, y, w, h = cell
            roi = image[y:y+h, x:x+w]
            text = pytesseract.image_to_string(roi, config='--psm 6').strip()
            row_data.append(text)

        table_data.append(row_data)

    return table_data


"""
TESTER LE SCRIPT DANS LE TERMINAL:

# Charger l'image
image_path = 'test.png'
image = cv2.imread(image_path)


# Utilisation de la fonction
result = image_to_2d_array(image)

# Affichage du résultat textuel
for row in result:
    print(row)
"""
