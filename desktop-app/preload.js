// desktop-app/preload.js - Verifică dacă este corect
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsappSearchAPI', {
  importData: () => ipcRenderer.invoke('import-data'),
  searchMessages: (criteria) => ipcRenderer.invoke('search-messages', criteria),
  resetDatabase: () => ipcRenderer.invoke('reset-database')
});