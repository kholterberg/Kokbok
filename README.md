# RecipeHub

Ett personligt webbverktyg för att samla recept från olika hemsidor, redigera dem, spara dem i en egen kokbok, och automatiskt generera en inköpslista som är sorterad efter min lokala matbutiks planlösning.

Byggt som ett hobbyprojekt för att lösa ett konkret vardagsproblem: sluta skriva om samma inköpslista för hand varje vecka, och sluta gå fram och tillbaka i butiken för att man missat en hylla.

## Funktioner

- **Scraping av recept** från i princip alla stora receptsajter (ICA, Arla, Köket, Tasteline, Zeta, BBC Good Food m.fl.) via en generell JSON-LD-scraper (schema.org/Recipe), plus sajtspecifik hantering för Coop
- **Instruktioner, portioner och tillagningstid** hämtas med, inte bara ingredienserna
- **Dubblettkontroll** — samma recept sparas inte två gånger, även om länken skiljer sig (www, `?utm_...`, `#...`)
- **Manuellt tillagda recept** för egna eller familjerecept som inte finns online, inklusive bilduppladdning
- **Redigeringsläge** per recept — justera namn, bild, ingredienser och instruktioner; sparas i databasen, med möjlighet att avbryta
- **Lokala bilder** — bilder laddas ner vid import så att kokboken fungerar även om källsajten tar bort dem
- **Permanent lagring** i en SQLite-databas — recept och inköpslista finns kvar även efter att sidan laddats om
- **Kokbok** — egen flik med sökning på namn och ingredienser; recept flyttas mellan kokboken och veckans recept
- **Automatisk backup** av databasen, för drift på en egen server
- **Automatisk inköpslista** som slår ihop dubbletter, kategoriserar ingredienser (mejeri, kött, grönt, osv.) och sorterar dem enligt en hårdkodad gångordning genom butiken
- **Avbockningsbara varor** i inköpslistan, med status sparad i databasen
- **Responsivt gränssnitt** med flikar för veckans recept, kokbok och inköpslista

| Del | Verktyg |
|---|---|
| Backend | Node.js + Express |
| Databas | SQLite (via `better-sqlite3`) |
| Scraping | `axios` + `cheerio` |
| Frontend | Vanilla JavaScript (DOM-manipulation, ingen ramverk) |
| Styling | Egen CSS, flexbox-baserad layout |

## Projektstruktur

```
Recipehub/
├── server.js                  # Express-server och alla API-routes
├── db.js                      # SQLite-anslutning och tabellschema
├── storeLayouts.js            # Butikers gångordning (kategori → position)
├── ingredientCategories.js    # Manuell mappning: ingrediensnamn → kategori
├── shoppingList.js            # Logik för kategorisering och sortering
├── auth.js                    # Valfri inloggning (HTTP Basic Auth)
├── images.js                  # Nedladdning och lagring av receptbilder
├── backup.js                  # Backup av databasen (manuell + schemalagd)
├── scripts/
│   ├── backup.js               # npm run backup
│   └── localize-images.js      # npm run images – laddar ner bilder för äldre recept
├── scrapers/
│   ├── index.js                # Väljer specialscraper per domän, annars JSON-LD
│   ├── jsonld.js               # Generell scraper för schema.org/Recipe
│   ├── coop.js                 # Scraping via Coops interna API
│   └── utils.js                # Parsing av ingrediens-strängar till {name, amount, unit}
├── Dockerfile
├── docker-compose.yml
└── public/
    ├── index.html
    ├── index.js                 # All receptlogik: rendering, redigering, spara, inköpslista
    ├── ui.js                    # Flikväxling och UI-detaljer
    └── style.css
```

## Hur scraping-strategin fungerar

Olika hemsidor strukturerar sin receptdata på helt olika sätt, så varje sajt hanteras av en egen scraper-modul:

- **ICA** har receptdata inbäddad direkt i sidans HTML som JSON-LD (`<script type="application/ld+json">`), vilket är standardformatet `schema.org/Recipe` — enklast att läsa av.
- **Coop** renderar sidan med JavaScript (React), så receptdatan finns inte i den råa HTML:en. Istället läses ett dolt recept-ID ut ur sidan, som sedan används för att anropa Coops eget interna API direkt.

- **Alla andra sajter** går via den generella JSON-LD-scrapern, som letar igenom alla JSON-LD-block (även `@graph`) efter ett `Recipe`. De flesta stora receptsajter lägger ut sina recept så, eftersom Google använder det för att visa recept i sökresultaten.

