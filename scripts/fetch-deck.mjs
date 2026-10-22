// Fetches the 78 Rider-Waite-Smith cards from Wikimedia Commons into deck/,
// one JPEG per card at 400 pixels wide, named by the card ids in src/deck.ts.
// The 1909 illustrations by Pamela Colman Smith are in the public domain.
//
//   npm run fetch-deck
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MAJORS = ['00_Fool', '01_Magician', '02_High_Priestess', '03_Empress', '04_Emperor', '05_Hierophant', '06_Lovers', '07_Chariot', '08_Strength', '09_Hermit', '10_Wheel_of_Fortune', '11_Justice', '12_Hanged_Man', '13_Death', '14_Temperance', '15_Devil', '16_Tower', '17_Star', '18_Moon', '19_Sun', '20_Judgement', '21_World']
const SUITS = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pents' }
const OUT = 'deck'
const UA = 'tarot-mcp/0.1 (https://github.com/akuttruff/tarot-mcp)'

const files = []
for (const m of MAJORS) files.push({ id: `major-${m.slice(0, 2)}`, name: `RWS_Tarot_${m}.jpg` })
for (const [suit, prefix] of Object.entries(SUITS)) for (let n = 1; n <= 14; n++) files.push({ id: `${suit}-${String(n).padStart(2, '0')}`, name: `${prefix}${String(n).padStart(2, '0')}.jpg` })

mkdirSync(OUT, { recursive: true })
let fetched = 0
for (const f of files) {
  const out = join(OUT, `${f.id}.jpg`)
  if (existsSync(out) && !process.argv.includes('--force')) continue
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${f.name}?width=400`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} for ${f.name}`)
  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  fetched++
  await new Promise((r) => setTimeout(r, 150))
}
console.log(`${fetched} fetched, ${files.length} cards in ${OUT}/`)
