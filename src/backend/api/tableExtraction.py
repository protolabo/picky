import cv2
import numpy as np
import pytesseract

def resize_image(image, target_width=2000):
    # Calcul du ratio pour préserver les proportions
    height, width = image.shape[:2]
    aspect_ratio = width / height
    target_height = int(target_width / aspect_ratio)
    
    # Redimensionnement de l'image
    resized_image = cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_AREA)
    
    return resized_image

def image_to_2d_array(image):
    # Convertir l'image en niveaux de gris
    # La conversion en niveau de gris réduit l'image à une seule couche où chaque pixel est représenté par une seule valeur d'intensité allant de 0 (noir) à 255 (blanc)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Appliquer un seuillage adaptatif
    '''
    Pour chaque pixel, l'algorithme calcule un seuil en utilisant une moyenne pondérée gaussienne des pixels voisins 11x11
    Si la valeur du pixel est supérieure à ce seuil local, il devient noir (0), sinon il devient blanc (255) dans l'image résultante.
    L'inversion (THRESH_BINARY_INV) est souvent utilisée pour la préparation d'images pour l'OCR, car Tesseract fonctionne généralement mieux avec du texte blanc sur fond noir.
    '''
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    
    '''
    L'effet du dilatation est d'élargir les régions blanches et de combler les petits trous ou ruptures dans ces régions.
    Renforcement des lignes : Si les lignes du tableau sont fines ou discontinues, la dilatation les rend plus épaisses et continues.
    Fermeture des petits espaces : Les petits espaces entre les lignes sont comblés, ce qui aide à créer des contours fermés pour chaque cellule.
    '''
    kernel = np.ones((3,3), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    # Trouver tous les contours, y compris les contours internes
    contours, hierarchy = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    hierarchy = hierarchy[0]

    # Trouver le contour externe du tableau (le plus grand contour)
    main_contour = None
    max_area = 0
    main_idx = -1 # Index du contour principal
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
            if w > 10 and h > 10:  # Filtre minimal pour éviter le bruit
                cells.append((x, y, w, h))

    # Trier les cellules par position
    cells.sort(key=lambda c: (c[1], c[0]))

    # Déterminer les lignes en regroupant les cellules par coordonnée y similaire
    rows = []
    current_row = []
    last_y = cells[0][1]
    for cell in cells:
        if cell[1] > last_y + 20: # on passe à nouvelle ligne si la différence en y est significative (maintenant 20 est universel car on resize les images pourqu'elles soient de presque même taille)
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

# Charger l'image
image_path = 'test6.png'
image = cv2.imread(image_path)

resized_image = resize_image(image)

# Utilisation de la fonction
result = image_to_2d_array(resized_image)

# Affichage du résultat textuel
for row in result:
    print(row)