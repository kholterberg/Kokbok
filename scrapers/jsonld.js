const axios = require('axios');
const cheerio = require('cheerio');
const { parseIngredientString } = require('./utils');

// Generell scraper för alla sajter som följer schema.org/Recipe via JSON-LD
// (Arla, Köket, Tasteline, Zeta, ICA, AllRecipes, BBC Good Food m.fl.)
async function scrapeJsonLdRecipe(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
            'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8'
        },
        timeout: 15000
    });
    const $ = cheerio.load(response.data);

    const recipe = findRecipeInHtml($);
    if (!recipe) return null;

    return normalizeJsonLdRecipe(recipe, url);
}

// Går igenom alla JSON-LD-block på sidan, inte bara det första
function findRecipeInHtml($) {
    const scripts = $('script[type="application/ld+json"]').toArray();

    for (const script of scripts) {
        let data;
        try {
            data = JSON.parse($(script).html());
        } catch {
            continue; // vissa sajter har trasig JSON i något block, hoppa över det
        }
        const recipe = findRecipeNode(data);
        if (recipe) return recipe;
    }
    return null;
}

// Receptet kan ligga direkt, i en array eller i en @graph (vanligt på WordPress-sajter)
function findRecipeNode(node) {
    if (!node || typeof node !== 'object') return null;

    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findRecipeNode(item);
            if (found) return found;
        }
        return null;
    }

    const types = [].concat(node['@type'] || []);
    if (types.includes('Recipe')) return node;

    if (node['@graph']) return findRecipeNode(node['@graph']);
    return null;
}

function normalizeJsonLdRecipe(raw, url) {
    return {
        source: new URL(url).hostname.replace('www.', ''),
        url,
        name: decodeText(raw.name) || 'Namnlöst recept',
        description: decodeText(raw.description),
        image: extractImage(raw.image),
        servings: extractServings(raw.recipeYield),
        total_time: parseDuration(raw.totalTime) || sumDurations(raw.prepTime, raw.cookTime),
        ingredients: [].concat(raw.recipeIngredient || raw.ingredients || [])
            .map(decodeText)
            .filter(Boolean)
            .map(parseIngredientString),
        instructions: dropLoneSectionHeading(extractInstructions(raw.recipeInstructions))
    };
}

// En enda sektionsrubrik (t.ex. Arlas "Första instruktionen") tillför inget, så den tas bort
function dropLoneSectionHeading(steps) {
    const headings = steps.filter(step => step.startsWith('## '));
    if (headings.length === 1 && steps[0] === headings[0]) return steps.slice(1);
    return steps;
}

// image kan vara en sträng, en array av strängar, ett ImageObject eller en array av ImageObjects
function extractImage(image) {
    if (!image) return '';
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return extractImage(image[0]);
    return image.url || image.contentUrl || '';
}

// recipeYield kan vara "4", 4, "4 portioner" eller ["4", "4 portioner"]
function extractServings(recipeYield) {
    if (recipeYield == null) return null;
    if (Array.isArray(recipeYield)) {
        // ta den mest beskrivande varianten
        return extractServings(recipeYield.find(y => /\D/.test(String(y))) ?? recipeYield[0]);
    }
    return String(recipeYield).trim() || null;
}

// recipeInstructions kan vara en sträng, en lista med strängar, HowToStep eller HowToSection
function extractInstructions(instructions) {
    if (!instructions) return [];

    if (typeof instructions === 'string') {
        // dela upp på radbrytningar om allt ligger i en sträng (<br> och </p> räknas som radbrytning)
        return instructions
            .split(/\n+|<br\s*\/?>|<\/p>/i)
            .map(decodeText)
            .filter(Boolean);
    }

    if (Array.isArray(instructions)) {
        return instructions.flatMap(extractInstructions);
    }

    const types = [].concat(instructions['@type'] || []);
    if (types.includes('HowToSection')) {
        const steps = extractInstructions(instructions.itemListElement);
        return instructions.name ? [`## ${decodeText(instructions.name)}`, ...steps] : steps;
    }

    const text = decodeText(instructions.text || instructions.name);
    return text ? [text] : [];
}

// ISO 8601-tid, t.ex. "PT1H30M" -> 90 minuter
function parseDuration(iso) {
    if (typeof iso !== 'string') return null;
    const match = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!match) return null;
    const [, days, hours, minutes] = match.map(v => parseInt(v, 10) || 0);
    const total = days * 1440 + hours * 60 + minutes;
    return total || null;
}

function sumDurations(...isos) {
    const total = isos.reduce((sum, iso) => sum + (parseDuration(iso) || 0), 0);
    return total || null;
}

// Tar bort HTML-taggar och avkodar entiteter som &amp; och &#229;
function decodeText(value) {
    if (value == null) return '';
    const str = String(value);
    if (!/[<&]/.test(str)) return str.trim();
    return cheerio.load(`<div>${str}</div>`)('div').text().replace(/\s+/g, ' ').trim();
}

module.exports = { scrapeJsonLdRecipe, findRecipeInHtml, normalizeJsonLdRecipe, parseDuration };
