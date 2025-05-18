// desktop-app/views/renderer.js - Cu funcționalitate îmbunătățită
document.addEventListener('DOMContentLoaded', () => {
    // Referințe către elementele DOM
    const importBtn = document.getElementById('importBtn');
    const importStatus = document.getElementById('importStatus');
    const searchBtn = document.getElementById('searchBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultCount = document.getElementById('resultCount');
    const resetBtn = document.getElementById('resetBtn');
    const deleteOnCloseCheckbox = document.getElementById('deleteOnClose');
    
    // Salvăm preferința utilizatorului pentru ștergerea bazei de date la închidere
    if (deleteOnCloseCheckbox) {
      deleteOnCloseCheckbox.addEventListener('change', () => {
        localStorage.setItem('deleteDbOnClose', deleteOnCloseCheckbox.checked);
      });
      
      // Restaurăm starea checkbox-ului din localStorage
      const savedPref = localStorage.getItem('deleteDbOnClose');
      if (savedPref !== null) {
        deleteOnCloseCheckbox.checked = savedPref === 'true';
      }
    }
    
    // Handler pentru butonul de import
    importBtn.addEventListener('click', async () => {
      // Dezactivează butonul în timpul importului
      importBtn.disabled = true;
      importBtn.textContent = 'Se importă...';
      importStatus.className = 'status-message';
      importStatus.textContent = 'Se importă datele...';
      
      try {
        // Apelează API-ul pentru import
        const result = await window.whatsappSearchAPI.importData();
        
        if (result.success) {
          importStatus.className = 'status-message success';
          importStatus.textContent = result.message;
        } else {
          importStatus.className = 'status-message error';
          importStatus.textContent = result.message;
        }
      } catch (error) {
        importStatus.className = 'status-message error';
        importStatus.textContent = `Eroare: ${error.message}`;
      } finally {
        // Reactivează butonul
        importBtn.disabled = false;
        importBtn.textContent = 'Importă date';
      }
    });
    
    // Activează/dezactivează câmpurile pentru reacții
    hasReaction.addEventListener('change', () => {
      const reactionFilters = document.querySelector('.reaction-filters');
      reactionFilters.style.display = hasReaction.checked ? 'grid' : 'none';
    });
    
    // Handler pentru butonul de resetare a bazei de date
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm('ATENȚIE: Această acțiune va șterge toate datele importate. Continuați?')) {
          resetBtn.disabled = true;
          resetBtn.textContent = 'Se resetează...';
          
          try {
            // Verificăm dacă funcția este disponibilă
            if (typeof window.whatsappSearchAPI.resetDatabase !== 'function') {
              throw new Error('Funcția resetDatabase nu este disponibilă');
            }
            
            const result = await window.whatsappSearchAPI.resetDatabase();
            
            if (result.success) {
              importStatus.className = 'status-message success';
              importStatus.textContent = result.message;
              
              // Reîmprospătăm interfața
              resultsContainer.innerHTML = '';
              resultCount.textContent = '(0)';
            } else {
              importStatus.className = 'status-message error';
              importStatus.textContent = result.message;
            }
          } catch (error) {
            console.error('Error resetting database:', error);
            importStatus.className = 'status-message error';
            importStatus.textContent = `Eroare: ${error.message}`;
          } finally {
            resetBtn.disabled = false;
            resetBtn.textContent = 'Resetează baza de date';
          }
        }
      });
    }
    
    // Handler pentru butonul de căutare
    searchBtn.addEventListener('click', async () => {
      // Dezactivează butonul în timpul căutării
      searchBtn.disabled = true;
      searchBtn.textContent = 'Se caută...';
      
      // Golește containerul de rezultate
      resultsContainer.innerHTML = '';
      resultCount.textContent = '(0)';
      
      // Construiește criteriile de căutare
      const searchCriteria = {
        startDate: startDate.value || null,
        endDate: endDate.value || null,
        keywords: keywords.value || null,
        chatName: chatName.value || null,
        hasReaction: hasReaction.checked,
        reactionEmoji: reactionEmoji.value || null,
        reactionBy: reactionBy.value || null
      };
      
      try {
        // Apelează API-ul pentru căutare
        const result = await window.whatsappSearchAPI.searchMessages(searchCriteria);
        
        if (result.success) {
          // Actualizează contorul de rezultate
          resultCount.textContent = `(${result.results.length})`;
          
          // Afișează rezultatele
          if (result.results.length > 0) {
            displayResults(result.results);
          } else {
            resultsContainer.innerHTML = '<p class="no-results">Nu s-au găsit rezultate pentru criteriile selectate.</p>';
          }
        } else {
          resultsContainer.innerHTML = `<p class="error">Eroare: ${result.message}</p>`;
        }
      } catch (error) {
        resultsContainer.innerHTML = `<p class="error">Eroare: ${error.message}</p>`;
      } finally {
        // Reactivează butonul
        searchBtn.disabled = false;
        searchBtn.textContent = 'Caută';
      }
    });
    
    // Funcție pentru afișarea rezultatelor
