// content.js - Versiune finală corectată pentru extracția eficientă din WhatsApp

let observer = null;
let isExtracting = false;
let extractedMessages = {};
let currentChatName = "Unknown Chat";
let lastExtracted = {}; // Pentru evitarea duplicatelor
let debugMode = true; // Activează mesaje de debug

// Funcție pentru logare cu timestamp
function log(message, obj = null) {
  if (debugMode) {
    const timestamp = new Date().toISOString().slice(11, 19);
    if (obj) {
      console.log(`[${timestamp}] WhatsApp Extractor: ${message}`, obj);
    } else {
      console.log(`[${timestamp}] WhatsApp Extractor: ${message}`);
    }
  }
}

// ============= DOM HELPERS - FUNCȚII DE DIAGNOSTIC =============

// Funcție pentru a afișa toate atributele unui element
function dumpElement(element, maxDepth = 1, depth = 0) {
  if (!element || depth > maxDepth) return;
  
  try {
    const attributes = {};
    if (element.attributes) {
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value;
      }
    }
    
    const styles = {};
    if (window.getComputedStyle) {
      const computedStyles = window.getComputedStyle(element);
      ['display', 'position', 'visibility', 'opacity', 'zIndex'].forEach(style => {
        styles[style] = computedStyles[style];
      });
    }
    
    console.log({
      tag: element.tagName,
      id: element.id,
      classes: element.className,
      attributes: attributes,
      textContent: element.textContent ? element.textContent.slice(0, 50) : null,
      styles: styles,
      childCount: element.children ? element.children.length : 0
    });
    
    if (depth < maxDepth && element.children) {
      for (const child of element.children) {
        dumpElement(child, maxDepth, depth + 1);
      }
    }
  } catch (e) {
    console.error('Error dumping element:', e);
  }
}

// Funcție pentru a găsi toate elementele care conțin anumite cuvinte cheie
function findElementsWithText(rootElement, searchText, maxResults = 5) {
  const results = [];
  const searchLower = searchText.toLowerCase();
  
  function traverse(element) {
    if (results.length >= maxResults) return;
    
    try {
      if (element.nodeType === Node.TEXT_NODE) {
        if (element.textContent && element.textContent.toLowerCase().includes(searchLower)) {
          results.push(element.parentElement);
        }
      } else if (element.nodeType === Node.ELEMENT_NODE) {
        const attributes = element.attributes;
        if (attributes) {
          for (let i = 0; i < attributes.length; i++) {
            const attrValue = attributes[i].value;
            if (attrValue && attrValue.toLowerCase().includes(searchLower)) {
              results.push(element);
              break;
            }
          }
        }
        
        // Recursiv prin toți copiii
        for (let i = 0; i < element.childNodes.length && results.length < maxResults; i++) {
          traverse(element.childNodes[i]);
        }
      }
    } catch (e) {
      console.error('Error traversing element:', e);
    }
  }
  
  traverse(rootElement || document.body);
  
  return results;
}

// ============= DETECTAREA NUMELUI CONVERSAȚIEI =============

