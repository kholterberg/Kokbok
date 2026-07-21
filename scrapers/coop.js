const axios = require('axios');
const cheerio = require('cheerio');
//const { raw } = require('express');

async function scrapeCoopRecipe(url) {// Hämta recept från coops  hemsida
    const recipeResponse = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(recipeResponse.data); // hämta html texten

    const getAttributeValue = $('main').attr('data-react-props'); // hämta ut attributen samt deras värden
    if (!getAttributeValue) 
        return null;

    const makeToObject = JSON.parse(getAttributeValue);//gör om texten till object
    const recipeId = makeToObject.recipeExternalId; // leta efter receptnummer för att sedan kunna importera det till min sida
    if (!recipeId) return null;

    const apiResponse = await axios.get( // här läggs id på recept in för att kunna lägga in det i min receptbok
        `https://proxy.api.coop.se/external/recipe/recipes/${recipeId}?api-version=v1`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    return normalizeCoopRecipe(apiResponse.data, url); // skicka receptet
}

function normalizeCoopRecipe(rawData, url) {
    const ingredients = rawData.recipePart.flatMap(part =>
        part.ingredients.map(ing => ({
            name: ing.name,
            amount: parseFloat(ing.quantity),
            unit: ing.unit
        }))
    );

    return {
        source: 'coop',
        url : url,
        name: rawData.name,
        image: rawData.imageUrl,
        ingredients
    };
}

module.exports = { scrapeCoopRecipe };