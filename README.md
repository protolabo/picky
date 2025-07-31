# Projet IFT3150: Picky - Extracteur de données tabulaire

> **Page web du projet (IFT3150)**: https://protolabo.github.io/picky

## Description du projet 

Picky est une extension de navigateur conçue pour extraire et manipuler des données tabulaires depuis des pages web. Elle permet de convertir des tableaux, qu'ils soient présents sur une page web ou dans des captures d'écran, en formats d'export communs (CSV, JSON).

## 📋 Fonctionnalités

- **Extraction de tableaux** : 
  - Capture directe depuis les pages web via html2canvas
  - Support des tableaux en format image
  - Upload manuel d'images de tableaux 
- **Traitement d'image** : 
  - Détection de tableaux dans les images
  - Extraction des données tabulaires
- **Modification des données** : 
  - Modification directe des cellules
  - Suppression de lignes et colonnes
  - Fusion de cellules horizontale
  - Interface d'édition en mode popup et plein écran
- **Exportation flexible** :
  - Format CSV avec support des cellules fusionnées
  - Format JSON structuré
  - Prévisualisation des exports en temps réel

- **Interface Conviviale** : Une interface facile à utiliser, permettant une gestion simple et efficace des tableaux extraits.

## 🌐 Infrastructure

**Frontend**: Extension Chrome (HTML, CSS, JavaScript)
**Backend**: Python avec FastAPI, PyTesseract, OpenCV

# 💻 Installation
- **intaller Miniconda 23.5.2** :
  - Intalations directe Windows :https://repo.anaconda.com/miniconda/Miniconda3-py39_23.5.2-0-Windows-x86_64.exe
  - Plus d'informattions pour macOS et Linux https://www.anaconda.com/docs/getting-started/miniconda/install#to-download-an-older-version
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
- Ismail Simo 