// Funcție îmbunătățită pentru a detecta numele conversației cu multiple metode
function updateCurrentChatName() {
  // Salvăm numele anterior pentru a verifica dacă s-a schimbat
  const previousName = currentChatName;
  let foundName = false;
  
  try {
    // 1. Metodă directă: caută elementul de conversație
    let titleElement = document.querySelector('header span[dir="auto"][title]');
    if (titleElement && titleElement.title && titleElement.title.length > 1) {
      const title = titleElement.title.trim();
      if (isValidChatName(title)) {
        currentChatName = title;
        log(`Found chat name from title attribute: "${title}"`);
        foundName = true;
      }
    }
    
    // 2. Caută in contactele recente - acest selector este deseori stabil
    if (!foundName) {
      const contactElements = document.querySelectorAll('span.ggj6brxn[title]');
      for (const element of contactElements) {
        if (element && element.title && element.title.length > 1) {
          const title = element.title.trim();
          if (isValidChatName(title)) {
            currentChatName = title;
            log(`Found chat name from contact list: "${title}"`);
            foundName = true;
            break;
          }
        }
      }
    }
    
    // 3. Caută direct în titlul paginii
    if (!foundName && document.title) {
      // Curăță titlul paginii de prefixe/sufixe
      const title = document.title
        .replace(/^\(\d+\)\s+/, '')  // Elimină "(1) " din față
        .replace(/\s*[·\-]\s*WhatsApp(\s+Web)?$/, '')  // Elimină " - WhatsApp" de la sfârșit
        .trim();
        
      if (isValidChatName(title)) {
        currentChatName = title;
        log(`Found chat name from page title: "${title}"`);
        foundName = true;
      }
    }
    
    // 4. METODA AGRESIVĂ: Găsește orice element din header care are text
    if (!foundName) {
      const headerElements = document.querySelectorAll('header span[dir="auto"], header div[dir="auto"]');
      for (const element of headerElements) {
        if (element && element.textContent) {
          const text = element.textContent.trim();
          if (isValidChatName(text)) {
            currentChatName = text;
            log(`Found chat name from header text: "${text}"`);
            foundName = true;
            break;
          }
        }
      }
    }
    
    // 5. METODA EXTREMĂ: Caută primul div din interiorul header-ului
    if (!foundName) {
      const firstHeaderDiv = document.querySelector('header div');
      if (firstHeaderDiv) {
        // Afișează structura header-ului pentru debug
        log('Header structure:');
        dumpElement(firstHeaderDiv, 3);
        
        // Caută direct orice text valid din header
        const headerText = firstHeaderDiv.textContent.trim();
        const firstLine = headerText.split('\n')[0].trim();
        
        if (isValidChatName(firstLine)) {
          currentChatName = firstLine;
          log(`Extracted chat name directly from header: "${firstLine}"`);
          foundName = true;
        }
      }
    }
    
    // 6. Caută în atributele data-* care ar putea conține numele conversației
    if (!foundName) {
      const elements = document.querySelectorAll('[data-testid="conversation-info-header"], [data-testid="chat-title"]');
      for (const element of elements) {
        if (element) {
          const text = element.textContent.trim();
          if (isValidChatName(text)) {
            currentChatName = text;
            log(`Found chat name from data attribute: "${text}"`);
            foundName = true;
            break;
          }
        }
      }
    }
    
    // Verifică dacă numele s-a schimbat
    if (currentChatName !== previousName) {
      log(`Chat name updated from "${previousName}" to "${currentChatName}"`);
    }
  } catch (e) {
    console.error('Error detecting chat name:', e);
  }
  
  return currentChatName;
}

// Funcție pentru a valida un nume de chat
function isValidChatName(name) {
  if (!name) return false;
  
  // Verifică dacă numele este valid
  return name.length >= 2 && 
         name.length < 40 &&
         name !== 'WhatsApp' && 
         name !== 'web.whatsapp.com' &&
         !name.includes('online') && 
         !name.includes('last seen') &&
         !name.includes('typing...') &&
         !name.includes('click here for contact info') &&
         !name.includes('New chat');
}

// Funcție pentru a verifica dacă suntem într-un chat de grup
function isGroupChat() {
  return document.querySelector('[data-testid="group-info-drawer-subject-section"]') ||
         document.querySelector('[data-testid="group-info"]') ||
         document.querySelector('.g0rxnol2.ln8gz9je.jggour7j.gt60zsk1') ||
         document.querySelector('[data-icon="group"]') ||
         (currentChatName && 
          (currentChatName.includes('group') || 
           currentChatName.includes(',') || 
           document.querySelectorAll('header img').length > 1));
}


// ============= EXTRAGEREA REACȚIILOR - VERSIUNE AGRESIVĂ =============

