const express = require('express');
const { getScraperForUrl } = require('./scrapers');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        const scraper = getScraperForUrl(url);

        if (!scraper) {
            return res.status(400).json({ error: 'Sajten stöds inte än' });
        }

        const data = await scraper(url);
        if (!data) {
            return res.status(404).json({ error: 'Inget recept hittades' });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Servern är igång'));