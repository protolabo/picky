# Projet IFT3150: Picky - Extracteur de données tabulaire

> **Page web du projet (IFT3150)**: https://protolabo.github.io/picky

# 📊 Picky – Extension Chrome pour l'extraction intelligente de tableaux

**Picky** est une extension Chrome conçue pour extraire, corriger et exporter des tableaux à partir d’images. Elle utilise un pipeline intelligent basé sur la vision par ordinateur pour convertir n’importe quelle représentation visuelle d’un tableau en données structurées éditables (CSV, JSON, XLSX, XML).

---

## 🔧 Fonctionnalités

### 📥 Import & Traitement
- Import d’images via glisser-déposer ou sélection de fichier
- Détection de la structure du tableau via **PyramidTabNet (IA)**
- Extraction du texte contenu dans chaque cellule avec **Tesseract OCR**
- Nettoyage des cellules détectées : fusion, alignement, insertion automatique

### ✏️ Édition interactive
- **Canvas HTML5** pour ajuster manuellement les zones de détection
  - Déplacement, redimensionnement, ajout, suppression de zones
- **Relance de l’analyse OCR** après ajustements
- **Tableau interactif (Handsontable)** :
  - Modification directe du texte
  - Ajout/suppression de lignes et colonnes
  - Fusion manuelle de cellules
  - Réinitialisation des données OCR

### 📤 Export
- Export aux formats : **CSV**, **JSON par ligne**, **JSON hiérarchique**, **XML**, **XLSX**
- Gestion des cellules fusionnées
- Aperçu en temps réel des fichiers d’export

---

## 🧱 Architecture technique

### 🖥 Frontend
- **Extension Chrome** (popup et mode plein écran)
- Canvas HTML5 pour l’affichage de l’image et des zones OCR
- **Handsontable** pour l’édition du tableau
- Technologies : HTML / CSS / JavaScript (vanilla)

### ⚙️ Backend
- **FastAPI** pour la communication avec l’extension
- **OpenCV** pour le traitement et l’alignement des cellules
- **Pytesseract** pour l’OCR
- **PyramidTabNet** pour la détection de la structure tabulaire à partir d’images


# 💻 Installation
- **intaller Miniconda 23.5.2** :
  - Intalations directe Windows :https://repo.anaconda.com/miniconda/Miniconda3-py39_23.5.2-0-Windows-x86_64.exe
  - Plus d'informattions pour macOS et Linux https://www.anaconda.com/docs/getting-started/miniconda/install#to-download-an-older-version
- **instaler le fichier weigths** :
  - telecharger le fichier le placer dans src/backend/pyramidtabnet :https://drive.google.com/drive/folders/1-3GvPcTpwnEqGLGNYWmf5YnaGoznmfGr
## Backend

```bash
# Set up environement 
conda env create -f environment_core.yml
conda activate pyramidtabnet
pip install -r post_install_pip.txt
pip uninstall mmcv mmcv-full -y
pip install mmcv-full==1.6.0 -f https://download.openmmlab.com/mmcv/dist/cu113/torch1.11/index.html




# Lancer le serveur
cd src/backend/api
python -m uvicorn main:app --reload

```
## Extension Chrome

1. Ouvrir Chrome et accéder à `chrome://extensions/`
2. Activer le mode développeur
3. Cliquer sur "Charger l'extension non empaquetée" et sélectionner le dossier `src/extension`

# 🌟 Contribution

Si vous êtes intéressé à participer au projet, veuillez prendre contact avec [Louis-Edouard LAFONTANT](mailto:louis.edouard.lafontant@umontreal.ca).

## Contributeurs

- Mehdi Lagnaoui [@MehdiLagnaoui](https://github.com/MehdiLagnaoui)
- Ismail Simo [@Ismail Simo](https://github.com/ismail220)
