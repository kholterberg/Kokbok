const express = require('express');
const { getScraperForUrl } = require('./scrapers');
const { getCategoryForIngredient, sortByStoreLayout } = require('./shoppingList');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        const scraper = getScraperForUrl(url);

        if (!scraper) {
            return res.status(400).json({ error: 'Sajten stöds inte än' });
        }

        const data = await scraper(url);
        if (!data) {
            return res.status(404).json({ error: 'Inget recept hittades' });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shopping-list', (req, res) => {
    try {
        const { recipes } = req.body;
        const merged = {};

        for (const recipe of recipes) {
            for (const ingredient of recipe.ingredients) {
                const category = getCategoryForIngredient(ingredient.name);
                const key = ingredient.name.toLowerCase().trim();

                if (merged[key]) {
                    merged[key].amount += ingredient.amount || 0;
                } else {
                    merged[key] = {
                        name: ingredient.name,
                        amount: ingredient.amount || 0,
                        unit: ingredient.unit,
                        category
                    };
                }
            }
        }

        const list = sortByStoreLayout(Object.values(merged), 'ica-maxi-valsviken');

        // Rensa gammal lista, spara den nya
        db.prepare('DELETE FROM shopping_list').run();
        const insertItem = db.prepare(
            'INSERT INTO shopping_list (name, amount, unit, category, checked) VALUES (?, ?, ?, ?, 0)'
        );
        for (const item of list) {
            insertItem.run(item.name, item.amount, item.unit, item.category);
        }

        res.json(getShoppingListFromDb());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function getShoppingListFromDb() {
    return db.prepare('SELECT * FROM shopping_list ORDER BY id').all();
}

// Hämta sparad lista
app.get('/api/shopping-list', (req, res) => {
    try {
        res.json(getShoppingListFromDb());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bocka av/på en vara
app.patch('/api/shopping-list/:id/check', (req, res) => {
    try {
        const item = db.prepare('SELECT checked FROM shopping_list WHERE id = ?').get(req.params.id);
        const newValue = item.checked ? 0 : 1;
        db.prepare('UPDATE shopping_list SET checked = ? WHERE id = ?').run(newValue, req.params.id);
        res.json({ checked: newValue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rensa hela listan
app.delete('/api/shopping-list', (req, res) => {
    try {
        db.prepare('DELETE FROM shopping_list').run();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Spara ett nytt recept
app.post('/api/recipes', (req, res) => {
    try {
        const { name, image, ingredients } = req.body;
        const insertRecipe = db.prepare(
            'INSERT INTO recipes (name, image, source, url, in_cookbook) VALUES (?, ?, ?, ?, 0)'
        );
        const result = insertRecipe.run(name, image || '', req.body.source || '', req.body.url || '');
        const recipeId = result.lastInsertRowid;
        const insertIngredient = db.prepare(
            'INSERT INTO ingredients (recipe_id, name, amount, unit) VALUES (?, ?, ?, ?)'
        );
        for (const ing of ingredients) {
            insertIngredient.run(recipeId, ing.name, ing.amount, ing.unit);
        }
        res.json({ id: recipeId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Hämta alla sparade recept
app.get('/api/recipes', (req, res) => {
    try {
        const recipes = db.prepare('SELECT * FROM recipes').all();
        const getIngredients = db.prepare('SELECT name, amount, unit FROM ingredients WHERE recipe_id = ?');
        const fullRecipes = recipes.map(recipe => ({
            ...recipe,
            ingredients: getIngredients.all(recipe.id)
        }));
        res.json(fullRecipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Markera ett recept som läggs till i kokboken
app.patch('/api/recipes/:id/cookbook', (req, res) => {
    try {
        db.prepare('UPDATE recipes SET in_cookbook = 1 WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/recipes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, image, ingredients } = req.body;

        db.prepare('UPDATE recipes SET name = ?, image = ? WHERE id = ?').run(name, image || '', id);

        db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(id);
        const insertIngredient = db.prepare(
            'INSERT INTO ingredients (recipe_id, name, amount, unit) VALUES (?, ?, ?, ?)'
        );
        for (const ing of ingredients) {
            insertIngredient.run(id, ing.name, ing.amount, ing.unit);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/recipes/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(id);
        db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Servern är igång'));