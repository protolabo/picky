from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
from ValidateImage import validate_table_image
from TableExtraction import image_to_2d_array

app = FastAPI()

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
        
        # Si l'image est valide, extraire les données
        table_data = image_to_2d_array(image)
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)