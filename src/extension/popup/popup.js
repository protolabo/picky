document.addEventListener('DOMContentLoaded', function() {
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
    resultDiv.classList.remove('hidden');
    openWindowBtn.classList.remove('hidden'); 
    errorDiv.classList.add('hidden');

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

  function finishEditing(editor) {
    const cell = editor.closest('.editable-cell');
    const newContent = editor.value;
    const rowIndex = parseInt(editor.dataset.row);
    const cellIndex = parseInt(editor.dataset.cell);
    
    // Mettre à jour les données dans le tableau stocké
    tableData[rowIndex][cellIndex] = newContent;
    
    // Mettre à jour l'affichage
    cell.classList.remove('editing');
    cell.textContent = newContent;
  }
  
  // Ajout de la fonctionnalité d'ouverture dans une nouvelle fenêtre
  document.getElementById('open-window').addEventListener('click', () => {
    const win = window.open('', '_blank', 'width=800,height=600');
    
    // Créer une version en lecture seule du tableau
    const tableHTML = createTable(tableData);
    
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Résultats:</title>
          <style>
            body { margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table-container { margin: 20px; }
          </style>
        </head>
        <body>
          <div class="table-container">
            ${tableHTML}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  });

  function createTable(data) {
    let html = '<table>';
    data.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  }
});