'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const recipeView = document.querySelector('#recipe-view');
    const shoppingView = document.querySelector('#shopping-view');

//vxläingsläger mellan recpet och inköpslista
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const selectedView = tab.dataset.view;
            // ta bort aktiv klass från alla knappar
            tabs.forEach(button => {
                button.classList.remove('active');
            });
            // aktivera vald knapp
            tab.classList.add('active');
            if(selectedView === 'recipes'){
                showRecipes();
            } else {
                showShopping();
            }

            // spara valt läge
            localStorage.setItem(
                'recipeView',
                selectedView
            );
        });
    });

    function showRecipes(){
        shoppingView.classList.remove(
            'active-panel'
        );

        recipeView.classList.add(
            'active-panel'
        );
    }

    function showShopping(){
        recipeView.classList.remove(
            'active-panel'
        );
        shoppingView.classList.add(
            'active-panel'
        );
    }

//animation för tillagda recept
    const recipeContainer =
        document.querySelector(
            '#recipe-container'
        );
    if(recipeContainer){
        const observer = new MutationObserver(
            mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if(
                            node.nodeType === 1 &&
                            node.classList.contains('recipe')
                        ){
                            node.style.opacity = '0';
                            setTimeout(() => {
                                node.style.opacity='1';
                            },50);
                        }
                    });
                });
            });
        observer.observe(
            recipeContainer,
            {
                childList:true
            }
        );
    }
});