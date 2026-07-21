'use strict';

const weeklyRecipes = []; // delas mellan båda listenerna

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#ReceptForm');
    const input = document.querySelector('#url');
    const recipeContainer = document.querySelector('#recipe-container');
    const generateBtn = document.querySelector('#generateList');
    const clearListBtn = document.querySelector('#clearList');

    async function loadSavedRecipes(){
        const res = await fetch('/api/recipes');
        const recipes = await res.json();

        recipes.forEach(recipe =>{
            weeklyRecipes.push(recipe);
            const card = renderRecipeCard(recipe);
            recipeContainer.appendChild(card);
        })
    }

    loadSavedRecipes();

    async function loadSavedShoppingList() {
        const res = await fetch('/api/shopping-list');
        const shoppingList = await res.json();
        if (shoppingList.length > 0) {
            renderShoppingList(shoppingList);
        }
    }
    
    loadSavedShoppingList();

    //visar upp den "vanliga" menyn där inget går att redigera
    function renderViewMode(recipe, recipeDiv) {
        recipeDiv.innerHTML = '';

        //const sourceLink = document.createElement('a');
        const img = document.createElement('img');
        img.src = recipe.image;
        img.alt = recipe.name;
        img.style.width = '200px';
        recipeDiv.appendChild(img);

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
    }

    function checkboxRecipe(){
        //TODO... Välja vilka recept som ska vara med i inköpslistan
    }

    // Visar upp redigeringsläget av recepten
    function renderEditMode(recipe, recipeDiv, recipeTitle, switchToView) {
        recipeDiv.innerHTML = '';

        const img = document.createElement('img');
        img.src = recipe.image;
        img.alt = recipe.name;
        img.style.width = '200px';
        recipeDiv.appendChild(img);

        const table = document.createElement('table');

        function createIngredientRow(ingredient) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = ingredient.name;
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
                const index = recipe.ingredients.indexOf(ingredient);
                if (index !== -1) recipe.ingredients.splice(index, 1);
                row.remove();
            });
            removeCell.appendChild(removeBtn);

            row.appendChild(nameCell);
            row.appendChild(amountCell);
            row.appendChild(unitCell);
            row.appendChild(removeCell);

            return row;
        }

        recipe.ingredients.forEach(ingredient => {
            table.appendChild(createIngredientRow(ingredient));
        });
        recipeDiv.appendChild(table);

        const addIngredientBtn = document.createElement('button');
        addIngredientBtn.textContent = '+ Lägg till ingrediens';
        addIngredientBtn.type = 'button';
        addIngredientBtn.addEventListener('click', () => {
            const newIngredient = { name: '', amount: null, unit: null };
            recipe.ingredients.push(newIngredient);
            table.appendChild(createIngredientRow(newIngredient));
        });
        recipeDiv.appendChild(addIngredientBtn);

        // Titeln blir redigerbar i redigeringsläge
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = recipe.name;
        titleInput.classList.add('recipe-title-input');
        titleInput.addEventListener('input', () => {
            recipe.name = titleInput.value;
        });
        recipeTitle.innerHTML = '';
        recipeTitle.appendChild(titleInput);

        // Spara knapp
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Spara';
        saveBtn.type = 'button';
        saveBtn.classList.add('save-btn');
        saveBtn.addEventListener('click', async () => {
            await fetch(`/api/recipes/${recipe.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: recipe.name,
                    image: recipe.image,
                    ingredients: recipe.ingredients
                })
            });
            switchToView();
        });
        recipeDiv.appendChild(saveBtn);
    }

    // Bygger receptkort, med pennan som växlar mellan lägena
    function renderRecipeCard(recipe) {
        const box = document.createElement('div');
        box.classList.add('recipe');
    
        const titleRow = document.createElement('div');
        titleRow.classList.add('recipe-title-row');
    
        const recipeTitle = document.createElement('h2');
        recipeTitle.textContent = recipe.name;

        if(recipe.url){
            const clickableLink = document.createElement('a');
            clickableLink.href = recipe.url;
            clickableLink.target = '_blank';
            clickableLink.appendChild(recipeTitle);
            titleRow.appendChild(clickableLink);
        }else{
            titleRow.appendChild(recipeTitle);
        }
    
        const editButton = document.createElement('button');
        editButton.textContent = '✏️';
        editButton.type = 'button';
        editButton.classList.add('edit-btn');
    
        titleRow.appendChild(editButton);
        box.appendChild(titleRow);
    
        const actionsRow = document.createElement('div');
        actionsRow.classList.add('recipe-actions');
    
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Ta bort';
        deleteBtn.type = 'button';
        deleteBtn.classList.add('action-btn', 'delete-btn');
        deleteBtn.addEventListener('click', async () => {
            const confirmed = confirm(`Vill du verkligen ta bort "${recipe.name}"?`);
            if (!confirmed) return;
    
            await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
            box.remove();
    
            const index = weeklyRecipes.indexOf(recipe);
            if (index !== -1) weeklyRecipes.splice(index, 1);
        });
    
        const cookbookBtn = document.createElement('button');
        cookbookBtn.type = 'button';
        cookbookBtn.classList.add('action-btn', 'cookbook-btn');
    
        if (recipe.in_cookbook) {
            cookbookBtn.textContent = '✅ I kokboken';
            cookbookBtn.disabled = true;
        } else {
            cookbookBtn.textContent = '📖 Lägg till i kokboken';
            cookbookBtn.addEventListener('click', async () => {
                await fetch(`/api/recipes/${recipe.id}/cookbook`, { method: 'PATCH' });
                cookbookBtn.textContent = '✅ I kokboken';
                cookbookBtn.disabled = true;
            });
        }
    
        actionsRow.appendChild(deleteBtn);
        actionsRow.appendChild(cookbookBtn);
        box.appendChild(actionsRow);
    
        const recipeDiv = document.createElement('div');
        box.appendChild(recipeDiv);
    
        function switchToView() {
            recipeTitle.textContent = recipe.name;
            editButton.style.display = 'inline-block';
            renderViewMode(recipe, recipeDiv);
        }
    
        editButton.addEventListener('click', () => {
            editButton.style.display = 'none';
            renderEditMode(recipe, recipeDiv, recipeTitle, switchToView);
        });
    
        renderViewMode(recipe, recipeDiv);
    
        return box;
    }
    const addManualBtn = document.querySelector('#addManualRecipe');

    addManualBtn.addEventListener('click', async () => {
    const recipe = {
        source: 'manual',
        name: 'Nytt recept',
        image: '',
        ingredients: []
    };

    weeklyRecipes.push(recipe);
    
    const saveRecipe = await fetch('/api/recipes',{
        method: 'POST',
        headers : {'Content-Type': 'application/json'},
        body: JSON.stringify(recipe)
    });
    
    const saved = await saveRecipe.json();
    recipe.id = saved.id;


    const card = renderRecipeCard(recipe);
    recipeContainer.appendChild(card);

    //denna kodrad ser till att redigeringsläget öppnas direkt för att det är ett recept man vill läögga till själv
    card.querySelector('.edit-btn').click();
    });

    clearListBtn.addEventListener('click', async () => {
        const confirmed = confirm('Rensa hela inköpslistan?');
        if (!confirmed) return;
    
        await fetch('/api/shopping-list', { method: 'DELETE' });
        document.querySelector('#shopping-list').innerHTML = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = input.value;

        const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const recipe = await res.json();
        weeklyRecipes.push(recipe);

        const saveRecipe = await fetch('/api/recipes',{
            method: 'POST',
            headers : {'Content-Type': 'application/json'},
            body: JSON.stringify(recipe)
        });

        const saved = await saveRecipe.json();
        recipe.id = saved.id;

        const card = renderRecipeCard(recipe);
        recipeContainer.appendChild(card);

        input.value = '';
        console.log(recipe);
    });

    function renderShoppingList(shoppingList) {
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
                await fetch(`/api/shopping-list/${item.id}/check`, { method: 'PATCH' });
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
        const res = await fetch('/api/shopping-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipes: weeklyRecipes })
        });
        const shoppingList = await res.json();
        renderShoppingList(shoppingList);
        document.querySelector('[data-view="shopping"]').click()
    });
});