function displayResults(messages) {
  // Verificăm mai întâi dacă avem mesaje valide
  if (!Array.isArray(messages) || messages.length === 0) {
    resultsContainer.innerHTML = '<p class="no-results">Nu s-au găsit rezultate pentru criteriile selectate.</p>';
    return;
  }
  
  // Curățăm containerul înainte de a adăuga rezultate noi
  resultsContainer.innerHTML = '';
  
  messages.forEach(message => {
    try {
      // Verificăm dacă mesajul este valid
      if (!message) {
        console.warn('Skipping invalid message:', message);
        return;
      }
      
      // Creează card pentru mesaj
      const messageCard = document.createElement('div');
      messageCard.className = 'message-card';
      
      // Formatează timestamp-ul cu verificare pentru undefined
      const formattedDate = message.timestamp ? formatDate(message.timestamp) : 'Dată necunoscută';
      
      // Sanitizăm și verificăm datele pentru a evita erori
      const safeSender = message.sender || 'Expeditor necunoscut';
      const safeChatName = message.chatName || 'Conversație necunoscută';
      const safeText = message.text || '(Fără conținut)';
      
      // Construiește header-ul mesajului
      const messageHeader = document.createElement('div');
      messageHeader.className = 'message-header';
      
      messageHeader.innerHTML = `
        <span class="sender">${escapeHtml(safeSender)}</span>
        <span class="timestamp">${escapeHtml(formattedDate)}</span>
        <span class="chat-name">${escapeHtml(safeChatName)}</span>
      `;
      
      // Construiește conținutul mesajului
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      messageContent.textContent = safeText;
      
      // Adaugă reacțiile (dacă există)
      const messageReactions = document.createElement('div');
      messageReactions.className = 'message-reactions';
      
      // Verificăm dacă există reacții și dacă sunt într-un format valid
      const reactions = message.Reactions || [];
      
      if (reactions.length > 0) {
        reactions.forEach(reaction => {
          // Verificăm dacă reacția este validă
          if (!reaction) return;
          
          const reactionTag = document.createElement('span');
          reactionTag.className = 'reaction-tag';
          
          // Sanitizăm datele reacției
          const safeEmoji = reaction.emoji || '👍';
          const safeReactor = reaction.reactorName || 'Utilizator necunoscut';
          
          reactionTag.innerHTML = `
            <span class="emoji">${escapeHtml(safeEmoji)}</span>
            <span class="reactor">${escapeHtml(safeReactor)}</span>
          `;
          messageReactions.appendChild(reactionTag);
        });
      }
      
      // Asamblează cardul pentru mesaj
      messageCard.appendChild(messageHeader);
      messageCard.appendChild(messageContent);
      
      if (reactions.length > 0) {
        messageCard.appendChild(messageReactions);
      }
      
      // Adaugă la container
      resultsContainer.appendChild(messageCard);
    } catch (error) {
      console.error('Error displaying message:', error, message);
    }
  });
}
    
    // Funcție pentru a escapa caracterele HTML periculoase
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      if (typeof str !== 'string') str = String(str);
      
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    
    // Helper pentru formatarea datei
    function formatDate(dateString) {
      if (!dateString) return 'Dată necunoscută';
      
      try {
        // Dacă avem un timestamp ISO standard
        if (dateString.includes('T') && dateString.includes('Z')) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date.toLocaleString();
          }
        }
        
        // Încercăm să interpretăm formatele comune WhatsApp (de ex. "12:30, 17/5/2025")
        const dateParts = dateString.split(', ');// Încercăm să interpretăm formatele comune WhatsApp (de ex. "12:30, 17/5/2025")
        if (dateParts.length === 2) {
          // Probabil avem un format "HH:MM, DD/MM/YYYY"
          const timePart = dateParts[0];
          const datePart = dateParts[1];
          
          // Interpretăm partea de dată
          let day, month, year;
          if (datePart.includes('/')) {
            [day, month, year] = datePart.split('/');
          } else if (datePart.includes('-')) {
            [day, month, year] = datePart.split('-');
          } else if (datePart.includes('.')) {
            [day, month, year] = datePart.split('.');
          }
          
          if (day && month && year) {
            // Construim un obiect Date
            const date = new Date(`${year}-${month}-${day}T${timePart}`);
            if (!isNaN(date.getTime())) {
              return date.toLocaleString();
            }
          }
        }
        
        // Dacă nimic nu funcționează, returnăm string-ul original
        return dateString;
      } catch (e) {
        console.error('Error formatting date:', e);
        return dateString; // Returnează string-ul original dacă nu poate fi parsat
      }
    }
    
    // Inițializare - ascunde filtrele de reacții la început
    document.querySelector('.reaction-filters').style.display = 'none';
  });