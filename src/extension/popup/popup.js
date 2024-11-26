let tableData = null;
let isWindowMode = false;
let selectedCells = [];
let isSelecting = false;
let contextMenu = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier si nous sommes dans la fenêtre ou le popup
    const urlParams = new URLSearchParams(window.location.search);
    isWindowMode = urlParams.get('mode') === 'window';

    if (isWindowMode) {
        // Mode fenêtre
        const storedData = await chrome.storage.local.get(['tableData']);
        if (storedData.tableData) {
            tableData = storedData.tableData;
            showResults(tableData);
            setupExportButtons();
        }
    } else {
        // Mode popup 
        setupPopupInterface();
        setupExportButtons();
    }
});

function setupPopupInterface() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const loadingDiv = document.getElementById('loading');
  const errorDiv = document.getElementById('error');
  const resultDiv = document.getElementById('result');
  const openWindowBtn = document.getElementById('open-window-div');

  // Gestion du drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      processImage(file);
    }
  });

  // Gestion du bouton upload
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processImage(file);
    }
  });

  async function processImage(file) {
    if (!file.type.startsWith('image/')) {
      showError('Le fichier doit être une image.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoading();
    
    try {
      const response = await fetch('http://localhost:8000/extract-table', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        showError(result.message);
        return;
      }

      tableData = result.data; // Stocker les données
      showResults(result.data);
    } catch (error) {
      showError('Erreur lors du traitement de l\'image: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  function showLoading() {
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    resultDiv.classList.add('hidden');
    openWindowBtn.classList.add('hidden');
  }

  function hideLoading() {
    loadingDiv.classList.add('hidden');
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    openWindowBtn.classList.add('hidden');
  }
  
  openWindowBtn.addEventListener('click', async () => {
    // Sauvegarder les données actuelles
    await chrome.storage.local.set({ tableData: tableData });
    
    // Créer la nouvelle fenêtre
    chrome.windows.create({
        url: chrome.runtime.getURL('popup/table-window.html?mode=window'),
        type: 'popup',
        width: 800,
        height: 600
    });

    // Griser l'interface du popup
    document.querySelector('.container').classList.add('disabled');
});
}

function showResults(data) {
  // Création du tableau HTML
  const tableContainer = document.querySelector('.table-container');
  const table = document.createElement('table');
  
  // Créer le corps 
  const tbody = document.createElement('tbody');
  
  // Ajouter chaque ligne de données
  data.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    for(let cellIndex = 0; cellIndex < row.length; cellIndex++) {
        // Si c'est une cellule fusionnée ('_'), on la saute
        if (row[cellIndex] === '_') continue;
        
        const td = createEditableCell(row[cellIndex], rowIndex, cellIndex);
        tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);

  if (!isWindowMode) {
    const resultDiv = document.getElementById('result');
    const openWindowBtn = document.getElementById('open-window-div');
    const errorDiv = document.getElementById('error');
    const exportButtons = document.getElementById('export-buttons');
    resultDiv.classList.remove('hidden');
    openWindowBtn.classList.remove('hidden'); 
    errorDiv.classList.add('hidden');
    exportButtons.classList.remove('hidden');
  }

  setupEditableTable();
  setupDeleteButtons(table);
  setupCellSelection(table);
}

function setupEditableTable() {
  const table = document.querySelector('.table-container table');
  
  table.addEventListener('dblclick', (e) => {
    const cell = e.target.closest('.editable-cell');
    if (!cell) return;
    
    startEditing(cell);
  });

  // Quand on clique sur entrer ou sur un autre élément
  table.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const editor = e.target.closest('.cell-editor');
      if (editor) {
        e.preventDefault();
        finishEditing(editor);
      }
    }
  });

  // Quand on clique en dehors de la cellule
  table.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('cell-editor')) {
      finishEditing(e.target);
    }
  });
}

