const crypto = require('crypto');

// Enkel HTTP Basic Auth. Aktiveras bara om både AUTH_USER och AUTH_PASSWORD är satta,
// så att det går att köra utan lösenord lokalt eller bakom en reverse proxy med egen inloggning.
function basicAuth(user, password) {
    if (!user || !password) return (req, res, next) => next();

    const expected = Buffer.from(`${user}:${password}`);

    return (req, res, next) => {
        const [scheme, encoded] = (req.headers.authorization || '').split(' ');
        const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);

        // timingSafeEqual kräver lika långa buffrar, och skyddar mot timing-attacker
        const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
        if (ok) return next();

        res.set('WWW-Authenticate', 'Basic realm="RecipeHub", charset="UTF-8"');
        res.status(401).send('Inloggning krävs');
    };
}

module.exports = { basicAuth };
