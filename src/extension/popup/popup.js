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

  function showResults(data) {
    // Création du tableau HTML
    const tableContainer = document.querySelector('.table-container');
    const table = document.createElement('table');
    
    // Créer le corps 
    const tbody = document.createElement('tbody');
    
    // Ajouter chaque ligne de données
    data.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
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
  }
  
  // Ajout de la fonctionnalité d'ouverture dans une nouvelle fenêtre
  document.getElementById('open-window').addEventListener('click', () => {
    const resultContent = document.getElementById('result').innerHTML;
    const win = window.open('', '_blank', 'width=800,height=600');
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
            ${resultContent}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  });
});