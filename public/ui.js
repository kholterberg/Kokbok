'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');

//vxläingsläger mellan veckans recept, kokbok och inköpslista
// varje flik har data-view="x" och en panel med id="x-view"
    function showView(selectedView){
        const panel = document.querySelector(`#${selectedView}-view`);
        if(!panel) return;

        tabs.forEach(button => {
            button.classList.toggle('active', button.dataset.view === selectedView);
        });
        document.querySelectorAll('.view-panel').forEach(view => {
            view.classList.toggle('active-panel', view === panel);
        });

        // spara valt läge, och visa det i adressen så att t.ex. /#cookbook går att bokmärka
        history.replaceState(null, '', `#${selectedView}`);
        try {
            localStorage.setItem('recipeView', selectedView);
        } catch {
            // localStorage kan vara avstängt (t.ex. privat läge) – inte viktigt
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => showView(tab.dataset.view));
    });

    // öppna fliken från adressen (#cookbook), annars samma flik som sist
    let savedView = location.hash.slice(1);
    try {
        savedView = savedView || localStorage.getItem('recipeView');
    } catch {
        // ignorera
    }
    if(savedView) showView(savedView);

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