import cv2
import numpy as np
import pytesseract
from pytesseract import Output

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
    contours, _ = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filtrer les contours pour ne garder que ceux qui ressemblent à des cellules
    cells = []
    for i, c in enumerate(contours):
        '''
        Le problème qu'on a est que notre code détecte le contours externe du tableau. Pour filtrer ce contours externe, j'ai 3 solutions:
        - skip le premier contours à l'index i=0 car il est le contour externe le plus grand. Elle fonctionne dans notre cas car avec RETR_TREE les contours sont organisés dans une hiérarchie parent-enfant basée sur leur imbrication dans l'image (Il se peut que cette méthode ne marche pas bien si on a  beaoucp de tableau imbriqué dans l'image)
        - faire un seuil des cases, par exemple 1000 < area < 5000. C'rest presque hardcoded car il se peut qu'on ait un tableau plus petit ou plus grand
        - trier les contours dans l'ordre croissant de leur area et supprimer le plus grand car dans ce cas on est sur qu'il est le conteur externe 
        '''
        if i == 0:
            continue
        area = cv2.contourArea(c)
        '''
        1000 pour test.png
        10000 pour test1.png
        '''
        if area > 10000:  # TODO: Trouver un seuil plus robuste (généraliser)
            x, y, w, h = cv2.boundingRect(c)
            cells.append((x, y, w, h))

    # Trier les cellules par leur position (d'abord par y, puis par x)
    cells.sort(key=lambda c: (c[1], c[0]))
    
    # Déterminer les lignes en regroupant les cellules par coordonnée y similaire
    rows = []
    current_row = []
    last_y = cells[0][1]
    for cell in cells:
        if cell[1] > last_y + 20:  # on passe à nouvelle ligne si la différence en y est significative
            rows.append(current_row)
            current_row = []
        current_row.append(cell)
        last_y = cell[1]
    rows.append(current_row)
    
    # Trier chaque ligne par coordonnée x
    for row in rows:
        row.sort(key=lambda c: c[0])
    
    # Extraire le texte de chaque cellule
    table_data = []
    for row in rows:
        row_data = []
        for cell in row:
            x, y, w, h = cell
            # Extraire l'image de la boite (region sur laquelle on fait l'extraction du texte)
            roi = image[y:y+h, x:x+w]
            # config='--psm 6' spécifie le mode de segmentation de page. Le mode 6 suppose qu'il y a un seul bloc de texte uniforme
            text = pytesseract.image_to_string(roi, config='--psm 6').strip()
            row_data.append(text)
        table_data.append(row_data)
    
    return table_data

# Charger l'image
image_path = '../utils/test1.png'
image = cv2.imread(image_path)

# Utilisation de la fonction
result = image_to_2d_array(image)

# Affichage du résultat
for row in result:
    print(row)