// Funcție complet rescrisă pentru a detecta orice posibilă reacție
function extractReactions(messageNode) {
  const reactions = [];
  
  try {
    log(`Searching for reactions in message: "${messageNode.textContent.slice(0, 20)}..."`);
    
    // Verifică toată structura HTML pentru cuvinte cheie legate de reacții
    const html = messageNode.innerHTML || "";
    const hasReactionInHtml = 
      html.includes('reaction') || 
      html.includes('emoji') || 
      html.includes('j5u9ga5u') || 
      html.includes('bxcbqydf') ||
      html.includes('qfejxiq4') ||
      html.includes('rj0u9zwx');
    
    if (hasReactionInHtml) {
      log(`Message HTML contains reaction keywords`);
      
      // Afișează structura elementului pentru debug
      log('Message structure with reaction:');
      dumpElement(messageNode, 2);
    }
    
    // 1. Metodă directă: Caută toate elementele care ar putea fi reacții
    const reactionContainers = messageNode.querySelectorAll(
      '.j5u9ga5u, .qohphz7f, .bxcbqydf, .rj0u9zwx, [data-testid="reaction-bubble"], ' +
      '[data-icon="reaction"], [data-testid^="reaction-"], .k3qa53x1, [data-icon="msg-reaction"]'
    );
    
    if (reactionContainers && reactionContainers.length > 0) {
      log(`Found ${reactionContainers.length} potential reaction containers`);
      
      for (const container of reactionContainers) {
        let emoji = '👍'; // Valoare implicită
        let reactorName = 'Unknown';
        
        // Extrage emoji din conținutul textual al containerului
        if (container.textContent && container.textContent.length < 5) {
          emoji = container.textContent.trim();
        }
        
        // Verifică aria-label pentru detalii
        if (container.getAttribute('aria-label')) {
          const ariaLabel = container.getAttribute('aria-label');
          log(`Found aria-label: ${ariaLabel}`);
          
          // Încearcă să extragă numele reactorului
          if (ariaLabel.includes('reacted with')) {
            reactorName = ariaLabel.split('reacted with')[0].trim();
          } else if (ariaLabel.includes('Reaction:')) {
            reactorName = ariaLabel.split('Reaction:')[0].trim();
          }
        }
        
        // Verifică pentru img-uri care ar putea conține emoji-uri
        const imgEmoji = container.querySelector('img');
        if (imgEmoji && imgEmoji.alt) {
          emoji = imgEmoji.alt;
        }
        
        // Verifică pentru atribute data-testid care ar putea conține emoji-uri
        if (container.getAttribute('data-testid') && container.getAttribute('data-testid').includes('reaction-')) {
          emoji = container.getAttribute('data-testid').replace('reaction-', '');
        }
        
        // Adaugă reacția la lista de reacții
        if (emoji) {
          reactions.push({
            emoji: emoji,
            reactorName: reactorName
          });
          log(`Added reaction: ${emoji} from ${reactorName}`);
        }
      }
    } else {
      log(`No reaction containers found using standard selectors`);
    }
    
    // 2. Metoda agresivă: Caută orice elemente care ar putea fi reacții după conținutul lor
    if (reactions.length === 0 && hasReactionInHtml) {
      log(`Using aggressive method to find reactions`);
      
      // Caută elemente care conțin cuvinte cheie legate de reacții
      const reactionElements = findElementsWithText(messageNode, "reaction");
      
      for (const element of reactionElements) {
        log(`Found element with reaction text:`, element);
        
        // Verifică textul elementului pentru emoji
        if (element.textContent && element.textContent.length < 5) {
          reactions.push({
            emoji: element.textContent.trim(),
            reactorName: 'Unknown User'
          });
          log(`Added reaction from text: ${element.textContent.trim()}`);
        }
        
        // Verifică pentru aria-label
        if (element.getAttribute('aria-label')) {
          const ariaLabel = element.getAttribute('aria-label');
          log(`Found aria-label: ${ariaLabel}`);
          
          // Încearcă să extragă emoji și numele reactorului
          if (ariaLabel.includes('reacted with')) {
            const parts = ariaLabel.split('reacted with');
            if (parts.length === 2) {
              reactions.push({
                emoji: parts[1].trim() || '👍',
                reactorName: parts[0].trim() || 'Unknown User'
              });
              log(`Added reaction from aria-label: ${parts[1].trim()} from ${parts[0].trim()}`);
            }
          }
        }
      }
    }
    
    // 3. Metoda extremă: Verifică pentru orice atribut care ar putea indica o reacție
    if (reactions.length === 0 && hasReactionInHtml) {
      log(`Using extreme method to find reactions`);
      
      // Caută toate elementele care au atribute care conțin reaction
      const elements = messageNode.querySelectorAll('*');
      for (const element of elements) {
        for (const attr of element.attributes) {
          if (attr.value && attr.value.includes('reaction')) {
            log(`Found element with reaction attribute: ${attr.name}="${attr.value}"`);
            
            // Adaugă o reacție implicită
            reactions.push({
              emoji: '👍',
              reactorName: 'Unknown User'
            });
            log(`Added default reaction from attribute`);
            break;
          }
        }
        
        // Verifică pentru clase care ar putea indica reacții
        if (element.className && typeof element.className === 'string' && 
            (element.className.includes('reaction') || 
             element.className.includes('j5u9ga5u') || 
             element.className.includes('bxcbqydf'))) {
          
          log(`Found element with reaction class: ${element.className}`);
          
          // Verifică pentru emoji în text
          if (element.textContent && element.textContent.length < 5) {
            reactions.push({
              emoji: element.textContent.trim(),
              reactorName: 'Unknown User'
            });
            log(`Added reaction from class element text: ${element.textContent.trim()}`);
          } else {
            // Adaugă o reacție implicită
            reactions.push({
              emoji: '👍',
              reactorName: 'Unknown User'
            });
            log(`Added default reaction from class`);
          }
        }
      }
    }
    
    // Înregistrează rezultatul final
    if (reactions.length > 0) {
      log(`Found ${reactions.length} reactions in total:`, reactions);
    } else {
      log(`No reactions found in this message`);
    }
    
    return reactions;
  } catch (e) {
    console.error('Error extracting reactions:', e);
    return [];
  }
}

