(async function() {
    // Vérifier que html2canvas est disponible
    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas n\'est pas chargé');
        alert('Erreur: html2canvas n\'est pas disponible');
        return;
    }

    console.log('Capture d\'écran en cours...');

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    overlay.style.zIndex = '9999';
    overlay.style.cursor = 'crosshair';

    document.body.appendChild(overlay);

    let startX, startY, endX, endY;
    let isCapturing = false;

    // Pre-traitement des images pour permettre l'accès cross-origin
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (img.src) {
            img.crossOrigin = 'anonymous';
            // Ajouter un timestamp pour forcer le rechargement avec CORS
            const originalSrc = img.src;
            img.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'timestamp=' + new Date().getTime();
        }
    });

    overlay.addEventListener('mousedown', (e) => {
        startX = e.pageX;
        startY = e.pageY;

        const selection = document.createElement('div');
        selection.id = 'selection-box';
        selection.style.position = 'absolute';
        selection.style.border = '2px dashed white';
        selection.style.zIndex = '10000';
        document.body.appendChild(selection);

        isCapturing = true;
        overlay.addEventListener('mousemove', drawSelection);
    });

    document.addEventListener('mouseup', async (e) => {
        if (!isCapturing) return;

        endX = e.pageX;
        endY = e.pageY;

        const selectionBox = document.getElementById('selection-box');
        if (selectionBox) {
            const rect = selectionBox.getBoundingClientRect();
            document.body.removeChild(selectionBox);

            try {
                // Configuration améliorée de html2canvas
                const canvas = await html2canvas(document.body, {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    scrollX: -window.scrollX,
                    scrollY: -window.scrollY,
                    useCORS: true,
                    allowTaint: false,
                    foreignObjectRendering: false,
                    removeContainer: true,
                    logging: false,
                    imageTimeout: 0,
                    onclone: function(clonedDoc) {
                        // Traiter les images dans le clone également
                        const clonedImages = clonedDoc.querySelectorAll('img');
                        clonedImages.forEach(img => {
                            if (img.src) {
                                img.crossOrigin = 'anonymous';
                            }
                        });
                    }
                });

                try {
                    const base64Image = canvas.toDataURL('image/png', 1.0);
                    await chrome.storage.local.set({ capturedImage: base64Image });
                } catch (error) {
                    // En cas d'échec avec toDataURL, essayer une autre approche
                    canvas.toBlob(async function(blob) {
                        const reader = new FileReader();
                        reader.onloadend = async function() {
                            await chrome.storage.local.set({ 
                                capturedImage: reader.result 
                            });
                            chrome.runtime.sendMessage({ 
                                action: 'reopen-popup',
                                captured: true  
                            });
                        };
                        reader.readAsDataURL(blob);
                    }, 'image/png', 1.0);
                }

                // Nettoyer
                document.body.removeChild(overlay);
                isCapturing = false;

                // Notifier le popup
                chrome.runtime.sendMessage({ 
                    action: 'reopen-popup',
                    captured: true  
                });

                console.log("Capture d'écran terminée");
            } catch (error) {
                console.error('Erreur lors de la capture:', error);
                alert('Erreur lors de la capture de l\'écran. Veuillez réessayer.');
                document.body.removeChild(overlay);
                isCapturing = false;
            }
        }
    });

    function drawSelection(e) {
        const selectionBox = document.getElementById('selection-box');
        if (selectionBox) {
            const width = e.pageX - startX;
            const height = e.pageY - startY;
            selectionBox.style.left = `${Math.min(startX, e.pageX)}px`;
            selectionBox.style.top = `${Math.min(startY, e.pageY)}px`;
            selectionBox.style.width = `${Math.abs(width)}px`;
            selectionBox.style.height = `${Math.abs(height)}px`;
        }
    }
})();