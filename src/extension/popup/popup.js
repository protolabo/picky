let hotInstance = null;
let tableHistory = [];
let originalTableData = null;
let pendingExport = null;
console.log("✅ popup_fixed.js bien chargé !");

document.addEventListener("DOMContentLoaded", () => {
const saved = localStorage.getItem("handsontableData");
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");
  const tableContainer = document.querySelector(".table-container");
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const result = document.getElementById("result");
  const canvas = document.getElementById("zone-canvas");

  uploadBtn.addEventListener("click", () => fileInput.click());
 if (window.location.search.includes("mode=window") && saved) {
  const parsed = JSON.parse(saved);
  displayTableWithState(parsed.tableData, parsed.headers);
  
  // Montre le canvas avec l'image en plein écran
  document.getElementById("drop-zone").classList.add("hidden");
  document.getElementById("canvas-wrapper").classList.remove("hidden");
  document.getElementById("export-buttons").classList.remove("hidden");
  
  // Recharge l'image d'origine
  const imgPath = localStorage.getItem("currentImagePath");
  if (imgPath) {
    initializeZoneEditor(imgPath);
  }

  attachButtonListeners();
  attachExportListeners();
  return;
}
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Le fichier doit être une image.");
      return;
    }

    showLoading();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/extract-table", {
        method: "POST",
        body: formData,
});


      const resultData = await response.json();
      console.log("Réponse du backend :", resultData);
      if (!resultData.success) {
        showError(resultData.message);
        return;
      }

      const tableData = resultData.data;
      currentImagePath = URL.createObjectURL(file);

      console.log("Contenu de tableData :", tableData);
      document.getElementById("result").classList.remove("hidden");
      displayTable(tableData);
      console.log("Affichage tableau avec Handsontable...");
      document.getElementById("drop-zone").classList.add("hidden");
      document.getElementById("canvas-wrapper").classList.remove("hidden");
      initializeZoneEditor(currentImagePath);
    } catch (err) {
      showError("Erreur lors du traitement : " + err.message);
    } finally {
      hideLoading();
    }
    document.getElementById("open-window").addEventListener("click", () => {
      
      if (hotInstance) {
      const dataToSave = {
        tableData: hotInstance.getData(),
        headers: hotInstance.getSettings().nestedHeaders || null
      };
      localStorage.setItem("originalTableData", JSON.stringify(hotInstance.getData()));
      localStorage.setItem("currentImagePath", currentImagePath);
      localStorage.setItem("handsontableData", JSON.stringify(dataToSave));
    }

    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html?mode=window"),
      type: "popup",
      width: 1400,
      height: 900
      
    });
  });

  if (window.location.search.includes("mode=window")) {
    document.body.setAttribute("data-mode", "window");
  }

  });



// Délégation d'événement : gérer le clic sur un bouton de suppression


});
//fin du dom


// Appliquer les styles si on est en mode fenêtre
if (window.location.search.includes("mode=window")) {
  document.body.setAttribute("data-mode", "window");
  document.getElementById("open-window")?.classList.add("hidden");
}

 //=============================== Fonction ==================================

 /**
 * Construit une structure arborescente à partir des données d'un tableau
 * @param {Array<Array>} data - Données du tableau sous forme de matrice 2D
 * @returns {Object} Hiérarchie des nœuds sous forme d'objet
 * 
 * Cette fonction analyse les données colonne par colonne pour créer une structure
 * arborescente représentant les relations parent-enfant entre les cellules.
 * 
 * Variables principales:
 * - hierarchy: Objet stockant la structure arborescente {id: {label, parent, children}}
 * - labelToId: Map pour retrouver rapidement l'ID d'un nœud par son label
 * - lastParent: Garde en mémoire le dernier parent traité
 * - nodeId: Compteur pour générer des IDs uniques
 */
