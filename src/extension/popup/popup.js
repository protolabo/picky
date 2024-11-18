document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
  
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
      } catch (error) { // TODO: Fix l'affichage du msg d'erreur
        showError('Erreur lors du traitement de l\'image: ' + error.message);
      } finally {
        hideLoading();
      }
    }
  
    function showLoading() {
      loadingDiv.classList.remove('hidden');
      errorDiv.classList.add('hidden');
      resultDiv.classList.add('hidden');
    }
  
    function hideLoading() {
      loadingDiv.classList.add('hidden');
    }
  
    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.classList.remove('hidden');
      resultDiv.classList.add('hidden');
    }
    // TODO: fix this
    function showResults(data) {
      // Création du tableau HTML
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
      resultDiv.innerHTML = '';
      resultDiv.appendChild(table);
      resultDiv.classList.remove('hidden');
      errorDiv.classList.add('hidden');
    }
  });