Varje scraper normaliserar sin sajts unika dataformat till en gemensam struktur:
```js
{
  name: "Receptets namn",
  image: "https://...",
  servings: "4 portioner",
  total_time: 45,               // minuter
  ingredients: [
    { name: "smör", amount: 100, unit: "g" },
    ...
  ],
  instructions: ["Sätt ugnen på 200°C.", "## Sås", "Vispa ihop..."]  // "## " = rubrik
}
```
Detta gör att resten av applikationen (visning, redigering, inköpslista) aldrig behöver bry sig om varifrån receptet kom.

## Kategorisering och butikssortering

Ingredienser mappas mot butikskategorier via en manuellt underhållen tabell (`ingredientCategories.js`), med delsträngsmatchning för att hantera varianter som "liten vispgrädde" mot "vispgrädde". Kategorierna sorteras sedan enligt en hårdkodad gångordning (`storeLayouts.js`) som är avläst direkt från butikens egen planlösningskarta — så inköpslistan följer samma ordning man faktiskt går genom butiken.

## Kommande funktioner

- [ ] Möjlighet att välja mellan flera butikslayouter i gränssnittet
- [ ] Bildkomprimering vid uppladdning
- [ ] Veckoplanering kopplad till kalenderdagar
- [ ] Portionsskalning
- [ ] Slå inte ihop samma ingrediens med olika enheter i inköpslistan (2 dl + 100 g)

## Köra projektet lokalt

```bash
git clone https://github.com/kalleholterberg/Recipehub.git
cd Recipehub
npm install
node server.js
```

Öppna sedan `http://localhost:3000` i webbläsaren.

## Driftsättning i homelab (Docker)

```bash
git clone https://github.com/kalleholterberg/Recipehub.git
cd Recipehub
mkdir -p data backups
sudo chown -R 1000:1000 data backups   # containern kör som uid 1000, inte root
cp .env.example .env                   # fyll i AUTH_USER/AUTH_PASSWORD för inloggning
docker compose up -d --build
```

Har du redan en `recept.db` lokalt: kopiera den till `data/recept.db` innan start, och kör sedan `docker compose exec recipehub npm run images` för att ladda ner bilderna till de gamla recepten.

### Inställningar (miljövariabler)

| Variabel | Standard | Beskrivning |
|---|---|---|
| `PORT` | `3000` | Port som servern lyssnar på |
| `DB_PATH` | `./recept.db` (`/data/recept.db` i Docker) | Sökväg till databasen |
| `IMAGE_DIR` | `./images` (`/data/images` i Docker) | Var receptbilder sparas |
| `AUTH_USER` / `AUTH_PASSWORD` | – | Slår på inloggning om båda är satta |
| `BACKUP_DIR` | – | Slår på automatisk backup till denna mapp |
| `BACKUP_INTERVAL_HOURS` | `24` | Hur ofta backup tas |
| `BACKUP_KEEP` | `14` | Antal backuper som sparas |

### Inloggning och åtkomst utifrån

Den inbyggda inloggningen (Basic Auth) räcker på hemnätverket eller via VPN (Tailscale/WireGuard). Ska sidan nås från internet: lägg den bakom en reverse proxy med HTTPS, t.ex. Caddy:

```
recept.example.se {
    reverse_proxy localhost:3000
}
```

Basic Auth skickar lösenordet med varje anrop, så använd det **bara över HTTPS** utanför hemnätet. Har proxyn egen inloggning (Authelia, Authentik) kan `AUTH_USER`/`AUTH_PASSWORD` lämnas tomma.

### Backup

- Databasen backas upp automatiskt till `./backups` (se `docker-compose.yml`). Lägg gärna den mappen på en annan disk eller NAS.
- Manuellt: `docker compose exec recipehub npm run backup` (eller `npm run backup` lokalt).
- Bilderna ligger i `./data/images` – ta med hela `data`-mappen i din vanliga backup.
- Återställning: stoppa containern, kopiera en backup till `data/recept.db`, starta igen.

## Bakgrund

Projektet är byggt stegvis som ett sätt att lära mig full-stack-utveckling i praktiken — från grundläggande DOM-manipulation och Express-routing, till web scraping av verkliga (och ibland ostrukturerade) hemsidor, till att sätta upp och koppla in en riktig databas. Fokus har legat på att lösa ett verkligt eget behov snarare än att följa ett färdigt facit, vilket lett till en hel del praktisk felsökning kring bland annat filstruktur, asynkron JavaScript och skillnaden mellan frontend- och backend-kod.
