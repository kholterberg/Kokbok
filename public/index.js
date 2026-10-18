'use strict';

let recipes = []; // alla recept från servern – veckan och kokboken är filter på denna lista

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#ReceptForm');
    const input = document.querySelector('#url');
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = submitBtn.textContent;
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

        // ?recept=12 i adressen öppnar receptet direkt (går att bokmärka eller skicka som länk)
        const linkedId = Number(new URLSearchParams(location.search).get('recept'));
        if (linkedId && recipes.some(recipe => recipe.id === linkedId)) openRecipe(linkedId);
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

    // Mängder visas med svenskt decimaltecken: 0.5 -> "0,5"
    function formatAmount(amount) {
        if (amount === null || amount === undefined || amount === '') return '';
        return Number(amount).toLocaleString('sv-SE', { maximumFractionDigits: 2 });
    }

    //visar upp den "vanliga" menyn där inget går att redigera
    function renderViewMode(recipe, recipeDiv) {
        recipeDiv.innerHTML = '';

        if (recipe.image) {
            const img = document.createElement('img');
            img.src = recipe.image;
            img.alt = '';
            img.classList.add('detail-image');
            recipeDiv.appendChild(img);
        }

        renderMeta(recipe, recipeDiv);

        if (recipe.description) {
            const description = document.createElement('p');
            description.classList.add('recipe-description');
            description.textContent = recipe.description;
            recipeDiv.appendChild(description);
        }

        // Ingredienser till vänster, instruktioner till höger (under varandra på mobil)
        const columns = document.createElement('div');
        columns.classList.add('detail-columns');

        const ingredientSection = document.createElement('section');
        const ingredientHeading = document.createElement('h3');
        ingredientHeading.textContent = 'Ingredienser';
        ingredientSection.appendChild(ingredientHeading);

        if (recipe.ingredients.length === 0) {
            const none = document.createElement('p');
            none.classList.add('muted');
            none.textContent = 'Inga ingredienser än. Tryck ✏️ för att lägga till.';
            ingredientSection.appendChild(none);
        } else {
            const table = document.createElement('table');
            table.classList.add('ingredient-table');
            recipe.ingredients.forEach(ingredient => {
                const row = document.createElement('tr');

                const amount = document.createElement('td');
                amount.classList.add('amount');
                amount.textContent = [formatAmount(ingredient.amount), ingredient.unit ?? ''].join(' ').trim();

                const name = document.createElement('td');
                name.textContent = ingredient.name;

                row.appendChild(amount);
                row.appendChild(name);
                table.appendChild(row);
            });
            ingredientSection.appendChild(table);
        }

        const instructionSection = document.createElement('section');
        renderInstructions(recipe, instructionSection);

        columns.appendChild(ingredientSection);
        columns.appendChild(instructionSection);
        recipeDiv.appendChild(columns);
    }

    function checkboxRecipe(){
        //TODO... Välja vilka recept som ska vara med i inköpslistan
    }

    // Tid, portioner och källa – varje uppgift som ett eget element i stället för "A · B · C"
    function recipeFacts(recipe) {
        const facts = [];
        if (recipe.total_time) facts.push(`⏱️ ${formatMinutes(recipe.total_time)}`);
        if (recipe.servings) facts.push(`🍽️ ${recipe.servings}`);
        return facts;
    }

    function renderMeta(recipe, recipeDiv) {
        const facts = recipeFacts(recipe);
        if (facts.length === 0 && !recipe.url) return;

        const meta = document.createElement('p');
        meta.classList.add('recipe-meta');
        facts.forEach(fact => {
            const span = document.createElement('span');
            span.textContent = fact;
            meta.appendChild(span);
        });

        if (recipe.url) {
            const link = document.createElement('a');
            link.href = recipe.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = `Originalrecept på ${recipe.source || 'webben'}`;
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
        const heading = document.createElement('h3');
        heading.textContent = 'Gör så här';
        recipeDiv.appendChild(heading);

        if (!recipe.instructions || recipe.instructions.length === 0) {
            const none = document.createElement('p');
            none.classList.add('muted');
            none.textContent = recipe.url
                ? 'Sajten skickade inga instruktioner – se originalreceptet.'
                : 'Inga instruktioner än. Tryck ✏️ för att skriva dem.';
            recipeDiv.appendChild(none);
            return;
        }

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
        img.alt = '';
        img.classList.add('detail-image');
        img.hidden = !draft.image;
        if (draft.image) img.src = draft.image;
        recipeDiv.appendChild(img);

        // Egen bild – skickas som data-URL och sparas som fil på servern
        const imageLabel = document.createElement('label');
        imageLabel.classList.add('image-upload');
        imageLabel.textContent = draft.image ? '🖼️ Byt bild' : '🖼️ Lägg till bild';
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

        const ingredientHeading = document.createElement('h3');
        ingredientHeading.textContent = 'Ingredienser';
        recipeDiv.appendChild(ingredientHeading);

        const table = document.createElement('table');
        table.classList.add('edit-table');

        function createIngredientRow(ingredient) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = ingredient.name;
            nameInput.placeholder = 'Ingrediens';
            nameInput.setAttribute('aria-label', 'Ingrediens');
            nameInput.addEventListener('input', () => {
                ingredient.name = nameInput.value;
            });
            nameCell.appendChild(nameInput);

            const amountCell = document.createElement('td');
            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.step = 'any';
            amountInput.inputMode = 'decimal';
            amountInput.placeholder = 'Mängd';
            amountInput.setAttribute('aria-label', 'Mängd');
            amountInput.value = ingredient.amount ?? '';
            amountInput.addEventListener('input', () => {
                ingredient.amount = amountInput.value === '' ? null : parseFloat(amountInput.value);
            });
            amountCell.appendChild(amountInput);

            const unitCell = document.createElement('td');
            const unitInput = document.createElement('input');
            unitInput.type = 'text';
            unitInput.placeholder = 'Enhet';
            unitInput.setAttribute('aria-label', 'Enhet');
            unitInput.value = ingredient.unit ?? '';
            unitInput.addEventListener('input', () => {
                ingredient.unit = unitInput.value === '' ? null : unitInput.value;
            });
            unitCell.appendChild(unitInput);

            const removeCell = document.createElement('td');
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.type = 'button';
            removeBtn.title = 'Ta bort ingrediensen';
            removeBtn.setAttribute('aria-label', 'Ta bort ingrediensen');
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
        addIngredientBtn.classList.add('add-ingredient-btn');
        addIngredientBtn.addEventListener('click', () => {
            const newIngredient = { name: '', amount: null, unit: null };
            draft.ingredients.push(newIngredient);
            const row = createIngredientRow(newIngredient);
            table.appendChild(row);
            row.querySelector('input').focus();
        });
        recipeDiv.appendChild(addIngredientBtn);

        // Instruktioner redigeras som ett steg per rad
        const instructionsLabel = document.createElement('h3');
        instructionsLabel.textContent = 'Gör så här';
        recipeDiv.appendChild(instructionsLabel);

        const instructionsInput = document.createElement('textarea');
        instructionsInput.classList.add('instructions-input');
        instructionsInput.rows = 8;
        instructionsInput.placeholder = 'Ett steg per rad';
        instructionsInput.setAttribute('aria-label', 'Instruktioner, ett steg per rad');
        instructionsInput.value = (draft.instructions || []).join('\n');
        instructionsInput.addEventListener('input', () => {
            draft.instructions = instructionsInput.value
                .split('\n')
                .map(step => step.trim())
                .filter(Boolean);
        });
        recipeDiv.appendChild(instructionsInput);

        // Titeln blir redigerbar i redigeringsläge
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = draft.name;
        titleInput.classList.add('recipe-title-input');
        titleInput.setAttribute('aria-label', 'Receptets namn');
        titleInput.addEventListener('input', () => {
            draft.name = titleInput.value;
        });
        recipeTitle.innerHTML = '';
        recipeTitle.appendChild(titleInput);

        const buttonRow = document.createElement('div');
        buttonRow.classList.add('edit-buttons');

        // Spara-knapp -> sparar i databasen och växlar tillbaka till vanligt läge
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Spara ändringar';
        saveBtn.type = 'button';
        saveBtn.classList.add('save-btn');
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Sparar…';
            try {
                const updated = await api(`/api/recipes/${recipe.id}`, 'PUT', draft);
                upsertRecipe(updated);
                renderAll(); // receptet kan synas både i veckan och kokboken
                switchToView();
            } catch (err) {
                alert(`Kunde inte spara: ${err.message}`);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Spara ändringar';
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
        titleInput.focus();
    }

    function actionButton(text, extraClass, onClick, title) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.type = 'button';
        btn.classList.add('action-btn');
        if (extraClass) btn.classList.add(extraClass);
        if (title) {
            btn.title = title;
            btn.setAttribute('aria-label', title);
        }
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
            // Byt ut mot nästa recept i turordningen (bara kokboksrecept – andra skulle raderas)
            if (recipe.in_cookbook) {
                const swapBtn = actionButton('🔄 Byt', 'swap-btn', async () => {
                    const result = await api(`/api/week/swap/${recipe.id}`, 'POST');
                    recipes = result.recipes;
                    renderAll();
                }, 'Byt mot ett annat recept från kokboken');
                actionsRow.appendChild(swapBtn);
            }

            const cookbookBtn = recipe.in_cookbook
                ? actionButton('✓ I kokboken', 'cookbook-btn')
                : actionButton('📖 Spara i kokboken', 'cookbook-btn', () => setFlags(recipe, { in_cookbook: 1 }));
            cookbookBtn.disabled = !!recipe.in_cookbook;
            actionsRow.appendChild(cookbookBtn);

            const removeBtn = actionButton('🗑️', 'delete-btn', async () => {
                if (!recipe.in_cookbook) {
                    const confirmed = confirm(`"${recipe.name}" finns inte i kokboken och tas bort helt. Fortsätta?`);
                    if (!confirmed) return;
                }
                await setFlags(recipe, { in_week: 0 });
            }, 'Ta bort från veckan');
            actionsRow.appendChild(removeBtn);
        } else {
            const weekBtn = recipe.in_week
                ? actionButton('✓ I veckan', 'week-btn', () => setFlags(recipe, { in_week: 0 }), 'Ta bort från veckans recept')
                : actionButton('➕ Lägg till i veckan', 'week-btn', () => setFlags(recipe, { in_week: 1 }));
            if (recipe.in_week) weekBtn.classList.add('active');

            const removeBtn = actionButton('🗑️', 'delete-btn', async () => {
                const message = recipe.in_week
                    ? `Ta bort "${recipe.name}" ur kokboken? Det finns kvar i veckans recept.`
                    : `Ta bort "${recipe.name}" helt?`;
                if (!confirm(message)) return;
                await setFlags(recipe, { in_cookbook: 0 });
            }, 'Ta bort ur kokboken');

            actionsRow.appendChild(weekBtn);
            actionsRow.appendChild(removeBtn);
        }
        return actionsRow;
    }

    // Kompakt kort: bild, namn, tid/portioner och knappar. Hela receptet öppnas i ett fönster,
    // så att alla kort blir lika höga och veckan går att överblicka.
    function renderRecipeCard(recipe, context) {
        const card = document.createElement('article');
        card.classList.add('recipe', 'recipe-card');
        card.dataset.id = recipe.id;

        const media = document.createElement('button');
        media.type = 'button';
        media.classList.add('card-media');
        media.tabIndex = -1; // titeln är samma knapp för tangentbordet
        media.setAttribute('aria-hidden', 'true');
        if (recipe.image) {
            const img = document.createElement('img');
            img.src = recipe.image;
            img.alt = '';
            img.loading = 'lazy';
            media.appendChild(img);
        } else {
            const placeholder = document.createElement('span');
            placeholder.classList.add('card-placeholder');
            placeholder.textContent = '🍲';
            media.appendChild(placeholder);
        }
        media.addEventListener('click', () => openRecipe(recipe.id));
        card.appendChild(media);

        const body = document.createElement('div');
        body.classList.add('card-body');

        const title = document.createElement('h3');
        title.classList.add('card-title');
        const titleBtn = document.createElement('button');
        titleBtn.type = 'button';
        titleBtn.classList.add('card-title-btn');
        titleBtn.textContent = recipe.name;
        titleBtn.addEventListener('click', () => openRecipe(recipe.id));
        title.appendChild(titleBtn);
        body.appendChild(title);

        const facts = recipeFacts(recipe);
        if (facts.length) {
            const list = document.createElement('ul');
            list.classList.add('card-facts');
            facts.forEach(fact => {
                const li = document.createElement('li');
                li.textContent = fact;
                list.appendChild(li);
            });
            body.appendChild(list);
        }

        if (context === 'cookbook' && !recipe.in_week) {
            const lastPlanned = document.createElement('p');
            lastPlanned.classList.add('last-planned');
            lastPlanned.textContent = formatLastInWeek(recipe.last_in_week);
            body.appendChild(lastPlanned);
        }

        body.appendChild(renderActions(recipe, context));
        card.appendChild(body);
        return card;
    }

    // ---------- Receptfönstret ----------

    const recipeDialog = document.querySelector('#recipe-dialog');
    const dialogTitle = document.querySelector('#dialog-title');
    const dialogBody = document.querySelector('#dialog-body');
    const dialogEditBtn = document.querySelector('#dialog-edit');
    const dialogCloseBtn = document.querySelector('#dialog-close');
    let openRecipeId = null;

    const currentRecipe = () => recipes.find(recipe => recipe.id === openRecipeId);

    // Titeln är en länk till originalreceptet (om det finns ett)
    function renderDialogTitle(recipe) {
        dialogTitle.textContent = '';
        if (recipe.url) {
            const link = document.createElement('a');
            link.href = recipe.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = recipe.name;
            link.title = 'Öppna originalreceptet';
            dialogTitle.appendChild(link);
        } else {
            dialogTitle.textContent = recipe.name;
        }
    }

    function showRecipe() {
        const recipe = currentRecipe();
        if (!recipe) return recipeDialog.close();
        renderDialogTitle(recipe);
        dialogEditBtn.hidden = false;
        renderViewMode(recipe, dialogBody);
    }

    function editRecipe() {
        const recipe = currentRecipe();
        if (!recipe) return;
        dialogEditBtn.hidden = true;
        renderEditMode(recipe, dialogBody, dialogTitle, showRecipe);
    }

    function openRecipe(id, { edit = false } = {}) {
        openRecipeId = id;
        showRecipe();
        if (edit) editRecipe();
        if (!recipeDialog.open) recipeDialog.showModal();
        dialogBody.scrollTop = 0;
        // fokus på innehållet (inte titellänken), så att man kan scrolla med tangentbordet direkt
        if (!edit) dialogBody.focus({ preventScroll: true });
    }

    dialogEditBtn.addEventListener('click', editRecipe);
    dialogCloseBtn.addEventListener('click', () => recipeDialog.close());
    // klick utanför fönstret stänger det
    recipeDialog.addEventListener('click', event => {
        if (event.target === recipeDialog) recipeDialog.close();
    });
    recipeDialog.addEventListener('close', () => {
        openRecipeId = null;
        dialogBody.innerHTML = '';
    });

    // ---------- Veckomeny ----------

    const generateWeekBtn = document.querySelector('#generateWeek');
    const weekCountInput = document.querySelector('#week-count');

    // Antalet kommer ihåg per enhet
    try {
        const savedCount = localStorage.getItem('weekCount');
        if (savedCount) weekCountInput.value = savedCount;
    } catch {
        // ignorera
    }
    weekCountInput.addEventListener('change', () => {
        try {
            localStorage.setItem('weekCount', weekCountInput.value);
        } catch {
            // ignorera
        }
    });

    // "2026-10-18 13:05:00" (UTC från SQLite) -> "Senast i veckomenyn för 3 veckor sedan"
    function formatLastInWeek(value) {
        if (!value) return 'Aldrig i veckomenyn';
        const days = Math.floor((Date.now() - new Date(value.replace(' ', 'T') + 'Z')) / 86400000);
        if (days < 1) return 'Senast i veckomenyn i dag';
        if (days < 7) return `Senast i veckomenyn för ${days} ${days === 1 ? 'dag' : 'dagar'} sedan`;
        const weeks = Math.floor(days / 7);
        if (weeks < 9) return `Senast i veckomenyn för ${weeks} ${weeks === 1 ? 'vecka' : 'veckor'} sedan`;
        return `Senast i veckomenyn för ${Math.floor(days / 30)} månader sedan`;
    }

    generateWeekBtn.addEventListener('click', async () => {
        const count = Math.min(14, Math.max(1, parseInt(weekCountInput.value, 10) || 6));

        if (cookbookRecipes().length === 0) {
            alert('Kokboken är tom. Spara recept i kokboken först, så kan veckomenyn genereras från dem.');
            return;
        }

        // Berätta vad som händer innan något byts ut
        const week = weeklyRecipes();
        const fromCookbook = week.filter(recipe => recipe.in_cookbook).length;
        const notInCookbook = week.length - fromCookbook;
        let message = `Skapa en ny veckomeny med ${count} recept från kokboken?`;
        if (fromCookbook) message += `\n\n${fromCookbook} recept i nuvarande veckomeny byts ut (de finns kvar i kokboken).`;
        if (notInCookbook) message += `\n${notInCookbook} recept som inte finns i kokboken ligger kvar och räknas in i antalet.`;
        if (week.length && !confirm(message)) return;

        generateWeekBtn.disabled = true;
        try {
            const result = await api('/api/week/generate', 'POST', { count });
            recipes = result.recipes;
            renderAll();
            if (result.added < result.needed) {
                alert(`Kokboken räckte till ${result.added} av ${result.needed} recept. Spara fler recept i kokboken för mer variation.`);
            }
        } catch (err) {
            alert(`Kunde inte skapa veckomeny: ${err.message}`);
        } finally {
            generateWeekBtn.disabled = false;
        }
    });

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

            //redigeringsläget öppnas direkt eftersom det är ett recept man vill skriva in själv
            openRecipe(saved.id, { edit: true });
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
        submitBtn.textContent = 'Hämtar…';

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
            submitBtn.textContent = submitLabel;
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

    const shoppingProgress = document.querySelector('#shopping-progress');

    function updateShoppingProgress() {
        const total = lastShoppingList.length;
        const done = lastShoppingList.filter(item => item.checked).length;
        shoppingProgress.textContent = total
            ? (done === total ? `Allt är handlat – ${total} varor` : `${done} av ${total} varor handlade`)
            : 'Automatisk lista från veckans recept';
    }

    function renderShoppingList(shoppingList) {
        lastShoppingList = shoppingList;
        const listContainer = document.querySelector('#shopping-list');
        listContainer.innerHTML = '';
        updateShoppingProgress();

        if (shoppingList.length === 0) {
            listContainer.appendChild(emptyMessage('Listan är tom. Tryck "Skapa inköpslista" under Veckan.'));
            return;
        }

        let currentCategory = null;
        shoppingList.forEach(item => {
            if (item.category !== currentCategory) {
                const heading = document.createElement('h3');
                heading.classList.add('shopping-category');
                heading.textContent = item.category;
                listContainer.appendChild(heading);
                currentCategory = item.category;
            }

            // <label> gör att hela raden bockar av – lättare att träffa med tummen i butiken
            const row = document.createElement('label');
            row.classList.add('shopping-item');
            if (item.checked) row.classList.add('checked');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!item.checked;
            checkbox.addEventListener('change', async () => {
                row.classList.toggle('checked', checkbox.checked);
                try {
                    const result = await api(`/api/shopping-list/${item.id}/check`, 'PATCH');
                    item.checked = result.checked;
                    updateShoppingProgress();
                } catch (err) {
                    checkbox.checked = !checkbox.checked;
                    row.classList.toggle('checked', checkbox.checked);
                    alert(`Kunde inte spara: ${err.message}`);
                }
            });

            const name = document.createElement('span');
            name.classList.add('item-name');
            name.textContent = item.name;

            const amount = document.createElement('span');
            amount.classList.add('item-amount');
            amount.textContent = item.amount ? `${formatAmount(item.amount)} ${item.unit ?? ''}`.trim() : '';

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