function createEditableCell(content, rowIndex, cellIndex) {
  const td = document.createElement('td');
  const div = document.createElement('div');
  div.className = 'editable-cell';
  div.dataset.row = rowIndex;
  div.dataset.cell = cellIndex;
  
  // Compter combien de cellules sont fusionnées à droite
  let mergeCount = 0;
  let nextIndex = cellIndex + 1;
  while (nextIndex < tableData[rowIndex].length && tableData[rowIndex][nextIndex] === '_') {
      mergeCount++;
      nextIndex++;
  }
  
  if (mergeCount > 0) {
      td.classList.add('merged-source');
      // Ajouter la classe merge-end si c'est la dernière cellule visible de la ligne
      if (cellIndex + mergeCount === tableData[rowIndex].length - 1) {
          td.classList.add('merge-end');
      }
      td.colSpan = mergeCount + 1;
  }
  
  div.textContent = content;
  td.appendChild(div);
  return td;
}

function startEditing(cell) {
  if (cell.querySelector('.cell-editor')) return;
  
  const content = cell.textContent;
  const rowIndex = parseInt(cell.dataset.row);
  const cellIndex = parseInt(cell.dataset.cell);
  
  const editor = document.createElement('textarea');
  editor.className = 'cell-editor';
  editor.value = content;
  editor.dataset.row = rowIndex;
  editor.dataset.cell = cellIndex;
  
  cell.textContent = '';
  cell.classList.add('editing');
  cell.appendChild(editor);
  
  editor.focus();
  editor.select();
}

// synchroniser les modifications
async function finishEditing(editor) {
    const cell = editor.closest('.editable-cell');
    const newContent = editor.value;
    const rowIndex = parseInt(editor.dataset.row);
    const cellIndex = parseInt(editor.dataset.cell);
    
    // Mettre à jour les données
    tableData[rowIndex][cellIndex] = newContent;
    
    // Si nous sommes en mode fenêtre, mettre à jour le storage
    if (isWindowMode) {
        await chrome.storage.local.set({ tableData: tableData });
    }
    
    // Mettre à jour l'affichage
    cell.classList.remove('editing');
    cell.textContent = newContent;
}

// fermeture de la fenêtre
if (isWindowMode) {
    window.addEventListener('beforeunload', async () => {
        // Nettoyer le storage quand la fenêtre est fermée
        await chrome.storage.local.remove(['tableData']);
    });
};

function convertToCSV(data) {
  const rows = data.map(row => {
      return row.map(cell => {
          // Échapper les virgules et les guillemets
          const escaped = cell.toString().replace(/"/g, '""');
          // TODO: enlever les "" ou non ? 
          return `"${escaped}"`;
      }).join(',');
  });
  return rows.join('\n');
}

function convertToJSON(data) {
  return JSON.stringify(
      data.map(row => 
          row.filter(cell => cell !== '_')
      ),
      null, 
      2
  );
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function setupExportButtons() {
  const exportButtons = document.querySelectorAll('.export-btn');
  
  // Retirer les événements existants s'il y en a
  exportButtons.forEach(button => {
    button.replaceWith(button.cloneNode(true));
  });
  // Récupérer les nouveaux boutons après le clonage
  const newExportButtons = document.querySelectorAll('.export-btn');

  newExportButtons[0].addEventListener('click', () => {
      if (!tableData) return;
      const csv = convertToCSV(tableData);
      const date = new Date().toISOString().split('T')[0];
      downloadFile(csv, `table_${date}.csv`, 'text/csv');
  });

  newExportButtons[1].addEventListener('click', () => {
      if (!tableData) return;
      const json = convertToJSON(tableData);
      const date = new Date().toISOString().split('T')[0];
      downloadFile(json, `table_${date}.json`, 'application/json');
  });
}

function setupDeleteButtons(table) {
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];
  
  // boutons de suppression pour les colonnes
  firstRow.querySelectorAll('td').forEach((cell, colIndex) => {
      const deleteBtn = createDeleteButton('column', colIndex);
      table.parentElement.appendChild(deleteBtn);
      positionDeleteButton(deleteBtn, cell, 'column');
  });

  // boutons de suppression pour les lignes
  rows.forEach((row, rowIndex) => {
      const deleteBtn = createDeleteButton('row', rowIndex);
      table.parentElement.appendChild(deleteBtn);
      positionDeleteButton(deleteBtn, row.firstElementChild, 'row');
  });

  // affichage des boutons au survol
  table.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('td');
      if (cell) {
          const rowIndex = cell.parentElement.rowIndex;
          const colIndex = cell.cellIndex;
          showDeleteButtons(rowIndex, colIndex);
      }
  });

  table.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget?.closest('.table-container')) {
          hideAllDeleteButtons();
      }
  });
}

