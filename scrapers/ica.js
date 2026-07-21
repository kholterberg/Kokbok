const axios = require('axios');
const cheerio = require('cheerio');
const { parseIngredientString } = require('./utils');

async function scrapeIcaRecipe(url) {
    const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);

    const script = $('script[type="application/ld+json"]').html();
    if (!script) 
        return null;

    const data = JSON.parse(script);
    return normalizeIcaRecipe(data, url);
}

function normalizeIcaRecipe(rawData, url) {
    return {
        source: 'ica',
        url : url,
        name: rawData.name,
        image: rawData.image,
        ingredients: rawData.recipeIngredient.map(parseIngredientString),
    };
}

module.exports = { scrapeIcaRecipe };