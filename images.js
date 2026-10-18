const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// Bilder sparas lokalt så att kokboken inte går sönder om källsajten tar bort eller blockerar dem
const IMAGE_DIR = process.env.IMAGE_DIR || path.join(__dirname, 'images');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// SVG är medvetet inte med, eftersom den kan innehålla JavaScript
const EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif'
};

async function writeImage(buffer, contentType, recipeId) {
    const ext = EXTENSIONS[contentType];
    if (!ext) throw new Error(`Bildformatet stöds inte: ${contentType}`);
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Bilden är för stor');

    const file = `${recipeId}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(IMAGE_DIR, file), buffer);
    return `/images/${file}`;
}

async function downloadImage(url, recipeId) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: MAX_IMAGE_BYTES,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' }
    });
    const contentType = String(response.headers['content-type'] || '').split(';')[0].trim();
    return writeImage(Buffer.from(response.data), contentType, recipeId);
}

// Uppladdade bilder kommer från webbläsaren som data-URL: "data:image/png;base64,...."
async function saveDataUrlImage(dataUrl, recipeId) {
    const match = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!match) throw new Error('Ogiltig bild');
    return writeImage(Buffer.from(match[2], 'base64'), match[1], recipeId);
}

// Gör om en bild-URL eller en uppladdad bild till en lokal fil.
// Misslyckas det behålls den ursprungliga länken, så att receptet ändå går att spara.
async function storeImage(image, recipeId) {
    if (!image) return '';
    try {
        if (image.startsWith('data:')) return await saveDataUrlImage(image, recipeId);
        if (/^https?:\/\//i.test(image)) return await downloadImage(image, recipeId);
    } catch (err) {
        console.warn(`Kunde inte spara bild för recept ${recipeId}: ${err.message}`);
        return image.startsWith('data:') ? '' : image;
    }
    return image; // redan lokal (/images/...)
}

function isLocalImage(image) {
    return typeof image === 'string' && image.startsWith('/images/');
}

function deleteLocalImage(image) {
    if (!isLocalImage(image)) return;
    // basename hindrar att en manipulerad sökväg som "/images/../recept.db" pekar utanför mappen
    fs.rm(path.join(IMAGE_DIR, path.basename(image)), { force: true }, () => {});
}

module.exports = { IMAGE_DIR, storeImage, deleteLocalImage, isLocalImage };
