function parseIngredientString(str) {
    const match = str.match(/^([\d\s/.,]+)\s*([a-zA-ZåäöÅÄÖ]*)\s+(.+)$/);
    if (!match) {
        return { name: str.trim(), amount: null, unit: null };
    }
    const [, rawAmount, unit, name] = match;
    const amount = parseFraction(rawAmount.trim());
    return { name: name.trim(), amount, unit: unit.trim() || null };
}

function parseFraction(str) {
    if (str.includes('/')) {
        const parts = str.split(' ');
        const whole = parts.length > 1 ? parseFloat(parts[0]) : 0;
        const [num, denom] = parts[parts.length - 1].split('/').map(Number);
        return whole + (num / denom);
    }
    return parseFloat(str.replace(',', '.'));
}

module.exports = { parseIngredientString, parseFraction };