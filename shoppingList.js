const ingredientCategories = require('./ingredientCategories');

//kollar först längd på ingrediensen för att ex eliminera 'ost' i 'rostad lök' som kan leda till att det hamnar under fel kategori i inklöpslistan
const sortedKeys = Object.keys(ingredientCategories).sort((a, b) => b.length - a.length);

// Alla kategorier som ingredienser kan hamna i
const knownCategories = [...new Set(Object.values(ingredientCategories)), 'okategoriserad'];

function getCategoryForIngredient(name) { // gör om alla ingredienser till lower case och sedan matchar mot butikens layout och katoegrier
    const normalized = name.toLowerCase().trim();
    if (ingredientCategories[normalized]) return ingredientCategories[normalized];

    for (const key of sortedKeys) {
        if (normalized.includes(key)) return ingredientCategories[key];
    }
    return 'okategoriserad';
}

// layout = kategorierna i den ordning man går genom butiken.
// Kategorier som inte finns i layouten hamnar sist. Sorteringen är stabil, så varorna
// behåller sin inbördes ordning inom en kategori.
function sortByStoreLayout(shoppingListItems, layout) {
    if (!layout || layout.length === 0) return shoppingListItems;

    const position = category => {
        const index = layout.indexOf(category);
        return index === -1 ? layout.length : index;
    };
    return [...shoppingListItems].sort((a, b) => position(a.category) - position(b.category));
}

// Butikens ordning, kompletterad med kategorier den inte känner till än (t.ex. en ny kategori
// i ingredientCategories.js), så att alla går att flytta i redigeringsvyn
function withAllCategories(layout, extraCategories = []) {
    const all = [...layout];
    for (const category of [...knownCategories, ...extraCategories]) {
        if (category && !all.includes(category)) all.push(category);
    }
    return all;
}

module.exports = { getCategoryForIngredient, sortByStoreLayout, withAllCategories };
