// shared/database-utils.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Funcție pentru a obține calea către baza de date
function getDatabasePath() {
  return app 
    ? path.join(app.getPath('userData'), 'whatsapp-data.sqlite') 
    : path.join(__dirname, '..', 'whatsapp-data.sqlite');
}

// Funcție pentru a șterge sau redenumi în siguranță fișierul bazei de date
async function safeDeleteDatabase() {
  const dbPath = getDatabasePath();
  
  // Verificăm dacă fișierul există
  if (!fs.existsSync(dbPath)) {
    console.log('Database file does not exist. Nothing to delete.');
    return { success: true, message: 'Nu există o bază de date pentru a fi ștearsă.' };
  }
  
  try {
    // Generăm numele pentru backup
    const backupPath = `${dbPath}.backup-${Date.now()}`;
    
    // Folosim redenumirea sincronă pentru a muta
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Created backup at ${backupPath}`);
    
    // Marcăm fișierul pentru ștergere (se va șterge la următoarea rulare)
    fs.writeFileSync(`${dbPath}.delete-me`, 'This file indicates that the database should be deleted on next startup.');
    
    return { 
      success: true, 
      message: `Baza de date a fost resetată cu succes. Un backup a fost creat și baza de date va fi recreată la următoarea pornire a aplicației.`,
      backupPath
    };
  } catch (error) {
    console.error('Error backing up database:', error);
    return { 
      success: false, 
      message: `Nu s-a putut șterge baza de date: ${error.message}. Închideți aplicația și ștergeți manual fișierul: ${dbPath}`
    };
  }
}

// Funcție pentru a verifica și șterge fișierele marcate pentru ștergere
function checkAndDeleteMarkedFiles() {
  const dbPath = getDatabasePath();
  const deleteMePath = `${dbPath}.delete-me`;
  
  if (fs.existsSync(deleteMePath)) {
    console.log('Found database marked for deletion');
    
    try {
      // Verificăm dacă fișierul principal există și încercăm să-l ștergem
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('Successfully deleted marked database file');
      }
      
      // Ștergem și fișierul marker
      fs.unlinkSync(deleteMePath);
      console.log('Removed delete marker file');
      
      return true;
    } catch (error) {
      console.error('Error cleaning up marked files:', error);
      // Continuăm oricum, poate va funcționa data viitoare
      return false;
    }
  }
  
  return false;
}

module.exports = {
  getDatabasePath,
  safeDeleteDatabase,
  checkAndDeleteMarkedFiles
};