function buildTableTreeFromColumn(data) {
  const rowCount = data.length;
  const colCount = data[0].length;

  const hierarchy = {};       // { id: { label, parent, children } }
  const labelToId = {};       // map to keep track of nodes by label
  let lastParent = null;
  let nodeId = 0;

  function createNode(label) {
    if (label in labelToId) return labelToId[label];
    const id = `n${nodeId++}`;
    hierarchy[id] = { label, parent: null, children: [] };
    labelToId[label] = id;
    return id;
  }

  for (let row = rowCount - 1; row >= 0; row--) {
    const label = data[row][0];

    // On saute les lignes vides
    if (!label) continue;

    const nodeIdCurrent = createNode(label);

    // Cas du bas du tableau = racine (pas de ligne en dessous)
    if (row === rowCount - 1) {
      hierarchy[nodeIdCurrent].parent = null;
      continue;
    }

    const belowLabel = data[row + 1][0];

    // Si la cellule du dessous est non vide : c’est un parent
    if (belowLabel && belowLabel !== label) {
      const parentId = createNode(belowLabel);
      hierarchy[nodeIdCurrent].parent = parentId;
      hierarchy[parentId].children.push(nodeIdCurrent);
      lastParent = parentId;
    } else {
      // Pas de parent immédiat : chercher sur la ligne des parents possibles
      let siblingParentId = null;
      for (let col = 1; col < colCount; col++) {
        const candidate = data[row][col];
        if (candidate && candidate in labelToId) {
          siblingParentId = hierarchy[labelToId[candidate]].parent;
          break;
        }
      }

      if (siblingParentId) {
        hierarchy[nodeIdCurrent].parent = siblingParentId;
        hierarchy[siblingParentId].children.push(nodeIdCurrent);
      } else if (lastParent) {
        hierarchy[nodeIdCurrent].parent = lastParent;
        hierarchy[lastParent].children.push(nodeIdCurrent);
      }
    }
  }

  return hierarchy;
}

/**
 * Affiche une prévisualisation du contenu à exporter avec options
 * @param {string} content - Contenu à prévisualiser
 * @param {string} type - Type d'export ('csv', 'json', 'xml')
 * @param {string} fileName - Nom du fichier pour l'export
 * @param {string} currentMode - Mode d'affichage actuel
 * @param {Object} dataContext - Contexte des données pour la conversion
 * 
 * Cette fonction gère l'interface de prévisualisation avant export:
 * - Affiche le contenu dans une zone de prévisualisation
 * - Configure les boutons de confirmation/annulation
 * - Gère les options de basculement entre formats (ligne/colonne pour JSON)
 * - Prépare le téléchargement du fichier
 */
