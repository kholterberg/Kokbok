const path = require('path');
const express = require('express');
const { getScraperForUrl } = require('./scrapers');
const { getCategoryForIngredient, sortByStoreLayout, withAllCategories } = require('./shoppingList');
const db = require('./db');
const { normalizeUrl } = require('./db');
const { basicAuth } = require('./auth');
const { IMAGE_DIR, storeImage, deleteLocalImage } = require('./images');
const { scheduleBackups } = require('./backup');

const app = express();

// Health-check ligger före inloggningen så att Docker kan kolla att servern lever
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(basicAuth(process.env.AUTH_USER, process.env.AUTH_PASSWORD));
app.use(express.json({ limit: '15mb' })); // uppladdade bilder skickas som base64 i JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(IMAGE_DIR, { maxAge: '30d', immutable: true }));

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !/^https?:\/\//i.test(url)) {
            return res.status(400).json({ error: 'Ogiltig länk' });
        }

        // Kolla dubbletter innan vi ens hämtar sidan
        const existing = findRecipeByUrl(url);
        if (existing) {
            return res.status(409).json({ error: 'Receptet finns redan', recipe: existing });
        }

        const scraper = getScraperForUrl(url);

        const data = await scraper(url);
        if (!data) {
            return res.status(404).json({ error: 'Hittade inget recept på sidan' });
        }

        res.json({ ...data, url: data.url || url });
    } catch (err) {
        const status = err.response?.status;
        const message = status ? `Sajten svarade med ${status}` : err.message;
        res.status(502).json({ error: message });
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

        // Rensa gammal lista, spara den nya. Sorteringen efter butik sker när listan hämtas,
        // så att den kan sorteras om direkt när man byter butik.
        db.prepare('DELETE FROM shopping_list').run();
        const insertItem = db.prepare(
            'INSERT INTO shopping_list (name, amount, unit, category, checked) VALUES (?, ?, ?, ?, 0)'
        );
        for (const item of Object.values(merged)) {
            insertItem.run(item.name, item.amount, item.unit, item.category);
        }

        res.json(getShoppingListFromDb());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listan sorteras efter den valda butikens gångordning
function getShoppingListFromDb() {
    const items = db.prepare('SELECT * FROM shopping_list ORDER BY id').all();
    return sortByStoreLayout(items, getActiveStoreLayout());
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
        if (!item) return res.status(404).json({ error: 'Varan finns inte' });
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

// ---------- Butiker ----------

function getActiveStoreId() {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'active_store'").get();
    const id = Number(setting?.value);
    if (id && db.prepare('SELECT 1 FROM stores WHERE id = ?').get(id)) return id;
    // ingen vald (eller borttagen) butik -> ta den första
    return db.prepare('SELECT id FROM stores ORDER BY id').get()?.id ?? null;
}

function setActiveStoreId(id) {
    db.prepare(`
        INSERT INTO settings (key, value) VALUES ('active_store', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(id));
}

function getActiveStoreLayout() {
    const row = db.prepare('SELECT categories FROM stores WHERE id = ?').get(getActiveStoreId());
    return row ? JSON.parse(row.categories) : [];
}

function toStore(row) {
    const inShoppingList = db.prepare('SELECT DISTINCT category FROM shopping_list').all().map(r => r.category);
    return {
        id: row.id,
        name: row.name,
        categories: withAllCategories(JSON.parse(row.categories), inShoppingList)
    };
}

function getStore(id) {
    const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    return row ? toStore(row) : null;
}

// Tar bort tomma värden och dubbletter, så att databasen alltid har en giltig ordning
function cleanCategories(categories) {
    if (!Array.isArray(categories)) return null;
    return [...new Set(categories.map(c => String(c).trim()).filter(Boolean))];
}

function storeError(res, err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Det finns redan en butik med det namnet' });
    }
    res.status(500).json({ error: err.message });
}

app.get('/api/stores', (req, res) => {
    try {
        const stores = db.prepare('SELECT * FROM stores ORDER BY name').all().map(toStore);
        res.json({ activeStoreId: getActiveStoreId(), stores });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ny butik – utgår från den valda butikens ordning, eftersom de flesta butiker liknar varandra
app.post('/api/stores', (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Butiken behöver ett namn' });

        const categories = cleanCategories(req.body.categories) || getActiveStoreLayout();
        const result = db.prepare('INSERT INTO stores (name, categories) VALUES (?, ?)')
            .run(name, JSON.stringify(categories));
        res.json(getStore(result.lastInsertRowid));
    } catch (err) {
        storeError(res, err);
    }
});

// Byt namn och/eller ändra ordningen
app.put('/api/stores/:id', (req, res) => {
    try {
        const current = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
        if (!current) return res.status(404).json({ error: 'Butiken finns inte' });

        const name = String(req.body.name ?? current.name).trim() || current.name;
        const categories = cleanCategories(req.body.categories) || JSON.parse(current.categories);
        db.prepare('UPDATE stores SET name = ?, categories = ? WHERE id = ?')
            .run(name, JSON.stringify(categories), current.id);
        res.json(getStore(current.id));
    } catch (err) {
        storeError(res, err);
    }
});

app.delete('/api/stores/:id', (req, res) => {
    try {
        const count = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
        if (count <= 1) return res.status(400).json({ error: 'Det måste finnas minst en butik' });

        const result = db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Butiken finns inte' });
        res.json({ success: true, activeStoreId: getActiveStoreId() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Välj butik – svarar med inköpslistan sorterad efter den nya butiken
app.post('/api/stores/:id/activate', (req, res) => {
    try {
        if (!db.prepare('SELECT 1 FROM stores WHERE id = ?').get(req.params.id)) {
            return res.status(404).json({ error: 'Butiken finns inte' });
        }
        setActiveStoreId(req.params.id);
        res.json(getShoppingListFromDb());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Recept ----------

const getIngredients = db.prepare('SELECT name, amount, unit FROM ingredients WHERE recipe_id = ? ORDER BY id');
const insertIngredient = db.prepare('INSERT INTO ingredients (recipe_id, name, amount, unit) VALUES (?, ?, ?, ?)');

function toRecipe(row) {
    if (!row) return null;
    const { url_key, ...recipe } = row;
    return {
        ...recipe,
        instructions: parseInstructions(row.instructions),
        ingredients: getIngredients.all(row.id)
    };
}

function getRecipe(id) {
    return toRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id));
}

function findRecipeByUrl(url) {
    const key = normalizeUrl(url);
    if (!key) return null;
    return toRecipe(db.prepare('SELECT * FROM recipes WHERE url_key = ?').get(key));
}

// Instruktioner sparas som JSON-text i databasen
function parseInstructions(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function cleanIngredients(ingredients = []) {
    return ingredients
        .filter(ing => ing && String(ing.name || '').trim())
        .map(ing => ({
            name: String(ing.name).trim(),
            amount: Number.isFinite(ing.amount) ? ing.amount : null,
            unit: ing.unit || null
        }));
}

const replaceIngredients = db.transaction((recipeId, ingredients) => {
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
    for (const ing of ingredients) {
        insertIngredient.run(recipeId, ing.name, ing.amount, ing.unit);
    }
});

const deleteRecipe = db.transaction(id => {
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(id);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
});

// Spara ett nytt recept
app.post('/api/recipes', async (req, res) => {
    try {
        const { name, image, ingredients = [], instructions = [] } = req.body;
        const url = req.body.url || '';

        if (url && findRecipeByUrl(url)) {
            return res.status(409).json({ error: 'Receptet finns redan', recipe: findRecipeByUrl(url) });
        }

        const insertRecipe = db.prepare(`
            INSERT INTO recipes (name, image, source, url, url_key, in_cookbook, in_week, description, instructions, servings, total_time, created_at, last_in_week)
            VALUES (?, '', ?, ?, ?, 0, 1, ?, ?, ?, ?, datetime('now'), strftime('%Y-%m-%d %H:%M:%f', 'now'))
        `);
        const result = insertRecipe.run(
            name || 'Nytt recept',
            req.body.source || '',
            url,
            url ? normalizeUrl(url) : null,
            req.body.description || '',
            JSON.stringify(instructions),
            req.body.servings || null,
            req.body.total_time || null
        );
        const recipeId = result.lastInsertRowid;
        replaceIngredients(recipeId, cleanIngredients(ingredients));

        // Bilden laddas ner först när vi har ett id att döpa filen efter
        const localImage = await storeImage(image, recipeId);
        db.prepare('UPDATE recipes SET image = ? WHERE id = ?').run(localImage, recipeId);

        res.json(getRecipe(recipeId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Hämta alla sparade recept
app.get('/api/recipes', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM recipes ORDER BY id').all();
        res.json(rows.map(toRecipe));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Spara ändringar från redigeringsläget
app.put('/api/recipes/:id', async (req, res) => {
    try {
        const current = getRecipe(req.params.id);
        if (!current) return res.status(404).json({ error: 'Receptet finns inte' });

        const body = req.body;
        let image = body.image ?? current.image;
        if (image !== current.image) {
            const stored = await storeImage(image, current.id);
            if (image && !stored) {
                image = current.image; // uppladdningen misslyckades – behåll den gamla bilden
            } else {
                image = stored;
                deleteLocalImage(current.image);
            }
        }

        db.prepare(`
            UPDATE recipes
            SET name = ?, image = ?, description = ?, instructions = ?, servings = ?, total_time = ?
            WHERE id = ?
        `).run(
            body.name || current.name,
            image,
            body.description ?? current.description ?? '',
            JSON.stringify(body.instructions ?? current.instructions),
            body.servings ?? current.servings,
            body.total_time ?? current.total_time,
            current.id
        );
        if (Array.isArray(body.ingredients)) {
            replaceIngredients(current.id, cleanIngredients(body.ingredients));
        }

        res.json(getRecipe(current.id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Flytta recept in/ut ur kokboken och veckans recept.
// Ett recept som varken finns i veckan eller kokboken tas bort helt.
app.patch('/api/recipes/:id', (req, res) => {
    try {
        const current = getRecipe(req.params.id);
        if (!current) return res.status(404).json({ error: 'Receptet finns inte' });

        const inCookbook = 'in_cookbook' in req.body ? (req.body.in_cookbook ? 1 : 0) : current.in_cookbook;
        const inWeek = 'in_week' in req.body ? (req.body.in_week ? 1 : 0) : current.in_week;

        if (!inCookbook && !inWeek) {
            deleteRecipe(current.id);
            deleteLocalImage(current.image);
            return res.json({ deleted: true });
        }

        db.prepare('UPDATE recipes SET in_cookbook = ? WHERE id = ?').run(inCookbook, current.id);
        if (inWeek !== current.in_week) markInWeek.run(inWeek, current.id);
        res.json(getRecipe(current.id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/recipes/:id', (req, res) => {
    try {
        const current = getRecipe(req.params.id);
        if (!current) return res.status(404).json({ error: 'Receptet finns inte' });
        deleteRecipe(current.id);
        deleteLocalImage(current.image);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Veckomeny ----------

// Sätter in_week och noterar när det hände, så att generatorn vet hur länge sedan
// receptet var med i veckomenyn
const markInWeek = db.prepare("UPDATE recipes SET in_week = ?, last_in_week = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?");

// Kokboksrecept som inte är med i veckan, i turordning: aldrig planerade först, sedan de som
// var längst sedan i veckomenyn. Recept med exakt samma tidpunkt (t.ex. valda i samma
// generering) slumpas, så att ordningen varierar.
const pickCandidates = db.prepare(`
    SELECT id FROM recipes
    WHERE in_cookbook = 1 AND in_week = 0
    ORDER BY last_in_week IS NOT NULL, last_in_week, random()
    LIMIT ?
`);

const generateWeek = db.transaction(count => {
    // Förra veckans kokboksrecept lämnar veckan – de finns kvar i kokboken
    const previous = db.prepare('SELECT id FROM recipes WHERE in_week = 1 AND in_cookbook = 1').all();
    for (const { id } of previous) markInWeek.run(0, id);

    // Recept som inte finns i kokboken ligger kvar (de skulle annars raderas) och räknas in i antalet
    const kept = db.prepare('SELECT COUNT(*) AS count FROM recipes WHERE in_week = 1').get().count;
    const needed = Math.max(0, count - kept);

    const picked = pickCandidates.all(needed);
    for (const { id } of picked) markInWeek.run(1, id);
    return { added: picked.length, kept, needed };
});

function allRecipes() {
    return db.prepare('SELECT * FROM recipes ORDER BY id').all().map(toRecipe);
}

// Ny veckomeny från kokboken – körs bara när man trycker på knappen
app.post('/api/week/generate', (req, res) => {
    try {
        const count = Math.min(14, Math.max(1, parseInt(req.body.count, 10) || 6));
        const result = generateWeek(count);
        res.json({ ...result, count, recipes: allRecipes() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Byt ut ett recept i veckan mot nästa i turordningen
const swapRecipe = db.transaction(id => {
    const [next] = pickCandidates.all(1); // väljs innan det gamla tas bort, så att det inte väljs igen
    if (!next) return null;
    markInWeek.run(0, id);
    markInWeek.run(1, next.id);
    return next.id;
});

app.post('/api/week/swap/:id', (req, res) => {
    try {
        const current = db.prepare('SELECT in_week, in_cookbook FROM recipes WHERE id = ?').get(req.params.id);
        if (!current || !current.in_week) return res.status(404).json({ error: 'Receptet finns inte i veckomenyn' });
        if (!current.in_cookbook) return res.status(400).json({ error: 'Bara recept från kokboken kan bytas ut' });

        const newId = swapRecipe(Number(req.params.id));
        if (!newId) return res.status(409).json({ error: 'Det finns inga fler recept i kokboken att byta till' });
        res.json({ newId, recipes: allRecipes() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

scheduleBackups(db);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servern är igång på port ${PORT}`));
