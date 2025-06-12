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

## Semaine 6

## Semaine 7

## Semaine 8

## Semaine 9

## Semaine 10

## Semaine 11

## Semaine 12

## Semaine 13
