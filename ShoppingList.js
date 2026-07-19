const ingredientCategories = require('./ingredientCategories');
const storeLayouts = require('./storeLayouts');

//kollar först längd på ingrediensen för att ex eliminera 'ost' i 'rostad lök' som kan leda till att det hamnar under fel kategori i inklöpslistan
const sortedKeys = Object.keys(ingredientCategories).sort((a, b) => b.length - a.length);

function getCategoryForIngredient(name) { // gör om alla ingredienser till lower case och sedan matchar mot butikens layout och katoegrier
    const normalized = name.toLowerCase().trim();
    if (ingredientCategories[normalized]) return ingredientCategories[normalized];

    for (const key of sortedKeys) {
        if (normalized.includes(key)) return ingredientCategories[key];
    }
    return 'okategoriserad';
}

function sortByStoreLayout(shoppingListItems, storeKey) {
    const layout = storeLayouts[storeKey];
    if (!layout) return shoppingListItems;

    return [...shoppingListItems].sort((a, b) => {
        const indexA = layout.indexOf(a.category);
        const indexB = layout.indexOf(b.category);
        const posA = indexA === -1 ? layout.length : indexA;
        const posB = indexB === -1 ? layout.length : indexB;
        return posA - posB;
    });
}

module.exports = { getCategoryForIngredient, sortByStoreLayout };