// ============= DETECTAREA TIPULUI MESAJULUI ȘI EXPEDITORULUI =============

// Funcție îmbunătățită pentru a detecta dacă un mesaj este trimis sau primit
function detectMessageType(messageNode) {
  try {
    // Verifică rapid clasa pentru out/in
    if (messageNode.classList) {
      if (messageNode.classList.contains('message-out')) return 'outgoing';
      if (messageNode.classList.contains('message-in')) return 'incoming';
    }
    
    // Verifică data-testid
    if (messageNode.getAttribute('data-testid')) {
      const testId = messageNode.getAttribute('data-testid');
      if (testId.includes('msg-outgoing')) return 'outgoing';
    }
    
    // Verifică pentru clase mai specifice
    for (const className of ['_1-FMR', '_22Msk', 'message-2qnpza']) {
      if (messageNode.classList && messageNode.classList.contains(className)) {
        // Verifică dacă acestea sunt de ieșire sau intrare
        if (window.getComputedStyle(messageNode).marginLeft === 'auto' ||
            window.getComputedStyle(messageNode).alignSelf === 'flex-end') {
          return 'outgoing';
        }
      }
    }
    
    // Verifică pentru selectori specifici de ieșire
    if (messageNode.querySelector('.to2l77zo') || 
        messageNode.matches('[data-outgoing="true"]')) {
      return 'outgoing';
    }
    
    // Metodă alternativă: Verifică poziția CSS 
    const style = window.getComputedStyle(messageNode);
    if (style.float === 'right' || 
        style.right === '0px' || 
        style.marginLeft === 'auto' || 
        style.alignSelf === 'flex-end') {
      return 'outgoing';
    }
    
    // Verifică culoarea fundalului (mesajele trimise au deseori o culoare diferită)
    const bgColor = style.backgroundColor;
    if (bgColor.includes('202c33') || bgColor.includes('005c4b')) {
      return 'outgoing';
    }
    
    // Dacă niciunul din criteriile de mai sus nu se potrivește, considerăm mesajul ca fiind primit
    return 'incoming';
  } catch (e) {
    console.error('Error detecting message type:', e);
    return 'unknown';
  }
}

