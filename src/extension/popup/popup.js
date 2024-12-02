let tableData = null;
let isWindowMode = false;
let selectedCells = [];
let isSelecting = false;
let contextMenu = null;
let loadingDiv, errorDiv, resultDiv, openWindowBtn;

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

        // Vérifier s'il y a une image capturée à traiter
        const { capturedImage } = await chrome.storage.local.get(['capturedImage']);
        if (capturedImage) {
            processImage(capturedImage);
        }
    }
});

function setupPopupInterface() {
  // Assignation aux variables globales
  loadingDiv = document.getElementById('loading');
  errorDiv = document.getElementById('error');
  resultDiv = document.getElementById('result');
  openWindowBtn = document.getElementById('open-window-div');

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const captureBtn = document.getElementById('capture-btn');

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

  // Gestion du bouton capturer
  captureBtn.addEventListener('click', async () => {
    try {
        // Obtenir l'onglet actif
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Injecter html2canvas
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['libs/html2canvas.min.js']
        });

        // Injecter le script de capture
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['popup/capture.js']
        });

        // Fermer le popup
        window.close();

    } catch (error) {
        console.error('Erreur lors de l\'injection du script :', error);
    }
  });

  // Gestion du bouton ouvrir dans une nouvelle fenêtre  
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

async function processImage(input) {
  showLoading();
  
  try {
    let formData;
    let options;
    
    if (input instanceof File) {
      // Cas d'un fichier uploaded
      if (!input.type.startsWith('image/')) {
        showError('Le fichier doit être une image.');
        return;
      }
      formData = new FormData();
      formData.append('file', input);
      options = {
        method: 'POST',
        body: formData
      };
    } else {
      // Cas d'une image base64 (capture)
      const imageBlob = await base64ToBlob(input);
      const imageFile = new File([imageBlob], 'screenshot.png', { type: 'image/png' });
      formData = new FormData();
      formData.append('file', imageFile);
      options = {
        method: 'POST',
        body: formData
      };
      // Nettoyer le storage 
      chrome.storage.local.remove(['capturedImage']);
    }

    const response = await fetch('http://localhost:8000/extract-table', options);
    const result = await response.json();

    if (!result.success) {
      showError(result.message);
      return;
    }

    tableData = result.data;
    showResults(result.data);
    setupExportButtons();
  } catch (error) {
    showError('Erreur lors du traitement de l\'image: ' + error.message);
  } finally {
    hideLoading();
  }
}

function base64ToBlob(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  
  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: 'image/png' });
}

function showResults(data) {
  console.log(data);
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
  
  let mergeCount = 0;
  let nextIndex = cellIndex + 1;
  
  while (nextIndex < tableData[rowIndex].length && tableData[rowIndex][nextIndex] === '_') {
    mergeCount++;
    nextIndex++;
  }
  
  if (mergeCount > 0) {
    td.classList.add('merged-source');
    if (nextIndex === tableData[rowIndex].length) {
      td.classList.add('merge-end');
    }
    td.colSpan = mergeCount + 1;
    div.dataset.colspan = mergeCount + 1;
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

  // Nettoyer les anciens boutons
  document.querySelectorAll('.delete-button').forEach(btn => btn.remove());
  
  // Pour chaque colonne du tableau de données
  tableData[0].forEach((_, colIndex) => {
    const deleteBtn = createDeleteButton('column', colIndex);
    table.parentElement.appendChild(deleteBtn);
    
    // Trouver la cellule visible pour cette colonne
    const firstVisibleCell = findFirstVisibleCell(rows[0], colIndex);
    if (firstVisibleCell) {
      positionDeleteButton(deleteBtn, firstVisibleCell, 'column', colIndex);
    }
  });

  // Boutons de suppression pour les lignes
  rows.forEach((row, rowIndex) => {
    const deleteBtn = createDeleteButton('row', rowIndex);
    table.parentElement.appendChild(deleteBtn);
    positionDeleteButton(deleteBtn, row.firstElementChild, 'row', rowIndex);
  });

  // Gestion de l'affichage des boutons au survol
  table.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('td');
    if (cell) {
      const rowIndex = getRowIndex(cell);
      const colIndices = getColumnIndices(cell);
      showDeleteButtons(rowIndex, colIndices);
    }
  });

  table.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget?.closest('.table-container')) {
      hideAllDeleteButtons();
    }
  });
}

// Trouver la première cellule visible d'une colonne
function findFirstVisibleCell(row, targetIndex) {
  let dataIndex = 0;  // Index dans tableData
  let visualIndex = 0;  // Index visuel
  
  for (const cell of row.cells) {
    const colspan = parseInt(cell.colSpan) || 1;
    // Si l'index cible est dans la plage de cette cellule
    if (visualIndex <= targetIndex && targetIndex < visualIndex + colspan) {
      // Retourner la cellule avec l'index réel des données
      cell.dataset.realIndex = dataIndex;
      return cell;
    }
    visualIndex += colspan;
    dataIndex += colspan;  // Avancer l'index des données du nombre de cellules fusionnées
  }
  return null;
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

function positionDeleteButton(button, referenceElement, type, index) {
  const rect = referenceElement.getBoundingClientRect();
  const containerRect = referenceElement.closest('.table-container').getBoundingClientRect();
  
  if (type === 'column') {
    const colspan = parseInt(referenceElement.colSpan) || 1;
    const realIndex = parseInt(referenceElement.dataset.realIndex);
    const cellWidth = rect.width / colspan;
    const offset = index - realIndex;  // Calculer le décalage dans la cellule fusionnée
    const left = rect.left - containerRect.left + offset * cellWidth + (cellWidth / 2);
    button.style.left = `${left}px`;
    button.style.top = '5px';
  } else {
    const top = rect.top - containerRect.top + (rect.height / 2);
    button.style.top = `${top}px`;
    button.style.left = '5px';
  }
}

function getRowIndex(cell) {
  return cell.closest('tr').rowIndex;
}

function getColumnIndices(cell) {
  const startIndex = parseInt(cell.querySelector('.editable-cell')?.dataset.cell);
  const colspan = parseInt(cell.colSpan) || 1;
  return Array.from({length: colspan}, (_, i) => startIndex + i);
}

function showDeleteButtons(rowIndex, colIndices) {
  const buttons = document.querySelectorAll('.delete-button');
  buttons.forEach(button => {
    if ((button.dataset.type === 'row' && button.dataset.index == rowIndex) ||
        (button.dataset.type === 'column' && colIndices.includes(parseInt(button.dataset.index)))) {
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
      // Suppression de colonne
      tableData.forEach(row => {
          const value = row[index];
          const nextValue = row[index + 1];

          if (value !== '_' && nextValue === '_') {
              // Si la colonne suivante est fusionnée, déplacer le contenu
              row[index + 1] = value;
          }
          row.splice(index, 1);
      });
  }
  
  if (isWindowMode) {
      await chrome.storage.local.set({ tableData: tableData });
  }
  
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
