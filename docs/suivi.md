# Suivi de projet

## Semaine 1

??? note "To Do"
- Lister les outils potentiels avec leurs fonctionnalités et descriptions
- Rédiger les motivations du projet
- Réfléchir à des fonctionnalités centrées utilisateur (profil-type, persona)
- Tester le code initial

!!! info "Contenu réalisé"
- Rédaction complète des motivations initiales du projet Picky (voir section motivation)
- Liste d’outils envisagés et réflexion sur les fonctionnalités clés à développer pour les utilisateurs finaux
- Début de tests sur le code de base

!!! abstract "Prochaines étapes"
- Intégrer un système de détection plus robuste
- Étendre les cas d’usage avec une réflexion orientée utilisateur

---

## Semaine 2

??? note "To Do"
- Tester l’intégration de YOLO
- Mettre à jour les motivations et descriptions
- Tester des interactions utilisateur (manipulations, retours)

!!! info "Contenu réalisé"
- Problèmes identifiés avec la lecture de tableaux (ex : lignes mal lues, confusion de caractères comme "I" et "(")
- Implémentation de prétraitements améliorant l’OCR : padding, redimensionnement, filtrage, seuillage
- Création d’un fallback OCR en cas d’échec
- Révision des motivations (version 2), intégration des limites du système actuel et pistes d’amélioration (YOLO, prétraitement adaptatif)

!!! abstract "Prochaines étapes"
- Tester PyramidTabNet et explorer la détection basée sur YOLO
- Début de construction de jeux de données spécifiques pour l’apprentissage

---

## Semaine 3

??? note "To Do"
- Adapter le système à différents styles de tableaux : lignes pleines, tableaux en bandes
- Intégrer CascadeTabNet
- Tester la reconnaissance d’icônes avec YOLO
- Ajouter une option pour indiquer le type de données pour vérifier les erreurs
- Créer un dataset pour l'entraînement de YOLO
- Implémenter un retour visuel sur les colonnes (type de données)
- Tester la modification de cellules et le déplacement de colonnes

!!! info "Contenu réalisé"
- Mise en place de l’environnement conda pour faire fonctionner PyramidTabNet (dépendances spécifiques)
- Problèmes identifiés : cellules trop petites ou dupliquées
- Premiers correctifs : nettoyage des doublons et ajustements de dimension des cellules

!!! abstract "Prochaines étapes"
- Finaliser l’environnement pour CascadeTabNet
- Continuer l’amélioration du traitement XML et du flux OCR

---

## Semaine 4

??? note "To Do"
- Tester CascadeTabNet
- Ajuster les paramètres de détection pour améliorer la précision

!!! info "Contenu réalisé"
- Problèmes de compatibilité rencontrés avec CascadeTabNet (dépendances complexes)
- Abandon temporaire et adaptation du code pour rester sur PyramidTabNet
- Intégration de plusieurs nouvelles fonctions :
    - `remove_overlapping_cells()`: suppression des doublons par recouvrement
    - `expand_cells()`: agrandissement des boîtes pour éviter la coupe de texte
    - `draw_cells_on_image()`: visualisation graphique du découpage cellulaire
- Refonte du pipeline de traitement : XML → nettoyage → agrandissement → visualisation → OCR

!!! abstract "Prochaines étapes"
- Tester les exports en formats XLSX et image
- Commencer la gestion des retours utilisateur sur les découpages

## Semaine 5

??? note "To Do"
- Finaliser la relance OCR à partir des zones modifiées manuellement  
- Intégrer une prévisualisation du tableau OCR dans Handsontable  
- Gérer l’import d’images multiples (pipeline automatique)

!!! info "Contenu réalisé"
- Intégration du bouton de **relance OCR** après modification des zones  
- Synchronisation entre les zones du canvas et la mise à jour du tableau via FastAPI  
- Affichage conditionnel des erreurs si aucune cellule détectée  
- Prise en charge des chemins d’accès automatiques pour chaque image importée

!!! abstract "Prochaines étapes"
- Créer un système d’historique (undo/redo)  
- Ajouter la suppression/édition directe des zones sur le canvas

---

## Semaine 6

??? note "To Do"
- Ajouter des boutons pour manipuler le tableau (ajout/suppression ligne ou colonne)  
- Tester la fusion manuelle de cellules  
- Implémenter l’annulation (undo/redo)