// Funcție îmbunătățită pentru extragerea numelui expeditorului
function extractSenderName(messageNode, messageType) {
  try {
    // Pentru mesajele trimise, expeditorul este întotdeauna "You"
    if (messageType === 'outgoing') {
      return 'You';
    }
    
    // Pentru mesajele primite, încercăm să extragem numele
    
    // 1. Verifică pentru atributul data-pre-plain-text care conține deseori numele expeditorului
    const prePlainTextElement = messageNode.querySelector('[data-pre-plain-text]');
    if (prePlainTextElement) {
      const prePlainText = prePlainTextElement.getAttribute('data-pre-plain-text');
      if (prePlainText) {
        // Formatul obișnuit este "[HH:MM] Sender:"
        const match = prePlainText.match(/\]\s*([^:]+):/);
        if (match && match[1]) {
          const name = match[1].trim();
          if (name.length > 1 && name !== 'Unknown Sender') {
            log(`Extracted sender name from data-pre-plain-text: "${name}"`);
            return name;
          }
        }
      }
    }
    
    // 2. Verifică pentru header-ul mesajului care poate conține numele expeditorului
    const senderHeaderElement = messageNode.querySelector(
      '.ib80kmfu span[dir="auto"], .a8nywdso span[dir="auto"], .copyable-text span[dir="auto"], ' +
      '.kvKRZ, ._3FuDI, .ZObjg, [data-testid="msg-meta"] span'
    );
    
    if (senderHeaderElement) {
      const senderText = senderHeaderElement.textContent.trim();
      if (senderText && 
          !senderText.match(/^\d{1,2}:\d{2}(?: [AP]M)?$/) && 
          senderText !== 'Today' && 
          senderText !== 'Yesterday' && 
          !senderText.includes('click here')) {
        // Curăță textul de timestamp-uri
        const cleanName = senderText
          .replace(/\d{1,2}:\d{2}(?: [AP]M)?$/, '')
          .replace(/\[\d{1,2}:\d{2}(?: [AP]M)?\]/, '')
          .trim();
          
        if (cleanName.length > 1) {
          log(`Extracted sender name from header: "${cleanName}"`);
          return cleanName;
        }
      }
    }
    
    // 3. Folosește numele conversației dacă nu suntem într-un grup
    updateCurrentChatName(); // Actualizează numele conversației
    
    // Verifică dacă nu suntem într-un grup
    const isGroup = isGroupChat();
    
    if (!isGroup && currentChatName && currentChatName !== 'Unknown Chat') {
      log(`Using chat name as sender: "${currentChatName}"`);
      return currentChatName;
    }
    
    // 4. Metodă agresivă: Caută direct după expeditor în mesaj
    const potentialSenderElements = messageNode.querySelectorAll('span[dir="auto"]');
    for (const element of potentialSenderElements) {
      const text = element.textContent.trim();
      if (text && 
          text.length > 1 && 
          text.length < 30 && 
          !text.match(/^\d{1,2}:\d{2}(?: [AP]M)?$/) && 
          text !== 'Today' && 
          text !== 'Yesterday' && 
          !text.includes('click here')) {
        log(`Extracted sender name from span: "${text}"`);
        return text;
      }
    }
    
    // 5. Dacă tot nu găsim un nume, verificăm numele pentru contactul deschis
    const contactInfoHeader = document.querySelector('[data-testid="drawer-title"] span');
    if (contactInfoHeader) {
      const contactName = contactInfoHeader.textContent.trim();
      if (contactName && contactName !== 'Contact info' && contactName.length > 1) {
        log(`Extracted sender name from contact info: "${contactName}"`);
        return contactName;
      }
    }
    
    // Dacă toate metodele eșuează, returnăm "Unknown Sender"
    return 'Unknown Sender';
  } catch (e) {
    console.error('Error extracting sender name:', e);
    return 'Unknown Sender';
  }
}

// ============= EXTRAGEREA MESAJELOR =============