function createDeleteButton(type, index) {
  const button = document.createElement('button');
  button.className = `delete-button delete-${type}`;
  button.textContent = '×';
  button.dataset.type = type;
  button.dataset.index = index;
  
  button.addEventListener('click', () => confirmDelete(type, index));
  return button;
}

function positionDeleteButton(button, referenceElement, type) {
  const rect = referenceElement.getBoundingClientRect();
  const containerRect = referenceElement.closest('.table-container').getBoundingClientRect();
  
  if (type === 'column') {
    const left = rect.left - containerRect.left + (rect.width / 2);
    button.style.left = `${left}px`;
    button.style.top = '5px'; // Position fixe depuis le haut
  } else { 
    const top = rect.top - containerRect.top + (rect.height / 2);
    button.style.top = `${top}px`;
    button.style.left = '5px'; // Position fixe depuis la gauche
  }
}

function showDeleteButtons(rowIndex, colIndex) {
  const buttons = document.querySelectorAll('.delete-button');
  buttons.forEach(button => {
      if ((button.dataset.type === 'row' && button.dataset.index == rowIndex) ||
          (button.dataset.type === 'column' && button.dataset.index == colIndex)) {
          button.style.display = 'flex';
      } else {
          button.style.display = 'none';
      }
  });
}

function hideAllDeleteButtons() {
  document.querySelectorAll('.delete-button').forEach(button => {
      button.style.display = 'none';
  });
}

function confirmDelete(type, index) {
  const modal = createConfirmationModal(type, index);
  document.body.appendChild(modal);
}

function createConfirmationModal(type, index) {
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const message = document.createElement('p');
  message.textContent = `Êtes-vous sûr de vouloir supprimer cette ${type === 'row' ? 'ligne' : 'colonne'} ?`;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'modal-buttons';
  
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Confirmer';
  confirmButton.className = 'window-btn';
  confirmButton.onclick = () => {
      deleteTableElement(type, index);
      closeModal(modal, modalBackdrop);
  };
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Annuler';
  cancelButton.className = 'export-btn';
  cancelButton.onclick = () => closeModal(modal, modalBackdrop);
  
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);
  
  modal.appendChild(message);
  modal.appendChild(buttonContainer);
  
  modalBackdrop.appendChild(modal);
  
  modalBackdrop.style.display = 'block';
  modal.style.display = 'block';
  
  return modalBackdrop;
}

function closeModal(modal, backdrop) {
  modal.remove();
  backdrop.remove();
}

async function deleteTableElement(type, index) {
  if (type === 'row') {
      tableData.splice(index, 1);
  } else {
      tableData.forEach(row => {
          row.splice(index, 1);
      });
  }
  
  // Si nous sommes en mode fenêtre, mettre à jour le storage
  if (isWindowMode) {
      await chrome.storage.local.set({ tableData: tableData });
  }
  
  // Mettre à jour l'affichage
  showResults(tableData);
}

function setupCellSelection(table) {
  // Créer le menu contextuel
  createContextMenu();
  
  // Gestionnaire de la sélection
  table.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Clic gauche
          const cell = e.target.closest('.editable-cell');
          if (!cell) return;
          
          if (!e.ctrlKey) {
              clearSelection();
          }
          
          toggleCellSelection(cell);
          isSelecting = true;
      }
  });
  
  table.addEventListener('mouseover', (e) => {
      if (!isSelecting) return;
      
      const cell = e.target.closest('.editable-cell');
      if (cell && !cell.classList.contains('selected')) {
          toggleCellSelection(cell);
      }
  });
  
  document.addEventListener('mouseup', () => {
      isSelecting = false;
      validateSelection();
  });
  
  // Gestionnaire du menu contextuel
  table.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.editable-cell');
      if (!cell) return;
      
      if (selectedCells.length > 1) {
          showContextMenu(e.pageX, e.pageY);
      }
  });
}

