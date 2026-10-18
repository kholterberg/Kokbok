const fs = require('fs');
const path = require('path');

// Tar en säker kopia av databasen medan servern kör (SQLites online backup-API),
// och behåller bara de senaste `keep` kopiorna.
async function backupDatabase(db, dir, keep = 14) {
    fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const dest = path.join(dir, `recept-${stamp}.db`);
    await db.backup(dest);

    const backups = fs.readdirSync(dir)
        .filter(file => /^recept-[\d-]+\.db$/.test(file))
        .sort(); // tidsstämpeln i namnet gör att alfabetisk ordning = äldst först
    for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
        fs.rmSync(path.join(dir, old));
    }
    return dest;
}

// Automatisk backup om BACKUP_DIR är satt. Första körningen sker en minut efter start.
function scheduleBackups(db) {
    const dir = process.env.BACKUP_DIR;
    if (!dir) return;

    const hours = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;
    const keep = Number(process.env.BACKUP_KEEP) || 14;

    const run = () => backupDatabase(db, dir, keep)
        .then(dest => console.log(`Backup sparad: ${dest}`))
        .catch(err => console.error(`Backup misslyckades: ${err.message}`));

    setTimeout(run, 60 * 1000).unref();
    setInterval(run, hours * 60 * 60 * 1000).unref();
    console.log(`Automatisk backup var ${hours}:e timme till ${dir} (behåller ${keep} st)`);
}

module.exports = { backupDatabase, scheduleBackups };