// Funcție îmbunătățită pentru extragerea unui mesaj
function extractMessageData(messageNode) {
  // Verificăm dacă nodul este un element DOM valid
  if (!messageNode || !(messageNode instanceof Element)) return null;
  
  try {
    // Extragem textul mesajului
    const messageTextElement = messageNode.querySelector('.selectable-text, ._11JPr, .copyable-text');
    let messageText = '';
    
    if (messageTextElement) {
      messageText = messageTextElement.innerText || messageTextElement.textContent || '';
    }
    
    // Verificăm pentru conținut media
    const hasMedia = messageNode.querySelector('img:not(.emoji), video, audio, [data-icon="document"], [data-testid="audio-play"]') !== null;
    
    // Ignorăm mesajele goale care nu au nici conținut media
    if (!messageText && !hasMedia) {
      return null;
    }
    
    // Detectăm tipul mesajului (trimis sau primit)
    const messageType = detectMessageType(messageNode);
    log(`Processing message: "${messageText.slice(0, 20)}..." type: ${messageType}`);
    
    // Generăm un ID unic pentru mesaj
    const currentTimestamp = Date.now();
    const contentHash = messageText.slice(0, 20).replace(/\s+/g, '');
    const messageId = `msg_${currentTimestamp}_${contentHash}_${messageType}`;
    
    // Verificăm pentru duplicate folosind o "amprentă" a mesajului
    const messageSignature = `${messageText}_${messageType}_${hasMedia}`;
    
    if (lastExtracted[messageSignature] && 
        (currentTimestamp - lastExtracted[messageSignature]) < 10000) {
      log(`Skipping duplicate message: "${messageText.slice(0, 20)}..."`);
      return null;
    }
    
    // Verificăm pentru duplicate de același mesaj cu tip diferit
    for (const existingMsgId in extractedMessages) {
      const existingMsg = extractedMessages[existingMsgId];
      if (existingMsg.text === messageText && 
          existingMsg.messageType !== messageType &&
          Math.abs(new Date(existingMsg.timestamp).getTime() - currentTimestamp) < 10000) {
        log(`Found conflicting message type for "${messageText.slice(0, 20)}...". Ignoring duplicate.`);
        return null;
      }
    }
    
    // Înregistrăm această extracție
    lastExtracted[messageSignature] = currentTimestamp;
    
    // Actualizăm numele conversației
    updateCurrentChatName();
    
    // Extragem expeditorul
    const sender = extractSenderName(messageNode, messageType);
    
    // Extragem reacțiile - IMPORTANT!
    const reactions = extractReactions(messageNode);
    const hasReactions = reactions.length > 0;
    
    // Creăm obiectul mesaj
    const messageData = {
      id: messageId,
      text: messageText,
      timestamp: new Date(currentTimestamp).toISOString(),
      sender: sender,
      chatName: currentChatName,
      messageType: messageType,
      hasMedia: hasMedia,
      hasReactions: hasReactions,
      reactions: reactions
    };
    
    // Salvăm mesajul în colecția noastră
    extractedMessages[messageId] = messageData;
    
    log(`Extracted message: ID=${messageId}, sender=${sender}, hasReactions=${hasReactions}`);
    
    return messageData;
  } catch (e) {
    console.error('Error extracting message data:', e);
    return null;
  }
}

// ============= FUNCȚII PRINCIPALE =============

// Funcție pentru a găsi containerul principal pentru mesaje
function findMainContainer() {
  // Lista de selectori posibili pentru containerul principal
  const selectors = [
    '#main', 
    '.two', 
    '._2Ts6i',
    '._3K4-L',
    '#app .app-wrapper-web ._3QfZd',
    '.app-wrapper-web .two',
    '.app-wrapper-web [role="region"]',
    '.app-wrapper-web [role="application"]',
    '[data-testid="conversation-panel-body"]',
    '.tvf2evcx',
    '.g0rxnol2'
  ];
  
  // Încercăm fiecare selector
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      log(`Found main container using selector: ${selector}`);
      return element;
    }
  }
  
  // Dacă nu găsim niciun selector cunoscut, folosim body
  log('Could not find main container, attempting to use body');
  return document.body;
}

