// Laddar ner bilder för recept som sparades innan bilder lagrades lokalt: npm run images
const db = require('../db');
const { storeImage, isLocalImage } = require('../images');

(async () => {
    const recipes = db.prepare("SELECT id, name, image FROM recipes WHERE image LIKE 'http%'").all();
    const update = db.prepare('UPDATE recipes SET image = ? WHERE id = ?');
    let saved = 0;

    for (const recipe of recipes) {
        const image = await storeImage(recipe.image, recipe.id);
        if (isLocalImage(image)) {
            update.run(image, recipe.id);
            saved++;
            console.log(`✓ ${recipe.name}`);
        }
    }
    console.log(`Klart: ${saved} av ${recipes.length} bilder sparade lokalt`);
})();
