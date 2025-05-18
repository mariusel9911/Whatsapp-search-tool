let isActive = false;

// Când extensia se încarcă, resetăm starea
chrome.runtime.onInstalled.addListener(() => {
  isActive = false;
  console.log('WhatsApp Search Tool installed/updated');
});

// Gestionează mesajele de la content script și popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  
  if (request.action === "toggleExtraction") {
    isActive = !isActive;
    console.log(`Extraction toggled to: ${isActive}`);
    
    // Trimite actualizarea de stare la toate tab-urile cu WhatsApp Web
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: "updateStatus", isActive })
            .catch(err => console.error('Error sending message to tab:', err));
        });
      } else {
        console.warn('No WhatsApp Web tabs found');
      }
    });
    
    sendResponse({ isActive });
  } else if (request.action === "saveData") {
    // Salvează datele în storage-ul extensiei
    console.log(`Saving ${request.data.length} messages to storage`);
    
    chrome.storage.local.set({ 
      whatsappData: request.data,
      lastUpdated: new Date().toISOString()
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving data:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        console.log('Data saved successfully');
        sendResponse({ success: true });
      }
    });
    
    return true; // Important pentru a menține conexiunea pentru răspunsul asincron
  } else if (request.action === "getStatus") {
    // Returnează starea curentă a extragerii
    sendResponse({ isActive });
  } else if (request.action === "getStoredData") {
    // Returnează datele stocate
    chrome.storage.local.get(['whatsappData', 'lastUpdated'], (data) => {
      sendResponse({ 
        data: data.whatsappData || [], 
        lastUpdated: data.lastUpdated,
        count: data.whatsappData ? data.whatsappData.length : 0
      });
    });
    
    return true; // Important pentru a menține conexiunea pentru răspunsul asincron
  }
});

// Când un tab WhatsApp Web este încărcat sau reîncărcat, verificăm și actualizăm starea
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
    console.log('WhatsApp Web tab loaded, sending current status');
    
    // Trimitem starea curentă către tab-ul nou încărcat
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: "updateStatus", isActive })
        .catch(err => console.log('Tab not ready yet, will try again on user action'));
    }, 2000);
  }
});

console.log('WhatsApp Search Tool background script loaded');