let tableData = null;
let isWindowMode = false;

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
        }
    } else {
        // Mode popup 
        setupPopupInterface();
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
    row.forEach((cell, cellIndex) => {
      const td = createEditableCell(cell, rowIndex, cellIndex);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);

  if (!isWindowMode) {
    const resultDiv = document.getElementById('result');
    const openWindowBtn = document.getElementById('open-window-div');
    const errorDiv = document.getElementById('error');
    resultDiv.classList.remove('hidden');
    openWindowBtn.classList.remove('hidden'); 
    errorDiv.classList.add('hidden');
}

  setupEditableTable();
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
  div.textContent = content;
  div.dataset.row = rowIndex;
  div.dataset.cell = cellIndex;
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