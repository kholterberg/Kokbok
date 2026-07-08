const { scrapeIcaRecipe } = require('./ica');
const { scrapeCoopRecipe } = require('./coop');

const scrapers = {
    'ica.se': scrapeIcaRecipe,
    'coop.se': scrapeCoopRecipe,
};

function getScraperForUrl(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    return scrapers[hostname];
}

module.exports = { getScraperForUrl };