const { scrapeCoopRecipe } = require('./coop');
const { scrapeJsonLdRecipe } = require('./jsonld');

// Sajter som behöver specialhantering. Alla andra går via den generella JSON-LD-scrapern.
const scrapers = {
    'coop.se': scrapeCoopRecipe
};

function getScraperForUrl(url) {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return scrapers[hostname] || scrapeJsonLdRecipe;
}

module.exports = { getScraperForUrl };