function showExportPreview(content, type, fileName, currentMode, dataContext) {
  const section = document.getElementById("export-preview-section");
  const preview = document.getElementById("export-preview-content");
  const confirmBtn = document.getElementById("confirm-export-btn");
  const cancelBtn = document.getElementById("cancel-export-btn");
  const switchBtns = document.getElementById("export-switch-buttons-json");
  const switchBtnsxml = document.getElementById("export-switch-buttons-xml");
  const switchToRow = document.getElementById("switch-to-row");
  const switchToCol = document.getElementById("switch-to-column");

  preview.textContent = content;
  section.classList.remove("hidden");
  

  let pending = { type, content, fileName };

  confirmBtn.onclick = () => {
    const blob = new Blob([pending.content], { type: type === 'csv' ? "text/csv" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pending.fileName;
    a.click();

    section.classList.add("hidden");
    switchBtns.classList.add("hidden");
  };

  cancelBtn.onclick = () => {
    section.classList.add("hidden");
    switchBtns.classList.add("hidden");
  };

  switchToRow.onclick = () => {
    const result = convertHierarchyToRowJson(dataContext.hierarchical);
    const json = JSON.stringify(result, null, 2);
    preview.textContent = json;
    pending = { content: json, type: "json", fileName: "table_par_ligne.json" };
  };

  switchToCol.onclick = () => {
    const json = JSON.stringify(dataContext.hierarchical, null, 2);
    preview.textContent = json;
    pending = { content: json, type: "json", fileName: "table_arborescent.json" };
  };

  const rawXmlBtn = document.getElementById("raw-export-xml");
  // Afficher ou masquer les boutons de basculement
  console.log("Prévisualisation type:", type);
  if (switchBtns) {
    if (type === "json") {
      switchBtns.classList.remove("hidden");
    } else {
      switchBtns.classList.add("hidden");
    }
  }

  if (switchBtnsxml) {
    if (type === "xml") {
      switchBtnsxml.classList.remove("hidden");
    } else {
      switchBtnsxml.classList.add("hidden");
    }
  }
}
/**
 * Attache les écouteurs d'événements aux boutons d'action du tableau
 * 
 * Cette fonction configure les actions pour:
 * - Ajouter une nouvelle ligne (new-add-row)
 * - La nouvelle ligne est initialisée vide avec le bon nombre de colonnes
 * 
 * Note: Utilise l'opérateur ?. pour une vérification sûre de l'existence du bouton
 */
function attachButtonListeners() {
  document.getElementById("new-add-row")?.addEventListener("click", () => {
    const currentData = hotInstance.getData();
    const emptyRow = new Array(hotInstance.countCols()).fill("");
    hotInstance.loadData([...currentData, emptyRow]);
  });
}

/**
 * Configure les écouteurs d'événements pour les boutons d'export
 * 
 * Cette fonction gère:
 * - Export Excel (.xlsx)
 * - Export CSV
 * - Export JSON (avec options ligne/colonne)
 * - Export XML
 * 
 * Pour chaque format:
 * 1. Vérifie la présence de données
 * 2. Convertit les données au format approprié
 * 3. Affiche une prévisualisation si nécessaire
 * 4. Gère le téléchargement
 */
function attachExportListeners() {
  document.getElementById("raw-export-xml")?.addEventListener("click", () => {
  if (!hotInstance) return;

  const data = hotInstance.getData();
  const rowCount = data.length;

  // Transformation en format brut (pas d'en-têtes hiérarchiques)
  const rawJson = data.slice(0, rowCount).map(row => {
    return Object.fromEntries(row.map((cell, i) => [`column${i + 1}`, cell]));
  });

  // Conversion en XML brut
  const xmlStr = generateRawXml(rawJson);

  showExportPreview(xmlStr, "xml", "tableau_brut.xml", "raw-xml", {});
});

    document.getElementById("raw-export-json")?.addEventListener("click", () => {
    if (!hotInstance) return;

    const data = hotInstance.getData();
    const rowCount = data.length;
    const colCount = data[0].length;

    // Export JSON brut
    const rawJson = data.slice(0, rowCount).map(row => {
      return Object.fromEntries(row.map((cell, i) => ["column" + (i + 1), cell]));
    });
    const jsonStr = JSON.stringify(rawJson, null, 2);
    showExportPreview(jsonStr, "json", "tableau_brut.json", "raw-json", {});
  });

  document.getElementById("export-xlsx")?.addEventListener("click", () => {
  if (!hotInstance) return;

  // Cacher les boutons JSON mode (ligne/colonne)
  

  const data = hotInstance.getData();

  // Convertir en feuille Excel
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tableau");

  // Créer un fichier .xlsx
  XLSX.writeFile(workbook, "tableau.xlsx");
  });

// EXPORT CSV
  document.getElementById("export-csv")?.addEventListener("click", () => {
    // Masquer les boutons ligne/colonne JSON
      
    if (!hotInstance) return;

      const data = hotInstance.getData();
      const csvContent = data
        .slice(0, 10)
        .map(row =>
          row.map(cell =>
            `"${String(cell).replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`
          ).join(",")
        ).join("\n");

      showExportPreview(csvContent, "csv", "tableau.csv");
      
  });

  // EXPORT JSON
  document.getElementById("export-json")?.addEventListener("click", () => {
  if (!hotInstance) {
    alert("Aucun tableau à exporter");
    return;
  }
  
  const data = hotInstance.getData();
  const rowCount = hotInstance.countRows();
  const colCount = hotInstance.countCols();

  const hierarchical  = buildHierarchicalJson(data, rowCount, colCount);
  const rowWise = convertHierarchyToRowJson(hierarchical);
  const jsonStr = JSON.stringify(rowWise, null, 2);


  showExportPreview(jsonStr, "json", "table_par_ligne.json", "row", { hierarchical });

});
document.getElementById("export-xml")?.addEventListener("click", () => {
  if (!hotInstance) return;
  
  const data = hotInstance.getData();
  const rowCount = hotInstance.countRows();
  const colCount = hotInstance.countCols();

  const hierarchical = buildHierarchicalJson(data, rowCount, colCount);
  const xmlStr = generateXmlFromHierarchy(hierarchical);

  

  showExportPreview(xmlStr, "xml", "tableau.xml");
  // Masquer les boutons ligne/colonne JSON
  
});

}

  document.getElementById("new-add-col")?.addEventListener("click", () => {
    const currentData = hotInstance.getData();
    const updatedData = currentData.map(row => [...row, ""]);
    hotInstance.loadData(updatedData);
  });

  document.getElementById("reset-table")?.addEventListener("click", () => {
    displayTable(originalTableData);
  });

  // Répète pour les autres boutons si besoin
  // Supprimer ligne
document.getElementById("remove-row").addEventListener("click", () => {
  showDeleteRowButtons();
});

document.getElementById("remove-col").addEventListener("click", () => {
  showDeleteColButtons();
});
document.querySelector(".table-container").addEventListener("click", function (e) {
  if (e.target.classList.contains("delete-row-btn")) {
    const rowIndex = parseInt(e.target.dataset.row, 10);
    if (!isNaN(rowIndex)) {
      hotInstance.alter("remove_row", rowIndex);
      showDeleteRowButtons(); // Recalculer les boutons après suppression
    }
  }
});

document.querySelector(".table-container").addEventListener("click", function (e) {
  if (e.target.classList.contains("delete-col-btn")) {
    const colIndex = parseInt(e.target.dataset.col, 10);
    if (!isNaN(colIndex)) {
      hotInstance.alter("remove_col", colIndex);
      showDeleteColButtons(); // Recalculer les boutons après suppression
    }
  }
});

/**
 * Construit une représentation JSON hiérarchique des données du tableau
 * @param {Array<Array>} data - Données du tableau
 * @param {number} rowCount - Nombre total de lignes
 * @param {number} colCount - Nombre total de colonnes
 * @param {number} maxRows - Nombre maximum de lignes à traiter (défaut: 10)
 * @returns {Array<Object>} Structure JSON hiérarchique
 * 
 * Cette fonction organise les données en une structure JSON hiérarchique
 * en regroupant les colonnes par leurs en-têtes parents.
 * 
 * Variables principales:
 * - topHeaders: Première ligne du tableau contenant les en-têtes principaux
 * - columnGroups: Stocke les groupes de colonnes avec leurs parents
 * - currentParent: Garde en mémoire l'en-tête parent actuel
 */
function buildHierarchicalJson(data, rowCount, colCount, maxRows = 10) {
  const topHeaders = data[0];
  const columnGroups = [];
  let currentParent = null;

  for (let col = 0; col < colCount; col++) {
    const cell = topHeaders[col];
    if (cell && cell.trim() !== "") {
      currentParent = cell.trim();
    }
    columnGroups.push({ parent: currentParent, col: col });
  }

  const groupedByParent = {};
  for (const group of columnGroups) {
    if (!groupedByParent[group.parent]) {
      groupedByParent[group.parent] = [];
    }
    groupedByParent[group.parent].push(group.col);
  }

  const result = [];

  for (const parentLabel in groupedByParent) {
    const columns = groupedByParent[parentLabel];

    if (columns.length === 1) {
      const col = columns[0];
      const children = [];

      for (let row = 1; row < Math.min(rowCount, maxRows + 1); row++) {
        const value = data[row][col];
        if (value && value !== "") {
          children.push(value);
        }
      }

      result.push({
        label: parentLabel,
        children: children.map(v => ({ label: v }))
      });

    } else {
      const parent = { label: parentLabel, children: [] };

      for (const col of columns) {
        const childLabel = data[1][col];
        const children = [];

        for (let row = 2; row < Math.min(rowCount, maxRows + 2); row++) {
          const val = data[row][col];
          if (val && val !== "") {
            children.push({ label: val });
          }
        }

        parent.children.push({
          label: childLabel,
          children: children
        });
      }

      result.push(parent);
    }
  }

  return result;
}

function buildRowOrientedJson(data, rowCount, colCount, maxRows = 10) {
  const headerRow1 = data[0]; // Ligne des parents
  const headerRow2 = data[1]; // Ligne des sous-colonnes

  const headers = [];
  let currentParent = null;

  // Étape 1 : associer parent + sous-colonne à chaque colonne
  for (let col = 0; col < colCount; col++) {
    const parent = headerRow1[col];
    const child = headerRow2[col];

    if (parent && parent.trim() !== "") {
      currentParent = parent.trim();
    }

    headers.push({
      parent: currentParent,
      child: child
    });
  }

  // Étape 2 : traiter les lignes (à partir de la 3ᵉ ligne)
  const result = [];

  for (let row = 2; row < Math.min(rowCount, maxRows + 2); row++) {
    const rowData = {};
    for (let col = 0; col < colCount; col++) {
      const cell = data[row][col];
      const { parent, child } = headers[col];

      if (!parent) continue; // ignorer les colonnes sans parent

      if (!child || child === parent || child === "") {
        // Pas de sous-colonne
        rowData[parent] = cell;
      } else {
        if (!rowData[parent]) rowData[parent] = {};
        rowData[parent][child] = cell;
      }
    }
    result.push(rowData);
  }

  return result;
}

function convertHierarchyToRowJson(hierarchicalData) {
  const clean = (str) => str?.replace(/\n/g, ' ').trim();

  // Étape 1 : déterminer combien de lignes on doit générer
  let maxRows = 0;
  for (const parent of hierarchicalData) {
    if (!parent.children || parent.children.length === 0) continue;

    if (!parent.children[0].children) {
      maxRows = Math.max(maxRows, parent.children.length);
    } else {
      maxRows = Math.max(maxRows, parent.children[0].children.length);
    }
  }

  // Étape 2 : construire les lignes
  const result = [];

  for (let i = 0; i < maxRows; i++) {
    const row = {};

    for (const parent of hierarchicalData) {
      const parentLabel = clean(parent.label);

      if (!parent.children || parent.children.length === 0) continue;

      if (!parent.children[0].children) {
        // Cas simple : parent → valeurs directes
        const child = parent.children[i];
        if (child) {
          row[parentLabel] = clean(child.label);
        }
      } else {
        // Cas imbriqué : parent → enfants → valeurs
        const subObj = {};
        for (const child of parent.children) {
          const childLabel = clean(child.label);
          const value = child.children?.[i]?.label ?? null;
          if (value !== null) {
            subObj[childLabel] = clean(value);
          }
        }
        row[parentLabel] = subObj;
      }
    }

    result.push(row);
  }

  return result;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeTag(label) {
  return escapeXml(label.replace(/\n/g, ' ').replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, ""));
}

function generateXmlFromHierarchy(hierarchicalData) {
  // 1. Obtenir le nombre de lignes à générer
  let maxRows = 0;
  for (const parent of hierarchicalData) {
    if (!parent.children || parent.children.length === 0) continue;
    if (!parent.children[0].children) {
      maxRows = Math.max(maxRows, parent.children.length);
    } else {
      maxRows = Math.max(maxRows, parent.children[0].children.length);
    }
  }

  const rows = [];

  // 2. Construire chaque <row>
  for (let i = 0; i < maxRows; i++) {
    let rowXml = "  <row>\n";

    for (const parent of hierarchicalData) {
      const parentTag = normalizeTag(parent.label);
      if (!parent.children || parent.children.length === 0) continue;

      if (!parent.children[0].children) {
        // Ligne plate
        const val = parent.children[i]?.label ?? "";
        rowXml += `    <${parentTag}>${escapeXml(val)}</${parentTag}>\n`;
      } else {
        // Ligne imbriquée
        rowXml += `    <${parentTag}>\n`;
        for (const child of parent.children) {
          const childTag = normalizeTag(child.label);
          const val = child.children?.[i]?.label ?? "";
          rowXml += `      <${childTag}>${escapeXml(val)}</${childTag}>\n`;
        }
        rowXml += `    </${parentTag}>\n`;
      }
    }

    rowXml += "  </row>";
    rows.push(rowXml);
  }

  return `<table>\n${rows.join("\n")}\n</table>`;
}



/**
 * Affiche les données dans un tableau interactif Handsontable
 * @param {Array<Array>} data - Données à afficher dans le tableau
 * 
 * Cette fonction initialise et configure une instance Handsontable
 * pour afficher les données avec des fonctionnalités interactives.
 * 
 * Étapes principales:
 * 1. Attache les écouteurs d'événements pour les boutons
 * 2. Prépare le conteneur
 * 3. Sauvegarde une copie des données originales
 * 4. Configure et initialise Handsontable
 */
function displayTable(data) {
  attachButtonListeners();
  attachExportListeners();
  const container = document.querySelector(".table-container");
  container.innerHTML = "";
  
  originalTableData = JSON.parse(JSON.stringify(data));
  document.getElementById("open-window-div").classList.remove("hidden");

  const colHeaders = data[0];          // ligne des en-têtes
  const tableBody = data.slice(1);     // reste = données

  hotInstance = new Handsontable(container, {
    data: data,
    colHeaders: true,                 // on utilise nestedHeaders
        // ligne d'en-tête personnalisée
    rowHeaders: true,
    manualRowMove: true,
    manualColumnMove: true,
    manualRowResize: true,
    manualColumnResize: true,
    contextMenu: true,
    stretchH: 'all',
    height: 'auto',
    outsideClickDeselects: false,
    selectionMode: 'multiple',
    mergeCells: true,
    readOnly: false,
    licenseKey: 'non-commercial-and-evaluation',

    // Permet de détecter la sélection d'en-têtes (ligne -1)
    afterOnCellMouseDown: (event, coords) => {
      if (coords.row === -1) {
        console.log("En-têtes sélectionnés :", hotInstance.getSelected());
      }
    }
  });
}

function displayTableWithState(data, nestedHeaders) {
  const container = document.querySelector(".table-container");
  container.innerHTML = "";

  originalTableData = JSON.parse(JSON.stringify(data)); // 🟢 essentiel

  hotInstance = new Handsontable(container, {
    data,
    colHeaders: !nestedHeaders,
    nestedHeaders: nestedHeaders || undefined,
    rowHeaders: true,
    manualRowMove: true,
    manualColumnMove: true,
    manualRowResize: true,
    manualColumnResize: true,
    contextMenu: true,
    stretchH: 'all',
    height: 'auto',
    outsideClickDeselects: false,
    selectionMode: 'multiple',
    mergeCells: true,
    readOnly: false,
    licenseKey: 'non-commercial-and-evaluation'
  });

  document.getElementById("result").classList.remove("hidden");
  document.getElementById("open-window-div").classList.remove("hidden");
}
/**
 * Affiche les boutons de suppression pour chaque ligne du tableau
 * 
 * Cette fonction:
 * 1. Compte le nombre de lignes dans le tableau
 * 2. Supprime les boutons existants
 * 3. Crée un bouton de suppression pour chaque ligne
 * 4. Positionne les boutons à côté des lignes
 * 
 * Le bouton est placé avec un délai pour s'assurer que
 * le tableau est complètement rendu avant le positionnement.
 */
function showDeleteRowButtons() {
  const rows = hotInstance.countRows();
  const tableContainer = document.querySelector(".table-container");
  removeDeleteButtons();

 console.log("Création des boutons de suppression...");

setTimeout(() => {
  for (let i = 0; i < rows; i++) {
    const cell = hotInstance.getCell(i, 0); // première cellule de la ligne
    if (!cell) {
      console.warn(`Cellule ${i},0 non trouvée`);
      continue;
    }

    const rect = cell.getBoundingClientRect();
    const tableRect = tableContainer.getBoundingClientRect();

    const top = rect.top - tableRect.top;
    const left = 0;

    console.log(`Bouton ligne ${i} ➜ top: ${top}px, left: ${left }px`);

    const btn = document.createElement("button");
    btn.textContent = "❌";
    btn.classList.add("delete-row-btn");
    btn.style.position = "absolute";
    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
    btn.dataset.row = i;

    tableContainer.appendChild(btn);
  }

  console.log("Nombre total de boutons :", document.querySelectorAll('.delete-row-btn').length);
}, 100); // délai pour s'assurer que le rendu est terminé
}

function showLoading() {
    loading.classList.remove("hidden");
    error.classList.add("hidden");
    result.classList.add("hidden");
  }

function hideLoading() {
    loading.classList.add("hidden");
  }

function showError(msg) {
    error.textContent = msg;
    error.classList.remove("hidden");
  }

function showDeleteColButtons() {
  const cols = hotInstance.countCols();
  const tableContainer = document.querySelector(".table-container");
  removeDeleteButtons();

  console.log("Création des boutons de suppression de colonne...");

  setTimeout(() => {
    for (let j = 0; j < cols; j++) {
      const cell = hotInstance.getCell(0, j); // première cellule de la colonne
      if (!cell) {
        console.warn(`Cellule 0,${j} non trouvée`);
        continue;
      }

      const rect = cell.getBoundingClientRect();
      const tableRect = tableContainer.getBoundingClientRect();

      const left = rect.left - tableRect.left;
      const top = -25;

      console.log(`Bouton colonne ${j} ➜ top: ${top}px, left: ${left}px`);

      const btn = document.createElement("button");
      btn.textContent = "❌";
      btn.classList.add("delete-col-btn");
      btn.style.position = "absolute";
      btn.style.top = `0px`;
      btn.style.left = `${left}px`;
      btn.dataset.col = j;

      tableContainer.appendChild(btn);
    }

    console.log("Nombre total de boutons colonnes :", document.querySelectorAll('.delete-col-btn').length);
  }, 100);
}

function generateRawXml(data) {
  let xml = "<table>\n";
  for (const row of data) {
    xml += "  <row>\n";
    for (const key in row) {
      const safeVal = String(row[key]).replace(/[&<>]/g, s => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[s]));
      xml += `    <${key}>${safeVal}</${key}>\n`;
    }
    xml += "  </row>\n";
  }
  xml += "</table>";
  return xml;
}

function removeDeleteButtons() {
  document.querySelectorAll(".delete-row-btn").forEach(btn => btn.remove());
}

function removeDeleteButtons() {
  document.querySelectorAll(".delete-row-btn, .delete-col-btn").forEach(btn => btn.remove());
}

/**
 * Charge les zones de tableau depuis un fichier XML
 * @returns {Promise<Array>} Liste des zones avec leurs coordonnées
 * 
 * Cette fonction:
 * 1. Récupère le fichier XML depuis le serveur
 * 2. Parse le XML pour extraire les coordonnées
 * 3. Convertit les coordonnées en objets zones utilisables
 * 
 * Format de retour: Array<{x: number, y: number, w: number, h: number}>
 */
async function loadZonesFromXML() {
  const response = await fetch("http://localhost:8000/static/table_structure.xml");
  const xmlText = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const zoneElements = xml.getElementsByTagName("Coords");
  const zones = [];

  for (const coordNode of zoneElements) {
    const points = coordNode.getAttribute("points"); // format: "x1,y1 x2,y2 x3,y3 x4,y4"
    if (!points) continue;

    const coords = points.split(" ").map(pt => pt.split(",").map(Number));
    const xs = coords.map(p => p[0]);
    const ys = coords.map(p => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;

    zones.push({ x, y, w, h });
  }

  return zones;
}

 /**
 * Initialise l'éditeur de zones sur l'image pour la sélection de zones de tableau
 * @param {string} imageSrc - Source de l'image à éditer
 * 
 * Cette fonction met en place un éditeur interactif permettant de:
 * - Afficher l'image dans un canvas
 * - Dessiner et manipuler des zones de sélection
 * - Gérer les interactions utilisateur (drag & drop, redimensionnement)
 * - Sauvegarder les zones pour l'analyse OCR
 * 
 * Variables principales:
 * - realImageSize: Dimensions réelles de l'image originale
 * - canvas: Élément canvas pour le dessin
 * - zones: Liste des zones de sélection
 * - selectedZone: Zone actuellement sélectionnée
 */
/**
 * Initialise l'éditeur de zones sur l'image
 * @param {string} imageSrc - Source de l'image à éditer
 * 
 * Cette fonction met en place un éditeur interactif permettant de:
 * - Afficher l'image dans un canvas
 * - Dessiner et manipuler des zones de sélection
 * - Gérer les interactions utilisateur (drag & drop, redimensionnement)
 * - Sauvegarder les zones pour l'analyse OCR
 */
async function initializeZoneEditor(imageSrc) {
  let realImageSize = { width: 0, height: 0 }; // Dimensions de l'image originale

  const canvas = document.getElementById("zone-canvas");
  if (!canvas) {
    console.log("❌ Canvas #zone-canvas introuvable dans le DOM.");
    return;
  }
  const ctx = canvas.getContext("2d");

  const zones = await loadZonesFromXML();
  window.zones = zones;
  let selectedZone = null;
  let isDragging = false;
  let isResizing = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const image = new Image();
  window.zoneEditorImage = image;
  image.onload = () => {
    canvas.width = image.width;
    canvas.height = image.height;

    realImageSize.width = image.naturalWidth;
    realImageSize.height = image.naturalHeight;

    draw();
  };
  image.src = imageSrc;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    for (const zone of zones) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.fillStyle = "red";
      ctx.fillRect(zone.x + zone.w - 8, zone.y + zone.h - 8, 8, 8);
    }
  }

  canvas.onmousedown = (e) => {
    const { offsetX, offsetY } = e;

    for (const zone of zones) {
      if (
        offsetX > zone.x + zone.w - 10 && offsetX < zone.x + zone.w &&
        offsetY > zone.y + zone.h - 10 && offsetY < zone.y + zone.h
      ) {
        selectedZone = zone;
        isResizing = true;
        return;
      }

      if (
        offsetX > zone.x && offsetX < zone.x + zone.w &&
        offsetY > zone.y && offsetY < zone.y + zone.h
      ) {
        selectedZone = zone;
        isDragging = true;
        dragOffsetX = offsetX - zone.x;
        dragOffsetY = offsetY - zone.y;
        return;
      }
    }
  };

  canvas.onmousemove = (e) => {
    if (!selectedZone) return;
    const { offsetX, offsetY } = e;

    if (isDragging) {
      selectedZone.x = offsetX - dragOffsetX;
      selectedZone.y = offsetY - dragOffsetY;
      draw();
    }

    if (isResizing) {
      selectedZone.w = offsetX - selectedZone.x;
      selectedZone.h = offsetY - selectedZone.y;
      draw();
    }
  };

  canvas.onmouseup = () => {
    selectedZone = null;
    isDragging = false;
    isResizing = false;
  };

  canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // empêche le menu du clic droit par défaut
  const { offsetX, offsetY } = e;

  // Trouve une zone cliquée
  const index = zones.findIndex(zone =>
    offsetX >= zone.x && offsetX <= zone.x + zone.w &&
    offsetY >= zone.y && offsetY <= zone.y + zone.h
  );

  if (index !== -1) {
    zones.splice(index, 1); // Supprime la zone
    draw(); // Redessine
  }
});

  // Gestion des boutons
  document.getElementById("addZoneBtn")?.addEventListener("click", () => {
    zones.push({ x: 50, y: 50, w: 100, h: 60 });
    draw();
  });

document.getElementById("saveZonesBtn")?.addEventListener("click", async () => {
  // Échelle
  const scaleX = realImageSize.width / canvas.width;
  const scaleY = realImageSize.height / canvas.height;

  const scaledZones = zones.map(z => ({
    x: Math.round(z.x ),
    y: Math.round(z.y ),
    w: Math.round(z.w ),
    h: Math.round(z.h )
  }));

  try {
    const res = await fetch("http://localhost:8000/reanalyze-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zones: scaledZones,
        canvas_width: canvas.width,
        canvas_height: canvas.height
      })
    });
    const json = await res.json();
    console.log("✅ Résultat OCR :", json.data);
    displayTable(json.data);
  } catch (e) {
    console.error("❌ Erreur d'envoi :", e);
  }
});

}
