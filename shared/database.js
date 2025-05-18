// shared/database.js - Versiune completă cu fix pentru clonarea obiectelor
const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Definește calea către baza de date
const dbPath = app 
  ? path.join(app.getPath('userData'), 'whatsapp-data.sqlite') 
  : path.join(__dirname, '..', 'whatsapp-data.sqlite');

// Configurează Sequelize cu opțiuni îmbunătățite pentru SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
  dialectOptions: {
    // Configurații pentru a gestiona mai bine blocajele
    timeout: 15000, // Mărește timeout-ul la 15 secunde
  },
  pool: {
    max: 5, // Număr maxim de conexiuni
    min: 0, // Număr minim de conexiuni
    acquire: 30000, // Timp (ms) pentru a aștepta înainte de a renunța la încercarea de a obține o conexiune
    idle: 10000, // Timp (ms) de inactivitate înainte de a închide o conexiune
  }
});

// Definirea modelului pentru mesaje
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.STRING(512), // Mărește lungimea pentru a accepta id-uri mai lungi
    primaryKey: true,
    allowNull: false
  },
  text: {
    type: DataTypes.TEXT
  },
  timestamp: {
    type: DataTypes.STRING
  },
  sender: {
    type: DataTypes.STRING
  },
  chatName: {
    type: DataTypes.STRING
  },
  hasReactions: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Definirea modelului pentru reacții
const Reaction = sequelize.define('Reaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  emoji: {
    type: DataTypes.STRING
  },
  reactorName: {
    type: DataTypes.STRING
  }
});

// Relația între Mesaje și Reacții
Message.hasMany(Reaction);
Reaction.belongsTo(Message);

