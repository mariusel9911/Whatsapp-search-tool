const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupDatabase } = require('../shared/database');
const dbUtils = require('../shared/database-utils');

let mainWindow;
let database;

// Crearea ferestrei principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'views', 'index.html'));
  
  // Deschide DevTools în modul de dezvoltare
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Inițializare aplicație
// Apoi, înlocuiți funcția app.whenReady() cu această versiune:
app.whenReady().then(async () => {
    try {
      // Verificăm dacă există fișiere marcate pentru ștergere
      dbUtils.checkAndDeleteMarkedFiles();
      
      // Configurează baza de date
      console.log('Setting up database...');
      database = await setupDatabase();
      console.log('Database setup complete');
      
      createWindow();
    } catch (error) {
      console.error('Error during app initialization:', error);
      dialog.showErrorBox(
        'Error Initializing App', 
        `There was an error initializing the application: ${error.message}\n\nPlease restart the application.`
      );
    }
  });

// Gestionare închidere aplicație
app.on('window-all-closed', function () {
  try {
    // Verificăm preferința utilizatorului înainte de a șterge baza de date
    const shouldDeleteDb = mainWindow && 
                          mainWindow.webContents && 
                          mainWindow.webContents.executeJavaScript('localStorage.getItem("deleteDbOnClose") !== "false"');
    
    if (shouldDeleteDb) {
      const dbPath = path.join(app.getPath('userData'), 'whatsapp-data.sqlite');
      if (fs.existsSync(dbPath)) {
        console.log('Removing database file on app close');
        fs.unlinkSync(dbPath);
      }
    }
  } catch (error) {
    console.error('Error checking or removing database file:', error);
  }
  
  if (process.platform !== 'darwin') app.quit();
});

// Gestionare mesaje IPC de la renderer
ipcMain.handle('import-data', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!filePaths || filePaths.length === 0) return { success: false, message: 'Niciun fișier selectat' };

    // Citim și parsăm fișierul JSON
    let fileContent, data;
    try {
      fileContent = fs.readFileSync(filePaths[0], 'utf8');
      data = JSON.parse(fileContent);
    } catch (fileError) {
      console.error('Error reading or parsing JSON file:', fileError);
      return { 
        success: false, 
        message: `Eroare la citirea fișierului: ${fileError.message}` 
      };
    }
    
    // Verificăm dacă datele sunt în formatul așteptat
    if (!Array.isArray(data)) {
      console.error('Invalid data format: Expected an array');
      return { 
        success: false, 
        message: 'Format de date invalid: Se așteaptă un array de mesaje' 
      };
    }
    
    console.log(`Parsed ${data.length} messages from file`);
    
    // Importă datele în baza de date
    try {
      const processedCount = await database.importMessages(data);
      
      return { 
        success: true, 
        message: `${processedCount} mesaje importate cu succes!`,
        count: processedCount
      };
    } catch (importError) {
      console.error('Error importing data to database:', importError);
      return { 
        success: false, 
        message: `Eroare la importul datelor: ${importError.message}` 
      };
    }
  } catch (error) {
    console.error('Unexpected error during import:', error);
    return { 
      success: false, 
      message: `Eroare neașteptată: ${error.message}` 
    };
  }
});

ipcMain.handle('search-messages', async (event, criteria) => {
  try {
    console.log('Searching with criteria:', criteria);
    const results = await database.searchMessages(criteria);
    console.log(`Found ${results.length} results`);
    
    // Verificăm dacă rezultatele conțin obiecte circulare sau nedefinite
    // pentru a preveni erori de serializare
    const safeResults = results.map(result => {
      // Facem o copie simplă, fără referințe circulare
      return {
        id: result.id || '',
        text: result.text || '',
        timestamp: result.timestamp || '',
        sender: result.sender || '',
        chatName: result.chatName || '',
        hasReactions: !!result.hasReactions,
        Reactions: Array.isArray(result.Reactions) 
          ? result.Reactions.map(reaction => ({
              id: reaction.id || 0,
              emoji: reaction.emoji || '👍',
              reactorName: reaction.reactorName || 'Unknown',
              MessageId: reaction.MessageId || ''
            }))
          : []
      };
    });
    
    return { success: true, results: safeResults };
  } catch (error) {
    console.error('Error during search:', error);
    return { success: false, message: error.message };
  }
});

// Handle pentru ștergerea și recrearea bazei de date (utilitară pentru depanare)
ipcMain.handle('reset-database', async () => {
    try {
      const result = await dbUtils.safeDeleteDatabase();
      
      if (result.success) {
        // Afișăm un mesaj suplimentar care explică ce se va întâmpla
        result.message += '\n\nVă rugăm să reporniți aplicația pentru a finaliza procesul.';
      }
      
      return result;
    } catch (error) {
      console.error('Error resetting database:', error);
      return { 
        success: false, 
        message: `Eroare la resetarea bazei de date: ${error.message}`
      };
    }
});

app.on('will-quit', async () => {
  try {
    // Close database connections before exiting
    if (database && database.closeConnections) {
      database.closeConnections();
    }
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
});

// Obține calea către datele aplicației
ipcMain.handle('get-data-path', () => {
  return app.getPath('userData');
});
