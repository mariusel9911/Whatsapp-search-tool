document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleButton');
    const exportButton = document.getElementById('exportButton');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const messageCount = document.getElementById('messageCount');
    const lastUpdated = document.getElementById('lastUpdated');
    
    let isActive = false;
    
    // Funcție pentru actualizarea interfeței
    function updateUI(active) {
      isActive = active;
      
      if (active) {
        statusIndicator.classList.remove('inactive');
        statusIndicator.classList.add('active');
        statusText.textContent = 'Activ';
        toggleButton.textContent = 'Oprește extragerea';
      } else {
        statusIndicator.classList.remove('active');
        statusIndicator.classList.add('inactive');
        statusText.textContent = 'Inactiv';
        toggleButton.textContent = 'Pornește extragerea';
      }
    }
    
    // Funcție pentru actualizarea statisticilor
    function updateStats() {
      chrome.storage.local.get(['whatsappData', 'lastUpdated'], data => {
        if (data.whatsappData) {
          messageCount.textContent = data.whatsappData.length;
          
          if (data.whatsappData.length > 0) {
            exportButton.disabled = false;
          } else {
            exportButton.disabled = true;
          }
          
          if (data.lastUpdated) {
            const date = new Date(data.lastUpdated);
            lastUpdated.textContent = date.toLocaleString();
          } else {
            lastUpdated.textContent = 'Niciodată';
          }
        } else {
          messageCount.textContent = '0';
          exportButton.disabled = true;
          lastUpdated.textContent = 'Niciodată';
        }
      });
    }
    
    // Verifică starea curentă
    chrome.runtime.sendMessage({ action: "getStatus" }, response => {
      if (response) {
        updateUI(response.isActive);
      }
    });
    
    // Actualizează statisticile la deschiderea popup-ului
    updateStats();
    
    // Verifică dacă există tab-uri WhatsApp Web deschise
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, tabs => {
      if (tabs.length === 0) {
        // Nu există tab-uri WhatsApp Web deschise
        toggleButton.disabled = true;
        toggleButton.title = 'Deschideți WhatsApp Web într-un tab pentru a activa extragerea';
        
        const warningElement = document.createElement('p');
        warningElement.className = 'warning';
        warningElement.textContent = 'Deschideți WhatsApp Web pentru a activa extragerea!';
        
        document.querySelector('.status').after(warningElement);
      }
    });
    
    // Toggle extragerea când butonul este apăsat
    toggleButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "toggleExtraction" }, response => {
        if (response) {
          updateUI(response.isActive);
          
          // Dacă am activat extragerea, configurăm un interval pentru actualizarea statisticilor
          if (response.isActive) {
            const statsInterval = setInterval(() => {
              updateStats();
              
              // Verificăm dacă popup-ul mai este deschis
              if (!document.body) {
                clearInterval(statsInterval);
              }
            }, 2000);
          }
        }
      });
    });
    
    // Exportă datele pentru aplicația desktop
    exportButton.addEventListener('click', () => {
      chrome.storage.local.get('whatsappData', data => {
        if (data.whatsappData && data.whatsappData.length > 0) {
          // Creează un blob cu datele
          const blob = new Blob([JSON.stringify(data.whatsappData, null, 2)], {type: 'application/json'});
          const url = URL.createObjectURL(blob);
          
          // Creează un link de descărcare
          const a = document.createElement('a');
          a.href = url;
          a.download = `whatsapp-data-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          
          // Eliberează URL-ul
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          // Arată un mesaj de succes
          const successElement = document.createElement('div');
          successElement.className = 'success-message';
          successElement.textContent = `Fișier exportat cu succes (${data.whatsappData.length} mesaje)`;
          
          document.querySelector('.stats').after(successElement);
          
          // Elimină mesajul după 3 secunde
          setTimeout(() => {
            if (successElement.parentNode) {
              successElement.parentNode.removeChild(successElement);
            }
          }, 3000);
        }
      });
    });
    
    // Actualizează statisticile când se primesc date noi
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && (changes.whatsappData || changes.lastUpdated)) {
        updateStats();
      }
    });
  });