// Funcție pentru configurarea bazei de date
async function setupDatabase() {
  try {
    console.log('Setting up database at:', dbPath);
    
    // Verificăm și reparăm baza de date dacă este necesară
    await checkAndRepairDatabase();
    
    // Sincronizează modelele cu baza de date
    await sequelize.sync();
    console.log('Database synchronized');
    
    return {
      // Close connections safely
      closeConnections() {
        try {
          sequelize.close();
          console.log('Database connections closed');
        } catch (err) {
          console.error('Error closing database:', err);
        }
      },
      
      // Importă mesaje în baza de date
      async importMessages(messagesData) {
        console.log(`Starting import of ${messagesData.length} messages`);
        
        try {
          let processedCount = 0;
          const batchSize = 100; // Procesăm mesajele în loturi mai mici
          
          // Procesăm mesajele în loturi pentru a evita blocajele
          for (let i = 0; i < messagesData.length; i += batchSize) {
            // Creăm o nouă tranzacție pentru fiecare lot
            const transaction = await sequelize.transaction();
            
            try {
              const batch = messagesData.slice(i, i + batchSize);
              
              for (const messageData of batch) {
                // Validăm ID-ul mesajului pentru a evita erori
                if (!messageData.id || typeof messageData.id !== 'string') {
                  console.warn('Skipping message with invalid ID:', messageData);
                  continue;
                }
                
                // Asigurăm că ID-ul nu depășește lungimea maximă
                const messageId = messageData.id.substring(0, 512);
                
                try {
                  // Verifică dacă mesajul există deja
                  let message = await Message.findByPk(messageId, { transaction });
                  
                  if (!message) {
                    // Creează mesajul dacă nu există
                    message = await Message.create({
                      id: messageId,
                      text: messageData.text || '',
                      timestamp: messageData.timestamp || new Date().toISOString(),
                      sender: messageData.sender || 'Unknown',
                      chatName: messageData.chatName || 'Unknown Chat',
                      hasReactions: messageData.hasReactions || false
                    }, { transaction });
                  } else {
                    // Actualizează mesajul dacă există
                    await message.update({
                      text: messageData.text || message.text,
                      timestamp: messageData.timestamp || message.timestamp,
                      sender: messageData.sender || message.sender,
                      chatName: messageData.chatName || message.chatName,
                      hasReactions: messageData.hasReactions || message.hasReactions
                    }, { transaction });
                  }
                  
                  // Verificăm și procesăm reacțiile doar dacă există
                  if (messageData.reactions && Array.isArray(messageData.reactions) && messageData.reactions.length > 0) {
                    // Înainte de a adăuga reacții noi, ștergem reacțiile existente
                    try {
                      await Reaction.destroy({
                        where: { MessageId: messageId },
                        transaction
                      });
                    } catch (deleteError) {
                      console.error(`Error deleting reactions for message ${messageId}:`, deleteError);
                      // Continuăm procesarea, chiar dacă ștergerea eșuează
                    }
                    
                    // Adaugă reacțiile noi
                    for (const reactionData of messageData.reactions) {
                      try {
                        await Reaction.create({
                          emoji: reactionData.emoji || '👍',
                          reactorName: reactionData.reactorName || 'Unknown User',
                          MessageId: messageId
                        }, { transaction });
                      } catch (createError) {
                        console.error(`Error creating reaction for message ${messageId}:`, createError);
                        // Continuăm cu următoarea reacție
                      }
                    }
                  }
                  
                  processedCount++;
                  if (processedCount % 50 === 0) {
                    console.log(`Processed ${processedCount}/${messagesData.length} messages`);
                  }
                } catch (messageError) {
                  console.error(`Error processing message ${messageId}:`, messageError);
                  // Continuăm cu următorul mesaj, în loc să întrerupem întregul proces
                }
              }
              
              // Facem commit pentru lotul curent
              await transaction.commit();
              console.log(`Committed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(messagesData.length/batchSize)}`);
              
              // Mică pauză între loturi pentru a permite eliberarea resurselor
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (batchError) {
              // Dacă apare o eroare în timpul procesării lotului, anulăm tranzacția curentă
              console.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, batchError);
              
              try {
                await transaction.rollback();
                console.log(`Rolled back batch ${Math.floor(i/batchSize) + 1}`);
              } catch (rollbackError) {
                console.error(`Error rolling back batch ${Math.floor(i/batchSize) + 1}:`, rollbackError);
                // Continuăm cu următorul lot chiar dacă rollback-ul eșuează
              }
            }
          }
          
          console.log(`Successfully imported ${processedCount} messages`);
          return processedCount;
        } catch (error) {
          console.error('Error during import:', error);
          throw error;
        }
      },
      
      // Caută mesaje după diverse criterii - MODIFICAT pentru a rezolva problema de clonare
      async searchMessages(criteria) {
        const { startDate, endDate, keywords, hasReaction, reactionEmoji, reactionBy, chatName } = criteria;
        
        // Construiește condițiile de căutare
        const whereConditions = {};
        const includeConditions = [];
        
        // Filtrare după perioadă
        if (startDate || endDate) {
          // Notă: Aceasta este o simplificare, deoarece timestamp-ul WhatsApp poate avea
          // diferite formate. Într-o implementare reală, ar trebui făcută o analiză mai detaliată.
          whereConditions.timestamp = {};
          if (startDate) whereConditions.timestamp[Op.gte] = startDate;
          if (endDate) whereConditions.timestamp[Op.lte] = endDate;
        }
        
        // Filtrare după cuvinte cheie
        if (keywords && keywords.trim()) {
          whereConditions.text = { 
            [Op.like]: `%${keywords.trim()}%` 
          };
        }
        
        // Filtrare după chat
        if (chatName && chatName.trim()) {
          whereConditions.chatName = { 
            [Op.like]: `%${chatName.trim()}%` 
          };
        }
        
        // Filtrare după reacții
        if (hasReaction) {
          whereConditions.hasReactions = true;
          
          // Include reacțiile în rezultate
          const reactionInclude = {
            model: Reaction,
            required: true
          };
          
          // Filtrare după emoji specific
          if (reactionEmoji) {
            reactionInclude.where = { emoji: reactionEmoji };
          }
          
          // Filtrare după persoana care a reacționat
          if (reactionBy && reactionBy.trim()) {
            if (!reactionInclude.where) reactionInclude.where = {};
            reactionInclude.where.reactorName = { 
              [Op.like]: `%${reactionBy.trim()}%` 
            };
          }
          
          includeConditions.push(reactionInclude);
        }
        
        // Execută căutarea
        try {
          const messages = await Message.findAll({
            where: whereConditions,
            include: includeConditions,
            order: [['timestamp', 'DESC']],
            limit: 500, // Limităm rezultatele pentru performanță
            raw: false // Asigură că obținem instanțe Sequelize complete
          });
          
          // MODIFICARE IMPORTANTĂ: Convertim instanțele Sequelize în obiecte JavaScript simple
          // pentru a putea fi transferate prin IPC fără probleme de clonare
          const plainMessages = messages.map(message => {
            // Convertim instanța Sequelize într-un obiect simplu
            return message.get({ plain: true });
          });
          
          return plainMessages;
        } catch (searchError) {
          console.error('Error during search:', searchError);
          throw searchError;
        }
      }
    };
  } catch (error) {
    console.error('Error at setupDatabase:', error);
    throw error;
  }
}

// Verifică și repară baza de date dacă este blocată
async function checkAndRepairDatabase() {
  // Verificăm dacă fișierul bazei de date există
  if (fs.existsSync(dbPath)) {
    try {
      // Încercăm o operațiune simplă pentru a verifica dacă baza de date este funcțională
      await sequelize.authenticate();
      console.log('Database is accessible and working properly');
    } catch (error) {
      console.error('Error accessing database, attempting repair:', error);
      
      // Dacă baza de date este blocată sau coruptă, o recreăm
      try {
        // Redenumim fișierul existent ca backup
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        fs.renameSync(dbPath, backupPath);
        console.log(`Renamed locked database to ${backupPath}`);
        
        // O nouă bază de date va fi creată automat de Sequelize
        console.log('A new database will be created automatically');
      } catch (repairError) {
        console.error('Failed to repair database:', repairError);
        throw repairError;
      }
    }
  } else {
    console.log('Database file does not exist yet, will be created automatically');
  }
}

module.exports = { setupDatabase };