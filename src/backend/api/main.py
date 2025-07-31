import uuid
from fastapi import FastAPI, Request, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from matplotlib import image
import numpy as np
import cv2
from ValidateImage import validate_table_image
from pyramid_ocr_from_xml import extract_table_from_image,corrected_extract_text_from_cells,group_cells_by_rows,align_cells_in_rows_no_collision,insert_missing_cells_from_overlap,corrected_draw_cells_on_image
import os 
from fastapi.staticfiles import StaticFiles
import shutil

app = FastAPI() 
app.mount("/static", StaticFiles(directory="."), name="static")
# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/extract-table")
async def extract_table(file: UploadFile):
    try:
        # Lire le contenu du fichier
        contents = await file.read()
        
        # Convertir les bytes en numpy array
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {
                "success": False,
                "message": "Impossible de lire l'image. Assurez-vous que le fichier est une image valide.",
                "data": None
            }

        # Valider l'image
        validation_result = validate_table_image(image)
        
        if not validation_result["valid"]:
            return {
                "success": False,
                "message": validation_result["commentaire"],
                "data": None
            }

        # Définir le nom de l'image temporaire
        temp_filename = "temp_image.png"

        # Sauvegarder la nouvelle image temporaire
        cv2.imwrite(temp_filename, image)
        # Chemin relatif vers pyramidtabnet/
        pyramid_path = os.path.join("..", "pyramidtabnet")
        dest_image_path = os.path.join(pyramid_path, temp_filename)
        output_temp_path = os.path.join(pyramid_path, "output", "temp_image")

        # Supprimer le fichier ou dossier 'output/temp_image' s'il existe
        if os.path.exists(output_temp_path):
            if os.path.isdir(output_temp_path):
                shutil.rmtree(output_temp_path)
            else:
                os.remove(output_temp_path)

        # Copier l'image vers pyramidtabnet/temp_image.png
        shutil.copy(temp_filename, dest_image_path)
                # Extraire les données de l'image temporaire
        table_data = extract_table_from_image(temp_filename)
        
        return {
            "success": True,
            "message": "Extraction réussie",
            "data": table_data
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Une erreur s'est produite lors du traitement : {str(e)}",
            "data": None
        }
    
@app.post("/reanalyze-ocr")
async def reanalyze_ocr(request: Request):
    try:
        data = await request.json()
        zones = data.get("zones", [])

        if not zones:
            return {"success": False, "message": "Aucune zone fournie."}

        image_path = "temp_image.png"
        if not os.path.exists(image_path):
            return {"success": False, "message": "Image d'origine non trouvée."}

        image = cv2.imread(image_path)
        if image is None:
            return {"success": False, "message": "Impossible de charger l'image."}
        
        img_h, img_w = image.shape[:2]

# Récupérer la taille affichée sur le canvas (envoyée par le frontend)
        canvas_width = data.get("canvas_width")
        canvas_height = data.get("canvas_height")

        if not canvas_width or not canvas_height:
            return {"success": False, "message": "Dimensions du canvas manquantes."}

        scale_x = img_w / canvas_width
        scale_y = img_h / canvas_height

        # Appliquer le scaling aux zones
        cells = [
            (
                int(z["x"] * scale_x),
                int(z["y"] * scale_y),
                int(( z["w"]) * scale_x),
                int((z["h"]) * scale_y)
            )
            for z in zones
        ]
        rows = group_cells_by_rows(cells)

        
        debug_image_path = "debug_zones.png"
        table = corrected_extract_text_from_cells(image, rows)
        corrected_draw_cells_on_image(image.copy(), [cell for row in rows for cell in row], output_path=debug_image_path)
        print("✅ Nouveau tableau extrait :", table)

        return {
            "success": True,
            "message": "OCR relancé avec les nouvelles zones.",
            "data": table
        }

    except Exception as e:
        print("❌ Erreur reanalyze_ocr :", e)
        return {"success": False, "message": str(e)}
    




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)