function createContextMenu() {
  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  
  const mergeOption = document.createElement('div');
  mergeOption.className = 'context-menu-item';
  mergeOption.textContent = 'Fusionner les cellules';
  mergeOption.onclick = mergeCells;
  
  contextMenu.appendChild(mergeOption);
  document.body.appendChild(contextMenu);
  
  // Fermer le menu au clic ailleurs
  document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
          hideContextMenu();
      }
  });
}

function showContextMenu(x, y) {
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
  if (contextMenu) {
      contextMenu.style.display = 'none';
  }
}

function toggleCellSelection(cell) {
  cell.classList.toggle('selected');
  if (cell.classList.contains('selected')) {
      selectedCells.push(cell);
  } else {
      selectedCells = selectedCells.filter(c => c !== cell);
  }
}

function clearSelection() {
  selectedCells.forEach(cell => {
      cell.classList.remove('selected');
  });
  selectedCells = [];
}

function validateSelection() {
  if (selectedCells.length <= 1) {
      clearSelection();
      return;
  }
  
  // Vérifier que les cellules sont sur la même ligne
  const firstRow = selectedCells[0].closest('tr');
  const allSameRow = selectedCells.every(cell => cell.closest('tr') === firstRow);
  
  if (allSameRow) {
      // Obtenir tous les indices réels disponibles (non fusionnés) dans la ligne
      const rowIndex = parseInt(firstRow.firstElementChild.querySelector('.editable-cell').dataset.row);
      const availableIndices = tableData[rowIndex]
          .map((cell, index) => cell !== '_' ? index : -1)
          .filter(index => index !== -1);

      // Obtenir les indices des cellules sélectionnées
      const selectedIndices = selectedCells
          .map(cell => parseInt(cell.dataset.cell))
          .sort((a, b) => a - b);

      // Vérifier que les indices sélectionnés sont consécutifs dans availableIndices
      const selectedPositions = selectedIndices.map(index => availableIndices.indexOf(index));
      const isAdjacent = selectedPositions.every((pos, idx) => {
          return idx === 0 || pos === selectedPositions[idx - 1] + 1;
      });

      if (!isAdjacent) {
          selectedCells.forEach(cell => cell.classList.add('invalid-selection'));
          setTimeout(() => {
              selectedCells.forEach(cell => cell.classList.remove('invalid-selection'));
              clearSelection();
          }, 1000);
      }
  } else {
      clearSelection();
  }
}

async function mergeCells() {
  if (selectedCells.length <= 1) return;
  
  // Obtenir les indices triés
  const rowIndex = parseInt(selectedCells[0].dataset.row);
  const cellIndices = selectedCells
      .map(cell => parseInt(cell.dataset.cell))
      .sort((a, b) => a - b);
  
  // Créer le contenu fusionné avec tous les contenus
  let mergedContent = cellIndices
      .map(index => tableData[rowIndex][index])
      .join(' ');
  
  // Mettre à jour les données
  cellIndices.forEach((cellIndex, idx) => {
      if (idx === 0) {
          // Première cellule : contient le contenu fusionné
          tableData[rowIndex][cellIndex] = mergedContent;
      } else {
          // Autres cellules : marquées comme fusionnées
          tableData[rowIndex][cellIndex] = '_';
      }
  });

  // Si nous sommes en mode fenêtre, mettre à jour le storage
  if (isWindowMode) {
      await chrome.storage.local.set({ tableData: tableData });
  }
  
  // Mettre à jour l'affichage
  hideContextMenu();
  clearSelection();
  showResults(tableData);
}
