import cv2
import numpy as np

def validate_table_image(image, min_table_area_ratio = 0.5):
    # Prétraitement
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY_INV, 11, 2)

    kernel = np.ones((3,3), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    # Trouver les contours avec leur hiérarchie
    contours, hierarchy = cv2.findContours(dilated, cv2.RETR_TREE,
                                         cv2.CHAIN_APPROX_SIMPLE)

    # Si pas de contours ou pas de hiérarchie, l'image n'est pas valide
    if len(contours) == 0 or hierarchy is None:
        return {
            "valid": False,
            "commentaire": """
                Impossible de détecter un tableau dans l'image. Veuillez vous assurer que :
                  - L'image est nette et bien éclairée
                  - L'image contient un tableau
                  - Le tableau est centré dans l'image

                Vous pouvez réessayer en fournissant une nouvelle image ou capture d'écran répondant à ces critères.
            """
            }

    hierarchy = hierarchy[0]
    image_area = image.shape[0] * image.shape[1]

    # Trouver les contours externes (potentiels tableaux)
    nb_table_candidates = 0

    for i, contour in enumerate(contours):
        # Vérifier si c'est un contour externe
        if hierarchy[i][3] == -1:  # Pas de parent
            area = cv2.contourArea(contour)
            area_ratio = area / image_area

            # Compter les enfants directs (cellules potentielles)
            child_count = sum(1 for h in hierarchy if h[3] == i)

            if area_ratio > min_table_area_ratio and child_count > 0:
                nb_table_candidates += 1

    # Aucun tableau candidat -> too much noise ou tableau trop petit
    if nb_table_candidates == 0:
        return {
            "valid": False,
            "commentaire": """
                Impossible de détecter un tableau dans l'image. Veuillez vous assurer que :
                  - L'image est nette et bien éclairée
                  - L'image contient un tableau
                  - Le tableau est centré dans l'image

                Vous pouvez réessayer en fournissant une nouvelle image ou capture d'écran répondant à ces critères.
            """
            }
    # L'image contient plusieurs tableaux
    elif nb_table_candidates > 1:
        return {
            "valid": False,
            "commentaire": """
                Impossible de détecter un tableau dans l'image. Veuillez vous assurer que :
                  - L'image est nette et bien éclairée
                  - L'image contient un seul tableau
                  
                Vous pouvez réessayer en fournissant une nouvelle image ou capture d'écran répondant à ces critères.
            """
            }
    # Un seul tableau valide
    elif nb_table_candidates == 1:
        return {
            "valid": True,
            "commentaire": "L'image est accéptée."
            }

