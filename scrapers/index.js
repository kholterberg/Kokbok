const { scrapeIcaRecipe } = require('./ica');
const { scrapeCoopRecipe } = require('./coop');
const { scrapeZetaRecipe } = require('./zeta');
const { scrapeArlaRecipe } = require('./arla');

const scrapers = {
    'ica.se': scrapeIcaRecipe,
    'coop.se': scrapeCoopRecipe,
    'zeta.nu': scrapeZetaRecipe,
    'arla.se': scrapeArlaRecipe
};

function getScraperForUrl(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    return scrapers[hostname];
}

module.exports = { getScraperForUrl };