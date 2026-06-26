import { pool, query } from '../db/pool';
import { migrate } from '../db/migrate';
import { Users, type User } from '../methods/tables/users';
import { CellarEntries, type CellarEntry } from '../methods/tables/cellarEntries';

// Seeds three demo users and their cellars. Idempotent: re-running upserts the
// users (keyed on email) and replaces their cellar entries. Run with:
//   npm run seed

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number): number => now - d * DAY;

type EntrySeed = Omit<CellarEntry, 'userId'>;

// Upsert a demo user, wipe their existing cellar, and insert fresh entries.
async function seedUser(profile: Partial<User> & { email: string }, entries: EntrySeed[]): Promise<void> {
  const user = await Users.upsert('email', profile);
  await query(`DELETE FROM cellar_entries WHERE data->>'userId' = $1`, [user.id]);
  for (const e of entries) {
    await CellarEntries.push({ ...e, userId: user.id });
  }
  console.log(`Seeded ${entries.length} entries for ${profile.email} (${user.id}).`);
}

async function run(): Promise<void> {
  await migrate();
  await seedTheo();
  await seedSloane();
  await seedInes();
  console.log('Seed complete.');
}

// --- placeholders, filled in below ---
async function seedTheo(): Promise<void> {
  await seedUser(
    {
      email: 'theo@example.com',
      displayName: 'Theo',
      depthPreference: 'beginner',
    },
    [
      {
        kind: 'wine',
        name: 'Pinot Grigio',
        producer: 'Santa Margherita',
        region: 'Veneto, Italy',
        source: 'scan',
        savedAt: daysAgo(5),
        tasted: true,
      },
      {
        kind: 'beer',
        name: 'Hazy Little Thing IPA',
        producer: 'Sierra Nevada',
        source: 'manual',
        savedAt: daysAgo(3),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Cotes du Rhone',
        producer: 'E. Guigal',
        region: 'Rhone Valley, France',
        source: 'somm',
        savedAt: daysAgo(1),
        tasted: true,
      },
    ],
  );
}
async function seedSloane(): Promise<void> {
  await seedUser(
    {
      email: 'sloane@example.com',
      displayName: 'Sloane',
      depthPreference: 'enthusiast',
      tasteSeed: 'Bold Italian reds, anything with structure. Slowly getting into sherry.',
      tasteSummary:
        'Leans toward structured Italian reds, with Barolo and Chianti Classico showing up again and again. Likes a savory, tannic backbone over fruit-forward softness. Has started exploring sherry, and the saline, oxidative styles are landing well.',
      tasteSummaryUpdatedAt: daysAgo(2),
    },
    [
      {
        kind: 'wine',
        name: 'Barolo',
        producer: 'G.D. Vajra',
        region: 'Piedmont, Italy',
        vintage: 2018,
        source: 'somm',
        notes: 'Tar and roses, exactly as advertised. Needed an hour to open up.',
        savedAt: daysAgo(60),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Chianti Classico',
        producer: 'Felsina',
        region: 'Tuscany, Italy',
        vintage: 2020,
        source: 'scan',
        notes: 'The house red benchmark now. Savory, lifted, food-friendly.',
        savedAt: daysAgo(48),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Brunello di Montalcino',
        producer: 'Il Poggione',
        region: 'Tuscany, Italy',
        vintage: 2017,
        source: 'somm',
        savedAt: daysAgo(40),
        tasted: false,
        owned: true,
      },
      {
        kind: 'wine',
        name: 'Etna Rosso',
        producer: 'Pietradolce',
        region: 'Sicily, Italy',
        vintage: 2021,
        source: 'scan',
        notes: 'Volcanic and bright. Lighter than I expected, in a good way.',
        savedAt: daysAgo(33),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Sancerre',
        producer: 'Pascal Jolivet',
        region: 'Loire Valley, France',
        vintage: 2022,
        source: 'somm',
        savedAt: daysAgo(28),
        tasted: true,
      },
      {
        kind: 'spirits',
        name: 'Lustau Los Arcos Amontillado',
        producer: 'Lustau',
        region: 'Jerez, Spain',
        abv: 18.5,
        source: 'somm',
        notes: 'The sherry that got me. Walnut, salt, dry as a bone.',
        savedAt: daysAgo(20),
        tasted: true,
      },
      {
        kind: 'beer',
        name: 'Pliny the Elder',
        producer: 'Russian River',
        abv: 8,
        source: 'manual',
        savedAt: daysAgo(14),
        tasted: true,
      },
      {
        kind: 'beer',
        name: 'Allagash White',
        producer: 'Allagash',
        abv: 5.2,
        source: 'scan',
        savedAt: daysAgo(9),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Barbera d\'Alba',
        producer: 'Vietti',
        region: 'Piedmont, Italy',
        vintage: 2021,
        source: 'scan',
        notes: 'Weeknight Piedmont. Juicy, high acid, no fuss.',
        savedAt: daysAgo(6),
        tasted: true,
      },
      {
        kind: 'spirits',
        name: 'Smith & Cross Navy Strength Rum',
        producer: 'Smith & Cross',
        region: 'Jamaica',
        abv: 57,
        source: 'manual',
        savedAt: daysAgo(2),
        tasted: false,
        owned: true,
      },
    ],
  );
}
async function seedInes(): Promise<void> {
  await seedUser(
    {
      email: 'ines@example.com',
      displayName: 'Ines',
      depthPreference: 'expert',
      tasteSeed: 'Burgundy and Barolo above all. Old-vine, low-intervention, cellar-worthy.',
      tasteSummary:
        'A collector\'s palate anchored in Burgundy and Piedmont, with a clear preference for structured, age-worthy reds and a deep bench of village and premier cru Burgundy. Reaches for savory, earthy, low-intervention wines over polish. Rounds it out with Trappist ales and a standing interest in Armagnac and agave spirits.',
      tasteSummaryUpdatedAt: daysAgo(1),
    },
    [
      {
        kind: 'wine',
        name: 'Gevrey-Chambertin',
        producer: 'Domaine Fourrier',
        region: 'Burgundy, France',
        vintage: 2019,
        source: 'somm',
        notes: 'Old-vine cuvee. Textbook Gevrey muscle under the perfume.',
        savedAt: daysAgo(90),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Barolo Cannubi',
        producer: 'Brezza',
        region: 'Piedmont, Italy',
        vintage: 2016,
        source: 'manual',
        savedAt: daysAgo(80),
        tasted: false,
        owned: true,
      },
      {
        kind: 'wine',
        name: 'Chablis 1er Cru Montee de Tonnerre',
        producer: 'Raveneau',
        region: 'Burgundy, France',
        vintage: 2020,
        source: 'somm',
        notes: 'Reference-point Chablis. Saline, taut, endless.',
        savedAt: daysAgo(70),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Vouvray Sec',
        producer: 'Domaine Huet',
        region: 'Loire Valley, France',
        vintage: 2018,
        source: 'scan',
        savedAt: daysAgo(60),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Cornas',
        producer: 'Thierry Allemand',
        region: 'Rhone Valley, France',
        vintage: 2017,
        source: 'manual',
        notes: 'Syrah that smells like olives and blood. Holding it five more years.',
        savedAt: daysAgo(50),
        tasted: false,
        owned: true,
      },
      {
        kind: 'spirits',
        name: 'Armagnac Bas-Armagnac 1998',
        producer: 'Domaine Boingneres',
        region: 'Gascony, France',
        abv: 48,
        source: 'somm',
        notes: 'Rancio and dried fig. The reason I stopped buying cognac.',
        savedAt: daysAgo(40),
        tasted: true,
      },
      {
        kind: 'beer',
        name: 'Westvleteren 12',
        producer: 'Westvleteren',
        abv: 10.2,
        source: 'manual',
        savedAt: daysAgo(30),
        tasted: true,
      },
      {
        kind: 'spirits',
        name: 'Del Maguey Chichicapa Mezcal',
        producer: 'Del Maguey',
        region: 'Oaxaca, Mexico',
        abv: 46,
        source: 'scan',
        savedAt: daysAgo(20),
        tasted: true,
      },
      {
        kind: 'wine',
        name: 'Volnay 1er Cru Caillerets',
        producer: 'Marquis d\'Angerville',
        region: 'Burgundy, France',
        vintage: 2019,
        source: 'somm',
        savedAt: daysAgo(10),
        tasted: false,
        owned: true,
      },
      {
        kind: 'wine',
        name: 'Champagne Brut Nature',
        producer: 'Pierre Peters',
        region: 'Champagne, France',
        source: 'scan',
        notes: 'Grower blanc de blancs. Chalk and citrus, zero dosage.',
        savedAt: daysAgo(3),
        tasted: true,
      },
    ],
  );
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