// Funcție pentru a începe extragerea mesajelor
function startExtraction() {
  if (isExtracting) return;
  
  log('Starting message extraction...');
  
  // Așteptăm încărcarea completă a paginii
  if (document.readyState !== 'complete') {
    log('Document not fully loaded, waiting...');
    window.addEventListener('load', () => {
      setTimeout(startExtraction, 2000);
    });
    return;
  }
  
  isExtracting = true;
  
  // Detectăm numele conversației curente
  updateCurrentChatName();
  
  // Configurăm un observer pentru a detecta schimbările de conversație
  const headerObserver = new MutationObserver(() => {
    updateCurrentChatName();
  });
  
  // Observăm header-ul pentru a detecta schimbările de conversație
  const header = document.querySelector('header');
  if (header) {
    headerObserver.observe(header, { 
      childList: true, 
      subtree: true,
      characterData: true
    });
  }
  
  // Găsim containerul principal pentru mesaje
  const mainContainer = findMainContainer();
  
  if (!mainContainer) {
    console.error('Could not find main container, extraction failed');
    isExtracting = false;
    return;
  }
  
  // Căutăm mesajele existente
  log('Searching for existing messages...');
  
  // Lista de selectori posibili pentru mesaje
  const messageSelectors = [
    'div.message-in, div.message-out',
    '._22Msk',
    '._1-FMR',
    '._2AOIt',
    '.message',
    '[role="row"]',
    '.focusable-list-item',
    '[data-testid="msg-container"]',
    '.o1ehqsrh',
    '.lhggkp7q',
    '.l7jjieqr',
    '[data-testid^="msg_"]'
  ];
  
  let foundMessages = false;
  
  // Încercăm să găsim mesaje folosind fiecare selector
  for (const selector of messageSelectors) {
    const messages = document.querySelectorAll(selector);
    if (messages && messages.length > 0) {
      log(`Found ${messages.length} messages using selector: ${selector}`);
      
      // Pentru fiecare mesaj găsit, extragem datele
      messages.forEach(msg => {
        const messageData = extractMessageData(msg);
        if (messageData) {
          foundMessages = true;
        }
      });
      
      // Odată ce am găsit mesaje cu un selector, nu mai folosim ceilalți selectori
      if (foundMessages) {
        break;
      }
    }
  }
  
  if (!foundMessages) {
    log('No messages found with standard selectors, will rely on observer');
  }
  
  // Configurăm un observer pentru a detecta noi mesaje sau reacții
  log('Setting up mutation observer...');
  
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver(mutations => {
    let messageCount = 0;
    
    // Verificăm dacă numele conversației s-a schimbat
    updateCurrentChatName();
    
    mutations.forEach(mutation => {
      // Verificăm nodurile adăugate
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Verificăm dacă nodul este un mesaj sau conține elemente de reacții
            const isMessageNode = node.classList && (
              node.classList.contains('message-in') || 
              node.classList.contains('message-out') ||
              node.classList.contains('_22Msk') ||
              node.classList.contains('_1-FMR') ||
              node.classList.contains('message') ||
              node.matches('[data-testid="msg-container"]') ||
              node.classList.contains('o1ehqsrh') ||
              node.classList.contains('lhggkp7q')
            );
            
            const hasReactionElements = node.innerHTML && (
              node.innerHTML.includes('reaction') || 
              node.innerHTML.includes('emoji') || 
              node.innerHTML.includes('j5u9ga5u') || 
              node.innerHTML.includes('bxcbqydf') || 
              node.innerHTML.includes('qfejxiq4') ||
              node.innerHTML.includes('rj0u9zwx')
            );
            
            if (isMessageNode) {
              // Dacă este un nod de mesaj, îl extragem direct
              const result = extractMessageData(node);
              if (result) messageCount++;
            } else if (hasReactionElements) {
              // Dacă are elemente de reacții, găsim mesajul părinte
              log(`Found node with reaction elements`);
              
              // Verificăm dacă este o reacție și găsim mesajul părinte
              let parentMessage = node;
              while (parentMessage && 
                    !parentMessage.classList.contains('message') && 
                    !parentMessage.classList.contains('_22Msk') &&
                    !parentMessage.classList.contains('_1-FMR') &&
                    !parentMessage.classList.contains('message-in') &&
                    !parentMessage.classList.contains('message-out') &&
                    !parentMessage.matches('[data-testid="msg-container"]')) {
                parentMessage = parentMessage.parentElement;
              }
              
              // Dacă am găsit un mesaj părinte, îl reextragem
              if (parentMessage) {
                log(`Found parent message for reaction, re-extracting message`);
                const result = extractMessageData(parentMessage);
                if (result) messageCount++;
              }
            } else {
              // Verificăm dacă sunt mesaje în nodul adăugat
              const nestedMessages = node.querySelectorAll(messageSelectors.join(', '));
              if (nestedMessages && nestedMessages.length > 0) {
                log(`Found ${nestedMessages.length} nested messages`);
                nestedMessages.forEach(msg => {
                  const result = extractMessageData(msg);
                  if (result) messageCount++;
                });
              }
            }
          }
        });
      }
      
      // Verificăm pentru modificări în atribute care ar putea indica reacții
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'aria-label' || 
           mutation.attributeName === 'data-testid' || 
           mutation.attributeName === 'class')) {
        
        const target = mutation.target;
        
        // Verificăm dacă modificarea este legată de reacții
        if ((target.getAttribute(mutation.attributeName) || '').includes('reaction') ||
            (mutation.attributeName === 'class' && 
             ((target.className || '').includes('j5u9ga5u') || 
              (target.className || '').includes('bxcbqydf')))) {
          
          log(`Detected reaction via attribute change: ${mutation.attributeName}`);
          
          // Găsim mesajul părinte
          let parentMessage = target;
          while (parentMessage && 
                !parentMessage.classList.contains('message') && 
                !parentMessage.classList.contains('_22Msk') &&
                !parentMessage.classList.contains('_1-FMR') &&
                !parentMessage.classList.contains('message-in') &&
                !parentMessage.classList.contains('message-out') &&
                !parentMessage.matches('[data-testid="msg-container"]')) {
            parentMessage = parentMessage.parentElement;
          }
          
          // Dacă am găsit un mesaj părinte, îl reextragem
          if (parentMessage) {
            log(`Found parent message for reaction, re-extracting message`);
            const result = extractMessageData(parentMessage);
            if (result) messageCount++;
          }
        }
      }
    });
    
    // Trimitem datele la background script
    if (messageCount > 0 || Object.keys(extractedMessages).length % 20 === 0) {
      log(`Processed ${messageCount} messages, total: ${Object.keys(extractedMessages).length}`);
      
      // Trimitem datele la background script
      chrome.runtime.sendMessage({
        action: "saveData",
        data: Object.values(extractedMessages)
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error sending data to background:', chrome.runtime.lastError);
        } else if (response && response.success) {
          log(`Successfully saved ${Object.keys(extractedMessages).length} messages`);
        }
      });
    }
  });
  
  // Început observarea DOM-ului pentru modificări
  observer.observe(mainContainer, { 
    childList: true, 
    subtree: true,
    attributes: true, 
    attributeFilter: ['data-id', 'aria-label', 'data-testid', 'data-pre-plain-text', 'class']
  });
  
  log(`Extraction started, observing ${mainContainer.tagName} element`);
  
  // Periodic, verificăm pentru reacții pe mesajele vizibile
  setInterval(() => {
    if (!isExtracting) return;
    
    // Actualizăm numele conversației
    updateCurrentChatName();
    
    // Verificăm mesajele vizibile pentru reacții
    log('Checking visible messages for reactions...');
    
    // Găsim toate mesajele vizibile în conversație
    const visibleMessages = document.querySelectorAll(
      '.message, ._22Msk, ._1-FMR, .focusable-list-item, [data-testid="msg-container"]'
    );
    
    // Verificăm doar ultimele 10 mesaje (pentru eficiență)
    if (visibleMessages && visibleMessages.length > 0) {
      const recentMessages = Array.from(visibleMessages).slice(-10);
      log(`Checking ${recentMessages.length} recent messages for reactions`);
      
      // Pentru fiecare mesaj, extragem din nou datele pentru a detecta reacții noi
      recentMessages.forEach(msg => {
        // Verificăm dacă mesajul are elemente de reacții
        if (msg.innerHTML && (
            msg.innerHTML.includes('reaction') || 
            msg.innerHTML.includes('emoji') || 
            msg.innerHTML.includes('j5u9ga5u') || 
            msg.innerHTML.includes('bxcbqydf') ||
            msg.innerHTML.includes('qfejxiq4') ||
            msg.innerHTML.includes('rj0u9zwx'))) {
          
          log(`Detected potential reaction in visible message`);
          extractMessageData(msg); // Re-extragem datele mesajului
        }
      });
    }
  }, 5000); // Verificăm la fiecare 5 secunde
}

// ============= OPRIREA EXTRACȚIEI ȘI EVENT LISTENERS =============

// Funcție pentru a opri extragerea
function stopExtraction() {
  if (!isExtracting) return;
  
  log('Stopping message extraction...');
  isExtracting = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Ascultă mesaje de la background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log(`Received message from background: ${request.action}`);
  
  if (request.action === "updateStatus") {
    if (request.isActive) {
      startExtraction();
    } else {
      stopExtraction();
    }
    sendResponse({ success: true });
  } else if (request.action === "getExtractedData") {
    sendResponse({ 
      data: Object.values(extractedMessages),
      count: Object.keys(extractedMessages).length
    });
  }
  
  return true; // Keep the message channel open for async response
});

// Inițializare
log('WhatsApp Search Tool content script loaded');

// La încărcarea completă a paginii, verificăm dacă extragerea este activă
window.addEventListener('load', () => {
  // Verificăm starea extragerii
  chrome.runtime.sendMessage({ action: "getStatus" }, response => {
    if (response && response.isActive) {
      // Dacă extragerea este activă, o pornim
      startExtraction();
    }
  });
});