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

## Backend

```bash
# Installer les dépendances
pip install -r requirements.txt
cd src/backend/api
# Lancer le serveur
uvicorn main:app --reload
```

## Extension Chrome

1. Ouvrir Chrome et accéder à `chrome://extensions/`
2. Activer le mode développeur
3. Cliquer sur "Charger l'extension non empaquetée" et sélectionner le dossier `src/extension`

# 🌟 Contribution

Si vous êtes intéressé à participer au projet, veuillez prendre contact avec [Louis-Edouard LAFONTANT](mailto:louis.edouard.lafontant@umontreal.ca).

## Contributeurs

- Mehdi Lagnaoui [@MehdiLagnaoui](https://github.com/MehdiLagnaoui)
