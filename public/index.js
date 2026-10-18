'use strict';

let recipes = []; // alla recept från servern – veckan och kokboken är filter på denna lista

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#ReceptForm');
    const input = document.querySelector('#url');
    const submitBtn = form.querySelector('button[type="submit"]');
    const recipeContainer = document.querySelector('#recipe-container');
    const cookbookContainer = document.querySelector('#cookbook-container');
    const cookbookSearch = document.querySelector('#cookbook-search');
    const cookbookCount = document.querySelector('#cookbook-count');
    const generateBtn = document.querySelector('#generateList');
    const clearListBtn = document.querySelector('#clearList');
    const addManualBtn = document.querySelector('#addManualRecipe');

    const weeklyRecipes = () => recipes.filter(recipe => recipe.in_week);
    const cookbookRecipes = () => recipes.filter(recipe => recipe.in_cookbook);

    // Gemensam fetch-hjälpare: kastar ett fel med serverns felmeddelande om svaret inte är ok
    async function api(url, method = 'GET', body) {
        const options = { method };
        if (body !== undefined) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
        const res = await fetch(url, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `Något gick fel (${res.status})`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function upsertRecipe(updated) {
        const index = recipes.findIndex(recipe => recipe.id === updated.id);
        if (index === -1) recipes.push(updated);
        else recipes[index] = updated;
    }

    function removeRecipe(id) {
        recipes = recipes.filter(recipe => recipe.id !== id);
    }

    async function loadSavedRecipes() {
        recipes = await api('/api/recipes');
        renderAll();
    }

    loadSavedRecipes();

    async function loadSavedShoppingList() {
        const shoppingList = await api('/api/shopping-list');
        renderShoppingList(shoppingList);
    }

    loadSavedShoppingList();

    // ---------- Rendering av veckan och kokboken ----------

    function renderAll() {
        renderWeek();
        renderCookbook();
    }

    function renderWeek() {
        recipeContainer.innerHTML = '';
        const week = weeklyRecipes();
        if (week.length === 0) {
            recipeContainer.appendChild(emptyMessage('Inga recept den här veckan. Klistra in en länk ovan eller välj från kokboken.'));
            return;
        }
        week.forEach(recipe => recipeContainer.appendChild(renderRecipeCard(recipe, 'week')));
    }

    function renderCookbook() {
        cookbookContainer.innerHTML = '';
        const all = cookbookRecipes();
        const matches = all
            .filter(recipe => matchesSearch(recipe, cookbookSearch.value))
            .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

        cookbookCount.textContent = cookbookSearch.value.trim()
            ? `${matches.length} av ${all.length} recept`
            : `${all.length} sparade recept`;

        if (matches.length === 0) {
            cookbookContainer.appendChild(emptyMessage(all.length
                ? 'Inga recept matchar sökningen.'
                : 'Kokboken är tom. Tryck "📖 Spara i kokboken" på ett recept i veckan.'));
            return;
        }
        matches.forEach(recipe => cookbookContainer.appendChild(renderRecipeCard(recipe, 'cookbook')));
    }

    // Alla sökord måste finnas någonstans i namn, beskrivning eller ingredienser ("kyckling kokos")
    function matchesSearch(recipe, query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        const haystack = [
            recipe.name,
            recipe.description,
            ...recipe.ingredients.map(ing => ing.name)
        ].join(' ').toLowerCase();
        return words.every(word => haystack.includes(word));
    }

    cookbookSearch.addEventListener('input', renderCookbook);

    function emptyMessage(text) {
        const p = document.createElement('p');
        p.classList.add('empty-message');
        p.textContent = text;
        return p;
    }

    //visar upp den "vanliga" menyn där inget går att redigera
    function renderViewMode(recipe, recipeDiv) {
        recipeDiv.innerHTML = '';

        if (recipe.image) {
            const img = document.createElement('img');
            img.src = recipe.image;
            img.alt = recipe.name;
            img.loading = 'lazy';
            recipeDiv.appendChild(img);
        }

        renderMeta(recipe, recipeDiv);

        const table = document.createElement('table');
        recipe.ingredients.forEach(ingredient => {
            const row = document.createElement('tr');

            const name = document.createElement('td');
            name.textContent = ingredient.name;

            const amount = document.createElement('td');
            amount.textContent = ingredient.amount ?? '';

            const unit = document.createElement('td');
            unit.textContent = ingredient.unit ?? '';

            row.appendChild(name);
            row.appendChild(amount);
            row.appendChild(unit);
            table.appendChild(row);
        });
        recipeDiv.appendChild(table);

        renderInstructions(recipe, recipeDiv);
    }

    function checkboxRecipe(){
        //TODO... Välja vilka recept som ska vara med i inköpslistan
    }

    // Portioner, tillagningstid och länk till originalet
    function renderMeta(recipe, recipeDiv) {
        const parts = [];
        if (recipe.servings) parts.push(`🍽️ ${recipe.servings}`);
        if (recipe.total_time) parts.push(`⏱️ ${formatMinutes(recipe.total_time)}`);
        if (parts.length === 0 && !recipe.url) return;

        const meta = document.createElement('p');
        meta.classList.add('recipe-meta');
        meta.textContent = parts.join(' · ');

        if (recipe.url) {
            const link = document.createElement('a');
            link.href = recipe.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = recipe.source || 'Originalrecept';
            if (parts.length) meta.append(' · ');
            meta.appendChild(link);
        }
        recipeDiv.appendChild(meta);
    }

    function formatMinutes(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h && m) return `${h} h ${m} min`;
        return h ? `${h} h` : `${m} min`;
    }

    // Steg som börjar med "## " är rubriker för delmoment (t.ex. "Sås", "Deg")
    function renderInstructions(recipe, recipeDiv) {
        if (!recipe.instructions || recipe.instructions.length === 0) return;

        const heading = document.createElement('h3');
        heading.textContent = 'Gör så här';
        recipeDiv.appendChild(heading);

        let list = null;
        recipe.instructions.forEach(step => {
            if (step.startsWith('## ')) {
                const sectionHeading = document.createElement('h4');
                sectionHeading.textContent = step.slice(3);
                recipeDiv.appendChild(sectionHeading);
                list = null;
                return;
            }
            if (!list) {
                list = document.createElement('ol');
                list.classList.add('recipe-instructions');
                recipeDiv.appendChild(list);
            }
            const li = document.createElement('li');
            li.textContent = step;
            list.appendChild(li);
        });
    }

    // Visar upp redigeringsläget av recepten.
    // Ändringarna görs på en kopia (draft) så att "Avbryt" verkligen avbryter.
    function renderEditMode(recipe, recipeDiv, recipeTitle, switchToView) {
        const draft = structuredClone(recipe);
        recipeDiv.innerHTML = '';

        const img = document.createElement('img');
        img.alt = draft.name;
        img.hidden = !draft.image;
        if (draft.image) img.src = draft.image;
        recipeDiv.appendChild(img);

        // Egen bild – skickas som data-URL och sparas som fil på servern
        const imageLabel = document.createElement('label');
        imageLabel.classList.add('image-upload');
        imageLabel.textContent = draft.image ? '🖼️ Byt bild ' : '🖼️ Lägg till bild ';
        const imageInput = document.createElement('input');
        imageInput.type = 'file';
        imageInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('Bilden är för stor (max 10 MB)');
                return;
            }
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                draft.image = reader.result;
                img.src = reader.result;
                img.hidden = false;
            });
            reader.readAsDataURL(file);
        });
        imageLabel.appendChild(imageInput);
        recipeDiv.appendChild(imageLabel);

        const table = document.createElement('table');

        function createIngredientRow(ingredient) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = ingredient.name;
            nameInput.placeholder = 'Ingrediens';
            nameInput.addEventListener('input', () => {
                ingredient.name = nameInput.value;
            });
            nameCell.appendChild(nameInput);

            const amountCell = document.createElement('td');
            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.step = 'any';
            amountInput.value = ingredient.amount ?? '';
            amountInput.addEventListener('input', () => {
                ingredient.amount = amountInput.value === '' ? null : parseFloat(amountInput.value);
            });
            amountCell.appendChild(amountInput);

            const unitCell = document.createElement('td');
            const unitInput = document.createElement('input');
            unitInput.type = 'text';
            unitInput.value = ingredient.unit ?? '';
            unitInput.addEventListener('input', () => {
                ingredient.unit = unitInput.value === '' ? null : unitInput.value;
            });
            unitCell.appendChild(unitInput);

            const removeCell = document.createElement('td');
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', () => {
                const index = draft.ingredients.indexOf(ingredient);
                if (index !== -1) draft.ingredients.splice(index, 1);
                row.remove();
            });
            removeCell.appendChild(removeBtn);

            row.appendChild(nameCell);
            row.appendChild(amountCell);
            row.appendChild(unitCell);
            row.appendChild(removeCell);

            return row;
        }

        draft.ingredients.forEach(ingredient => {
            table.appendChild(createIngredientRow(ingredient));
        });
        recipeDiv.appendChild(table);

        const addIngredientBtn = document.createElement('button');
        addIngredientBtn.textContent = '+ Lägg till ingrediens';
        addIngredientBtn.type = 'button';
        addIngredientBtn.addEventListener('click', () => {
            const newIngredient = { name: '', amount: null, unit: null };
            draft.ingredients.push(newIngredient);
            table.appendChild(createIngredientRow(newIngredient));
        });
        recipeDiv.appendChild(addIngredientBtn);

        // Instruktioner redigeras som ett steg per rad
        const instructionsLabel = document.createElement('h3');
        instructionsLabel.textContent = 'Gör så här (ett steg per rad)';
        recipeDiv.appendChild(instructionsLabel);

        const instructionsInput = document.createElement('textarea');
        instructionsInput.classList.add('instructions-input');
        instructionsInput.rows = 8;
        instructionsInput.value = (draft.instructions || []).join('\n');
        instructionsInput.addEventListener('input', () => {
            draft.instructions = instructionsInput.value
                .split('\n')
                .map(step => step.trim())
                .filter(Boolean);
        });
        recipeDiv.appendChild(instructionsInput);

        // Titeln blir redigerbar i edit-läge
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = draft.name;
        titleInput.classList.add('recipe-title-input');
        titleInput.addEventListener('input', () => {
            draft.name = titleInput.value;
        });
        recipeTitle.innerHTML = '';
        recipeTitle.appendChild(titleInput);

        const buttonRow = document.createElement('div');
        buttonRow.classList.add('edit-buttons');

        // Spara-knapp -> sparar i databasen och växlar tillbaka till vanligt läge
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Spara';
        saveBtn.type = 'button';
        saveBtn.classList.add('save-btn');
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Sparar...';
            try {
                const updated = await api(`/api/recipes/${recipe.id}`, 'PUT', draft);
                upsertRecipe(updated);
                renderAll(); // receptet kan synas både i veckan och kokboken
            } catch (err) {
                alert(`Kunde inte spara: ${err.message}`);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Spara';
            }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Avbryt';
        cancelBtn.type = 'button';
        cancelBtn.classList.add('cancel-btn');
        cancelBtn.addEventListener('click', switchToView);

        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(cancelBtn);
        recipeDiv.appendChild(buttonRow);
    }

    function actionButton(text, extraClass, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.type = 'button';
        btn.classList.add('action-btn');
        if (extraClass) btn.classList.add(extraClass);
        if (onClick) {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    await onClick();
                } catch (err) {
                    alert(err.message);
                } finally {
                    btn.disabled = false; // kortet ritas oftast om ändå, men inte om man avbröt
                }
            });
        }
        return btn;
    }

    // Uppdaterar in_week/in_cookbook. Servern tar bort receptet helt om det inte finns kvar någonstans.
    async function setFlags(recipe, flags) {
        const result = await api(`/api/recipes/${recipe.id}`, 'PATCH', flags);
        if (result.deleted) removeRecipe(recipe.id);
        else upsertRecipe(result);
        renderAll();
    }

    // Knapparna skiljer sig mellan veckovyn och kokboken
    function renderActions(recipe, context) {
        const actionsRow = document.createElement('div');
        actionsRow.classList.add('recipe-actions');

        if (context === 'week') {
            const removeBtn = actionButton('🗑️ Ta bort från veckan', 'delete-btn', async () => {
                if (!recipe.in_cookbook) {
                    const confirmed = confirm(`"${recipe.name}" finns inte i kokboken och tas bort helt. Fortsätta?`);
                    if (!confirmed) return;
                }
                await setFlags(recipe, { in_week: 0 });
            });

            const cookbookBtn = recipe.in_cookbook
                ? actionButton('✅ I kokboken', 'cookbook-btn')
                : actionButton('📖 Spara i kokboken', 'cookbook-btn', () => setFlags(recipe, { in_cookbook: 1 }));
            cookbookBtn.disabled = !!recipe.in_cookbook;

            actionsRow.appendChild(removeBtn);
            actionsRow.appendChild(cookbookBtn);
        } else {
            const weekBtn = recipe.in_week
                ? actionButton('✓ I veckans recept', 'week-btn', () => setFlags(recipe, { in_week: 0 }))
                : actionButton('➕ Lägg till i veckan', 'week-btn', () => setFlags(recipe, { in_week: 1 }));
            if (recipe.in_week) weekBtn.classList.add('active');

            const removeBtn = actionButton('🗑️ Ta bort ur kokboken', 'delete-btn', async () => {
                const message = recipe.in_week
                    ? `Ta bort "${recipe.name}" ur kokboken? Det finns kvar i veckans recept.`
                    : `Ta bort "${recipe.name}" helt?`;
                if (!confirm(message)) return;
                await setFlags(recipe, { in_cookbook: 0 });
            });

            actionsRow.appendChild(weekBtn);
            actionsRow.appendChild(removeBtn);
        }
        return actionsRow;
    }

    // Bygger ett helt receptkort, med pennan som växlar mellan lägena.
    // I kokboken är korten ihopfällda tills man klickar på "Visa recept".
    function renderRecipeCard(recipe, context) {
        const box = document.createElement('div');
        box.classList.add('recipe');
        box.dataset.id = recipe.id;

        // Rad 1: titel + redigera-penna
        const titleRow = document.createElement('div');
        titleRow.classList.add('recipe-title-row');

        const recipeTitle = document.createElement('h2');
        renderTitle();

        // Titeln är en länk till originalreceptet. Länken ligger inuti rubriken (inte tvärtom),
        // så att den kan tas bort i redigeringsläget – annars öppnar ett klick i titelfältet sajten.
        function renderTitle() {
            recipeTitle.textContent = '';
            if (recipe.url) {
                const clickableLink = document.createElement('a');
                clickableLink.href = recipe.url;
                clickableLink.target = '_blank';
                clickableLink.rel = 'noopener';
                clickableLink.textContent = recipe.name;
                recipeTitle.appendChild(clickableLink);
            } else {
                recipeTitle.textContent = recipe.name;
            }
        }

        const editButton = document.createElement('button');
        editButton.textContent = '✏️';
        editButton.type = 'button';
        editButton.title = 'Redigera';
        editButton.classList.add('edit-btn');

        titleRow.appendChild(recipeTitle);
        titleRow.appendChild(editButton);
        box.appendChild(titleRow);

        // Rad 2: åtgärdsknappar
        box.appendChild(renderActions(recipe, context));

        // Resten: bild, ingredienser osv.
        const recipeDiv = document.createElement('div');
        box.appendChild(recipeDiv);

        let toggleBtn = null;
        if (context === 'cookbook') {
            recipeDiv.hidden = true;
            toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.classList.add('toggle-btn');
            toggleBtn.textContent = 'Visa recept ▾';
            toggleBtn.addEventListener('click', () => {
                recipeDiv.hidden = !recipeDiv.hidden;
                toggleBtn.textContent = recipeDiv.hidden ? 'Visa recept ▾' : 'Dölj recept ▴';
            });
            box.insertBefore(toggleBtn, recipeDiv);
        }

        function switchToView() {
            renderTitle();
            editButton.style.display = 'inline-block';
            renderViewMode(recipe, recipeDiv);
        }

        editButton.addEventListener('click', () => {
            editButton.style.display = 'none';
            recipeDiv.hidden = false;
            if (toggleBtn) toggleBtn.textContent = 'Dölj recept ▴';
            renderEditMode(recipe, recipeDiv, recipeTitle, switchToView);
        });

        renderViewMode(recipe, recipeDiv);

        return box;
    }

    addManualBtn.addEventListener('click', async () => {
        try {
            const saved = await api('/api/recipes', 'POST', {
                source: 'manual',
                name: 'Nytt recept',
                image: '',
                ingredients: [],
                instructions: []
            });
            upsertRecipe(saved);
            renderWeek();
            document.querySelector('[data-view="recipe"]').click();

            //denna kodrad ser till att redigeringsläget öppnas direkt för att det är ett recept man vill läögga till själv
            const card = recipeContainer.querySelector(`[data-id="${saved.id}"]`);
            card.querySelector('.edit-btn').click();
            card.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            alert(`Kunde inte skapa recept: ${err.message}`);
        }
    });

    clearListBtn.addEventListener('click', async () => {
        const confirmed = confirm('Rensa hela inköpslistan?');
        if (!confirmed) return;

        await api('/api/shopping-list', 'DELETE');
        renderShoppingList([]);
    });

    // Om receptet redan finns: erbjud att lägga till det i veckan i stället för att spara en dubblett
    async function handleDuplicate(existing) {
        if (existing.in_week) {
            alert(`"${existing.name}" finns redan i veckans recept.`);
            return;
        }
        if (confirm(`"${existing.name}" finns redan i kokboken. Lägga till det i veckans recept?`)) {
            await setFlags(existing, { in_week: 1 });
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = input.value;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Hämtar...';

        try {
            const scraped = await api('/api/scrape', 'POST', { url });
            const saved = await api('/api/recipes', 'POST', scraped);
            upsertRecipe(saved);
            renderWeek();
            document.querySelector('[data-view="recipe"]').click();
            input.value = '';
        } catch (err) {
            if (err.status === 409 && err.data.recipe) {
                await handleDuplicate(err.data.recipe);
                input.value = '';
            } else {
                alert(`Kunde inte hämta receptet: ${err.message}`);
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = ' Lägg till recept ';
        }
    });

    // ---------- Butiker: i vilken ordning kategorierna kommer i inköpslistan ----------

    const storeSelect = document.querySelector('#store-select');
    const editStoreBtn = document.querySelector('#editStore');
    const addStoreBtn = document.querySelector('#addStore');
    const storeEditor = document.querySelector('#store-editor');

    let stores = [];
    let activeStoreId = null;
    let lastShoppingList = []; // används för att visa hur många varor varje kategori har

    async function loadStores() {
        const data = await api('/api/stores');
        stores = data.stores;
        activeStoreId = data.activeStoreId;
        renderStoreSelect();
    }

    loadStores();

    function activeStore() {
        return stores.find(store => store.id === activeStoreId);
    }

    function renderStoreSelect() {
        storeSelect.innerHTML = '';
        stores.forEach(store => {
            storeSelect.add(new Option(store.name, store.id, false, store.id === activeStoreId));
        });
    }

    // Byt butik -> listan sorteras om direkt (avbockningar finns kvar)
    async function activateStore(id) {
        const shoppingList = await api(`/api/stores/${id}/activate`, 'POST');
        activeStoreId = id;
        renderStoreSelect();
        renderShoppingList(shoppingList);
    }

    storeSelect.addEventListener('change', async () => {
        storeEditor.hidden = true;
        try {
            await activateStore(Number(storeSelect.value));
        } catch (err) {
            alert(`Kunde inte byta butik: ${err.message}`);
            renderStoreSelect();
        }
    });

    addStoreBtn.addEventListener('click', async () => {
        const name = prompt('Vad heter butiken?\n(Den börjar med samma ordning som nuvarande butik.)');
        if (!name || !name.trim()) return;
        try {
            const created = await api('/api/stores', 'POST', { name });
            stores.push(created);
            await activateStore(created.id);
            renderStoreEditor(created);
        } catch (err) {
            alert(err.message);
        }
    });

    editStoreBtn.addEventListener('click', () => {
        if (!storeEditor.hidden) {
            storeEditor.hidden = true;
            return;
        }
        const store = activeStore();
        if (store) renderStoreEditor(store);
    });

    // Redigeringsvy: byt namn, flytta kategorier med ▲/▼ (fungerar även på mobil), ta bort butiken
    function renderStoreEditor(store) {
        const draft = { name: store.name, categories: [...store.categories] };
        storeEditor.innerHTML = '';
        storeEditor.hidden = false;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = draft.name;
        nameInput.classList.add('store-name-input');
        nameInput.setAttribute('aria-label', 'Butikens namn');
        nameInput.addEventListener('input', () => {
            draft.name = nameInput.value;
        });
        storeEditor.appendChild(nameInput);

        const hint = document.createElement('p');
        hint.classList.add('store-hint');
        hint.textContent = 'Ordna avdelningarna i den ordning du går genom butiken.';
        storeEditor.appendChild(hint);

        const counts = {};
        lastShoppingList.forEach(item => {
            counts[item.category] = (counts[item.category] || 0) + 1;
        });

        const list = document.createElement('ol');
        list.classList.add('store-categories');
        storeEditor.appendChild(list);

        function moveCategory(index, direction) {
            const target = index + direction;
            [draft.categories[index], draft.categories[target]] = [draft.categories[target], draft.categories[index]];
            renderRows();
            // behåll fokus på samma knapp, så att man kan klicka flera gånger i rad
            const row = list.children[target];
            const sameButton = row && row.querySelector(direction < 0 ? '.move-up' : '.move-down');
            if (sameButton && !sameButton.disabled) sameButton.focus();
        }

        function renderRows() {
            list.innerHTML = '';
            draft.categories.forEach((category, index) => {
                const li = document.createElement('li');

                const name = document.createElement('span');
                name.classList.add('store-category-name');
                name.textContent = category;
                li.appendChild(name);

                if (counts[category]) {
                    const badge = document.createElement('span');
                    badge.classList.add('store-category-count');
                    badge.textContent = `${counts[category]} i listan`;
                    li.appendChild(badge);
                }

                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.textContent = '▲';
                upBtn.title = 'Flytta upp';
                upBtn.classList.add('move-btn', 'move-up');
                upBtn.disabled = index === 0;
                upBtn.addEventListener('click', () => moveCategory(index, -1));

                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.textContent = '▼';
                downBtn.title = 'Flytta ner';
                downBtn.classList.add('move-btn', 'move-down');
                downBtn.disabled = index === draft.categories.length - 1;
                downBtn.addEventListener('click', () => moveCategory(index, 1));

                li.appendChild(upBtn);
                li.appendChild(downBtn);
                list.appendChild(li);
            });
        }
        renderRows();

        const buttonRow = document.createElement('div');
        buttonRow.classList.add('edit-buttons');

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Spara';
        saveBtn.classList.add('save-btn');
        saveBtn.addEventListener('click', async () => {
            try {
                const updated = await api(`/api/stores/${store.id}`, 'PUT', draft);
                stores = stores.map(s => (s.id === updated.id ? updated : s));
                renderStoreSelect();
                storeEditor.hidden = true;
                await loadSavedShoppingList(); // sortera om efter den nya ordningen
            } catch (err) {
                alert(`Kunde inte spara: ${err.message}`);
            }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Avbryt';
        cancelBtn.classList.add('cancel-btn');
        cancelBtn.addEventListener('click', () => {
            storeEditor.hidden = true;
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '🗑️ Ta bort butik';
        deleteBtn.classList.add('action-btn', 'delete-btn', 'store-delete-btn');
        deleteBtn.disabled = stores.length <= 1;
        deleteBtn.title = stores.length <= 1 ? 'Det måste finnas minst en butik' : '';
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Ta bort "${store.name}"?`)) return;
            try {
                const result = await api(`/api/stores/${store.id}`, 'DELETE');
                stores = stores.filter(s => s.id !== store.id);
                storeEditor.hidden = true;
                await activateStore(result.activeStoreId);
            } catch (err) {
                alert(err.message);
            }
        });

        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(deleteBtn);
        storeEditor.appendChild(buttonRow);
    }

    function renderShoppingList(shoppingList) {
        lastShoppingList = shoppingList;
        const listContainer = document.querySelector('#shopping-list');
        listContainer.innerHTML = '';
        let currentCategory = null;
        shoppingList.forEach(item => {
            if (item.category !== currentCategory) {
                const heading = document.createElement('h3');
                heading.textContent = item.category;
                listContainer.appendChild(heading);
                currentCategory = item.category;
            }
            const row = document.createElement('div');
            row.classList.add('shopping-item');
            if (item.checked) row.classList.add('checked');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!item.checked;
            checkbox.addEventListener('change', async () => {
                await api(`/api/shopping-list/${item.id}/check`, 'PATCH');
                row.classList.toggle('checked');
            });
            const name = document.createElement('span');
            name.textContent = item.name;
            const amount = document.createElement('span');
            amount.textContent = item.amount ? `${item.amount} ${item.unit ?? ''}` : '';
            row.appendChild(checkbox);
            row.appendChild(name);
            row.appendChild(amount);
            listContainer.appendChild(row);
        });
    }

    generateBtn.addEventListener('click', async () => {
        const week = weeklyRecipes();
        if (week.length === 0) {
            alert('Lägg till recept i veckan först.');
            return;
        }
        const shoppingList = await api('/api/shopping-list', 'POST', { recipes: week });
        renderShoppingList(shoppingList);
        document.querySelector('[data-view="shopping"]').click();
    });
});