!!! info "Contenu réalisé"
- Intégration de **Handsontable** pour afficher le tableau OCR  
- Ajout des boutons de **fusion**, **suppression**, **ajout de lignes/colonnes**  
- Structure normalisée du tableau avec "_" pour cellules fusionnées  
- Détection automatique des sélections valides pour la fusion

!!! abstract "Prochaines étapes"
- Préparer la structure d’export vers plusieurs formats  
- Améliorer le système d’édition (multi-ligne, raccourcis clavier)

---

## Semaine 7

??? note "To Do"
- Ajouter la prévisualisation des exports (CSV/JSON/XML)  
- Support du JSON hiérarchique  
- Ajouter un export XLSX

!!! info "Contenu réalisé"
- Ajout d’un module d’**export en temps réel**  
- Possibilité de **basculer entre JSON brut, JSON hiérarchique et XML**  
- Conversion dynamique depuis Handsontable vers CSV  
- Aperçu dans un bloc HTML `<pre>` avant téléchargement

!!! abstract "Prochaines étapes"
- Support complet du format XLSX via `xlsx.js`  
- Ajout d’un export image du canvas (visualisation finale)

---

## Semaine 8

??? note "To Do"
- Intégrer le format XLSX avec fusion supportée  
- Ajouter des feedbacks visuels sur les actions utilisateur  
- Créer un export image des cellules annotées

!!! info "Contenu réalisé"
- Export **XLSX** complet avec gestion de fusion  
- Export **image avec cellules visibles** grâce à `draw_cells_on_image()`  
- Ajout d’un système de **prévisualisation d’export** dans une fenêtre dédiée

!!! abstract "Prochaines étapes"
- Intégration de `html2canvas` pour la capture directe de tableau depuis la page web

---

## Semaine 9

??? note "To Do"
- Ajouter la capture de tableaux depuis les pages web  
- Tester l’injection dynamique du script de capture

!!! info "Contenu réalisé"
- Intégration complète de **html2canvas**  
- Création d’un **overlay de sélection** sur la page web  
- Capture de la zone sélectionnée et envoi direct vers le backend  
- Fermeture du popup temporairement lors de la sélection

!!! abstract "Prochaines étapes"
- Ajouter un système de feedback contextuel (aide sur l’interface)  
- Commencer à structurer le rapport final

---

## Semaine 10

??? note "To Do"
- Ajouter une icône d’aide/contextuelle sur l’interface  
- Préparer un système de sauvegarde temporaire des sessions

!!! info "Contenu réalisé"
- Intégration d’une **info-bulle** affichée au survol de Handsontable  
- Explication du **clic droit pour fusionner / supprimer / undo / redo**  
- Début de l’**écriture du rapport** (sections 1 à 4)

!!! abstract "Prochaines étapes"
- Finaliser les figures (diagramme de flux, architecture)  
- Organiser les captures pour illustrer les fonctionnalités

---

## Semaine 11

??? note "To Do"
- Ajouter une animation de chargement  
- Intégrer un sommaire cliquable dans le rapport PDF

!!! info "Contenu réalisé"
- Ajout d’un **système de chargement dynamique** (`#loading`)  
- Génération automatique du **sommaire PDF** à partir des titres de sections  
- Écriture de la section “Conception” avec détails sur le canvas, le tableau et les exports

!!! abstract "Prochaines étapes"
- Continuer la mise en page du rapport  
- Créer une section “Suivi de projet” avec synthèse des semaines

---

## Semaine 12

??? note "To Do"
- Organiser tous les fichiers d'exemples et de test  
- Finaliser le rapport : mise en page, visuels, mise en forme

!!! info "Contenu réalisé"
- Réécriture du rapport dans un format stylisé avec `Heading1`, `Heading2`  
- Nettoyage de la structure (espacement, mise en gras des titres)  
- Création d’une **version PDF et DOCX propre** pour la remise finale

!!! abstract "Prochaines étapes"
- Préparer les démonstrations vidéo ou GIFs  
- Éventuellement publier sur GitHub ou héberger une démo

---

## Semaine 13

??? note "To Do"
- Finaliser les derniers tests et démonstrations  
- Relire l’ensemble du code et du rapport

!!! info "Contenu réalisé"
- Derniers ajustements (marges, messages d’erreur, détails d’export)  
- Rapport terminé avec : contexte, problématique, analyse, conception, frontend/backend, résultats et conclusion  
- Code et documentation prêts pour la remise

!!! abstract "Prochaines étapes"
- Soumettre le projet  
- Préparer la présentation orale (si applicable)
