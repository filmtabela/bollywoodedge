// pin.mjs — posts BollywoodEdge articles to Pinterest. Uses NO Claude/Anthropic tokens.
// Picks up to PINS_PER_RUN unpinned articles that have a hero image, newest first,
// posts each as a Pin linking back to imraankhan.in, and records it in pinned.json.
//
// Needs two GitHub repo secrets:
//   PINTEREST_TOKEN     — Pinterest API v5 access token with pins:write + boards:read
//   PINTEREST_BOARD_ID  — the numeric ID of the BollywoodEdge board to pin into
// If either is missing the script exits cleanly (green) and does nothing.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TOKEN = process.env.PINTEREST_TOKEN;
const BOARD = process.env.PINTEREST_BOARD_ID;
const PINS_PER_RUN = parseInt(process.env.PINS_PER_RUN || '3', 10);
const SITE = 'https://imraankhan.in';
const LEDGER = 'pinned.json';

if (!TOKEN || !BOARD) {
  console.log('Pinterest secrets not set yet (PINTEREST_TOKEN / PINTEREST_BOARD_ID). Nothing to do.');
  process.exit(0);
}

const pinned = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};

const meta = (html, re) => { const m = html.match(re); return m ? m[1].replace(/&amp;/g, '&').trim() : null; };

function lastCommitTime(file) {
  try { return parseInt(execSync(`git log -1 --format=%ct -- "${file}"`).toString().trim() || '0', 10); }
  catch { return 0; }
}

const candidates = fs.readdirSync('articles')
  .filter(f => f.endsWith('.html'))
  .map(f => {
    const fp = path.join('articles', f);
    const html = fs.readFileSync(fp, 'utf8');
    const slug = f.replace(/\.html$/, '');
    const title = (meta(html, /<title>([^<]+)<\/title>/) || slug).replace(/\s*-\s*BollywoodEdge\s*$/, '');
    const image = meta(html, /<meta property="og:image" content="([^"]+)"/);
    const desc = meta(html, /<meta name="description" content="([^"]+)"/) || title;
    return { slug, title, image, desc, t: lastCommitTime(fp) };
  })
  .filter(a => a.image && !pinned[a.slug])
  .sort((a, b) => b.t - a.t);

console.log(`${candidates.length} unpinned articles with images. Pinning up to ${PINS_PER_RUN}.`);

let failures = 0;
for (const a of candidates.slice(0, PINS_PER_RUN)) {
  const body = {
    board_id: BOARD,
    title: a.title.slice(0, 100),
    description: `${a.desc} #BollywoodStyle #IndianFashion #AmazonFinds`.slice(0, 500),
    link: `${SITE}/articles/${a.slug}.html`,
    alt_text: a.title.slice(0, 500),
    media_source: { source_type: 'image_url', url: a.image },
  };
  const res = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.ok) {
    const id = JSON.parse(text).id;
    pinned[a.slug] = { pin_id: id, at: new Date().toISOString() };
    console.log(`✅ Pinned ${a.slug} → ${id}`);
  } else {
    failures++;
    console.error(`❌ ${a.slug}: HTTP ${res.status} ${text.slice(0, 300)}`);
    if (res.status === 401 || res.status === 403) break; // token problem — stop, don't hammer
  }
}

fs.writeFileSync(LEDGER, JSON.stringify(pinned, null, 2) + '\n');
if (failures) process.exit(1); // red in Actions so failures are visible
