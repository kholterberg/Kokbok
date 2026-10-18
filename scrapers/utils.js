const UNICODE_FRACTIONS = {
    '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
    '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8'
};

// Vanliga enheter, så att t.ex. "2 gula lökar" inte tolkar "gula" som enhet
const KNOWN_UNITS = [
    'kg', 'hg', 'g', 'mg', 'l', 'dl', 'cl', 'ml', 'msk', 'tsk', 'krm', 'st', 'stk',
    'förp', 'frp', 'paket', 'pkt', 'burk', 'burkar', 'flaska', 'flaskor', 'påse', 'påsar',
    'klyfta', 'klyftor', 'kvist', 'kvistar', 'knippe', 'knippen', 'skiva', 'skivor',
    'nypa', 'krukor', 'kruka', 'blad', 'portion', 'portioner', 'liter', 'gram',
    'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'pinch', 'clove', 'cloves'
];

function parseIngredientString(str) {
    let text = str.trim();

    // "½" -> "1/2", "1½" -> "1 1/2"
    text = text.replace(/(\d?)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛])/g, (_, whole, frac) =>
        (whole ? `${whole} ` : '') + UNICODE_FRACTIONS[frac]
    );

    // "ca 3 dl" / "ungefär 3 dl" -> "3 dl"
    text = text.replace(/^(ca\.?|cirka|ungefär|about|approx\.?)\s+/i, '');

    // mängd: "2", "1,5", "1 1/2", "1/2", "1-2", "1–2"
    const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(.*)$/);
    if (!match) {
        return { name: text, amount: null, unit: null };
    }

    const [, rawAmount, rangeEnd, rest] = match;
    // vid intervall ("1-2 msk") tas det högre värdet, så att inköpslistan inte blir för snål
    const amount = rangeEnd ? parseFraction(rangeEnd) : parseFraction(rawAmount);

    const unitMatch = rest.match(/^([a-zA-ZåäöÅÄÖ]+)\.?\s+(.+)$/);
    if (unitMatch && KNOWN_UNITS.includes(unitMatch[1].toLowerCase())) {
        return { name: unitMatch[2].trim(), amount, unit: unitMatch[1].toLowerCase() };
    }

    return { name: rest.trim() || text, amount, unit: null };
}

function parseFraction(str) {
    if (str.includes('/')) {
        const parts = str.trim().split(/\s+/);
        const whole = parts.length > 1 ? parseFloat(parts[0]) : 0;
        const [num, denom] = parts[parts.length - 1].split('/').map(Number);
        return whole + (num / denom);
    }
    return parseFloat(str.replace(',', '.'));
}

module.exports = { parseIngredientString, parseFraction };
