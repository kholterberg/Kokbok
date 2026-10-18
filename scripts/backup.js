// Manuell backup: npm run backup  (eller BACKUP_DIR=/någon/mapp npm run backup)
const path = require('path');
const db = require('../db');
const { backupDatabase } = require('../backup');

const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const keep = Number(process.env.BACKUP_KEEP) || 14;

backupDatabase(db, dir, keep)
    .then(dest => console.log(`Backup sparad: ${dest}`))
    .catch(err => {
        console.error(`Backup misslyckades: ${err.message}`);
        process.exit(1);
    });
