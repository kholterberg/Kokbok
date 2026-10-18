const axios = require('axios');
const cheerio = require('cheerio');
const { parseIngredientString } = require('./utils');

async function scrapeZetaRecipe(url) {
    const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);

    const scripts = $('script[type="application/ld+json"]');
    let recipeData = null;

    scripts.each((i, el) => {
        try {
            const parsed = JSON.parse($(el).html());
            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            const found = candidates.find(item => item['@type'] === 'Recipe');
            if (found) recipeData = found;
        } catch (e) {
            // TODO...
        }
    });

    if (!recipeData) 
        return null;
    return normalizeZetaRecipe(recipeData, url);
}

function normalizeZetaRecipe(rawData, url) {
    return {
        source: 'zeta',
        url : url,
        name: rawData.name,
        image: Array.isArray(rawData.image) ? rawData.image[0] : rawData.image,
        ingredients: (rawData.recipeIngredient || []).map(parseIngredientString)
    };
}

module.exports = { scrapeZetaRecipe };