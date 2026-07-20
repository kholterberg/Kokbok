# 🍽️ RecipeHub

Ett personligt webbverktyg för att samla recept från olika hemsidor, redigera dem, spara dem i en egen kokbok, och automatiskt generera en inköpslista som är sorterad efter min lokala matbutiks planlösning.

Byggt som ett hobbyprojekt för att lösa ett konkret vardagsproblem: sluta skriva om samma inköpslista för hand varje vecka, och sluta gå fram och tillbaka i butiken för att man missat en hylla.

## Funktioner

- **Scraping av recept** från stödda sajter (för närvarande ICA och Coop), via JSON-LD (schema.org) eller sajtspecifika API-anrop
- **Manuellt tillagda recept** för egna eller familjerecept som inte finns online, inklusive bilduppladdning
- **Redigeringsläge** per recept — justera ingredienser, mängder och namn innan de sparas, eftersom scraping aldrig är helt felfritt
- **Permanent lagring** i en SQLite-databas — recept och inköpslista finns kvar även efter att sidan laddats om
- **Kokbok** — markera recept som värda att spara permanent, separat från veckans tillfälliga recept
- **Automatisk inköpslista** som slår ihop dubbletter, kategoriserar ingredienser (mejeri, kött, grönt, osv.) och sorterar dem enligt en hårdkodad gångordning genom butiken
- **Avbockningsbara varor** i inköpslistan, med status sparad i databasen
- **Responsivt gränssnitt** med flikar för recept respektive inköpslista

## Teknikstack

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
├── scrapers/
│   ├── index.js                # Väljer rätt scraper baserat på URL:ens domän
│   ├── ica.js                  # Scraping via JSON-LD (schema.org)
│   ├── coop.js                 # Scraping via sajtens interna API
│   └── utils.js                # Parsing av ingrediens-strängar till {name, amount, unit}
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

Varje scraper normaliserar sin sajts unika dataformat till en gemensam struktur:
```js
{
  name: "Receptets namn",
  image: "https://...",
  ingredients: [
    { name: "smör", amount: 100, unit: "g" },
    ...
  ]
}
```
Detta gör att resten av applikationen (visning, redigering, inköpslista) aldrig behöver bry sig om varifrån receptet kom.

## Kategorisering och butikssortering

Ingredienser mappas mot butikskategorier via en manuellt underhållen tabell (`ingredientCategories.js`), med delsträngsmatchning för att hantera varianter som "liten vispgrädde" mot "vispgrädde". Kategorierna sorteras sedan enligt en hårdkodad gångordning (`storeLayouts.js`) som är avläst direkt från butikens egen planlösningskarta — så inköpslistan följer samma ordning man faktiskt går genom butiken.

## Kommande funktioner

- [ ] Fler sajt-scrapers (bland annat Arla Köket)
- [ ] Möjlighet att välja mellan flera butikslayouter i gränssnittet
- [ ] Bildkomprimering vid uppladdning
- [ ] Duplikatkontroll vid scraping (undvik att spara samma recept två gånger)
- [ ] Veckoplanering kopplad till kalenderdagar
- [ ] Separat kokboks-vy, frikopplad från veckans recept
- [ ] Enkelt lösenordsskydd inför eventuell driftsättning

## Köra projektet lokalt

```bash
git clone https://github.com/kalleholterberg/Recipehub.git
cd Recipehub
npm install
node server.js
```

Öppna sedan `http://localhost:3000` i webbläsaren.

## Bakgrund

Projektet är byggt stegvis som ett sätt att lära mig full-stack-utveckling i praktiken — från grundläggande DOM-manipulation och Express-routing, till web scraping av verkliga (och ibland ostrukturerade) hemsidor, till att sätta upp och koppla in en riktig databas. Fokus har legat på att lösa ett verkligt eget behov snarare än att följa ett färdigt facit, vilket lett till en hel del praktisk felsökning kring bland annat filstruktur, asynkron JavaScript och skillnaden mellan frontend- och backend-kod.
