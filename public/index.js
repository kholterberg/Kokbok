/*document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#ReceptForm');
    const input = document.querySelector('#url');
    const recipeDiv = document.querySelector('#recipe-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = input.value;

        const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const recipe = await res.json();

        function createIngredientsRow(ingredients, index){

            const box = document.createElement('div');
            
            const title = document.createElement('h2');
            title.textContent = recipe.name;

            const table = document.createElement('table');
            //const nameInput = document.createElement('input');
            //nameInput.value = ingredients.name;

            //const amountInput = document.createElement('input');
            //amountInput.value = ingredients.amount;

            //const unitInput = document.createElement('input');
            //unitInput.value = ingredients.unit;

            //box.appendChild(nameInput);
            //box.appendChild(amountInput);
            //box.appendChild(unitInput);

            box.appendChild(title);
            box.appendChild(table);

            recipeDiv.appendChild(box);

            recipe.ingredients.forEach(ingredient => {
                const row = document.createElement("tr");

                const name = document.createElement("td");
                name.textContent = ingredient.name;

                const amount = document.createElement("td");
                amount.textContent = ingredient.amount;

                const unit = document.createElement("td");
                unit.textContent = ingredient.unit;

                row.appendChild(name);
                row.appendChild(amount);
                row.appendChild(unit);

                table.appendChild(row);
        }
        
        console.log(recipe);
        //recipe.ingredients.forEach(createIngredientsRow);

    });
});*/

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#ReceptForm');
    const input = document.querySelector('#url');
    const recipeContainer = document.querySelector('#recipe-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = input.value;

        const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const recipe = await res.json();

        //skapa design för receptet
        const box = document.createElement('div');
        box.classList.add('recipe');

        //namn på receptet och vart receptet kommer ifrån
        const title = document.createElement('h2');
        title.textContent = recipe.name;
        box.appendChild(title);

        //gör tabell för ingredisnerna
        const table = document.createElement('table');

        //lägger till alla ingredienser
        const img = document.createElement('img');
        img.src = recipe.image;
        img.alt = recipe.name;
        img.style.width = '200px';
        table.appendChild(img);
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

        box.appendChild(table);

        recipeContainer.appendChild(box);

        input.value = '';

        console.log(recipe);
    });
});