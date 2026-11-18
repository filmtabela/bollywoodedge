// pinterest-oauth.mjs — BollywoodEdge Auto-Pin: connect our own Pinterest account via OAuth,
// then perform a live API action (create a Pin for our newest article).
// Run on the owner's computer:  node pinterest-oauth.mjs
// - Asks for the app secret with hidden input; the secret is never printed or saved.
// - Tokens are saved to ~/.bollywoodedge-pinterest.json (file mode 600) and never printed in full.
// - Requests only the scopes needed to read boards and create pins.

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { exec } from 'child_process';

const APP_ID = process.env.PINTEREST_APP_ID || '1623749';
const PORT = 8085;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
const SITE = 'https://imraankhan.in';
const STORE = path.join(os.homedir(), '.bollywoodedge-pinterest.json');

function askHidden(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); res(a.trim()); });
  });
}
const mask = t => t ? `${t.slice(0, 6)}…(${t.length} chars)` : '(none)';

const SECRET = process.env.PINTEREST_APP_SECRET || await askHidden('Paste the app secret (input hidden), then press Enter: ');
const basic = 'Basic ' + Buffer.from(`${APP_ID}:${SECRET}`).toString('base64');

async function tokenCall(params) {
  const r = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Token call failed: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
const api = (p, tok, opts = {}) => fetch(`https://api.pinterest.com/v5${p}`, {
  ...opts, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
});

// 1. Start the connection: open Pinterest's authorization page
const state = crypto.randomBytes(12).toString('hex');
const authUrl = 'https://www.pinterest.com/oauth/?' + new URLSearchParams({
  client_id: APP_ID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPES, state,
});
console.log('\n[1/4] Opening the Pinterest authorization page. Sign in / approve access in the browser...');
console.log('      Scopes requested:', SCOPES);

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname !== '/callback') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    if (u.searchParams.get('state') !== state || !u.searchParams.get('code')) {
      res.end('<h2>Connection failed. Return to the terminal.</h2>'); server.close();
      return reject(new Error('State mismatch or no code: ' + (u.searchParams.get('error') || '')));
    }
    res.end('<h2>BollywoodEdge Auto-Pin connected. You can close this tab and return to the terminal.</h2>');
    server.close(); resolve(u.searchParams.get('code'));
  }).listen(PORT, () => exec(`open "${authUrl}" || xdg-open "${authUrl}"`));
  setTimeout(() => reject(new Error('Timed out waiting for approval')), 300000);
});
console.log('[2/4] Redirected back to', REDIRECT, '— authorization code received.');

// 2. Exchange the code for tokens
const tok = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, continuous_refresh: 'true' });
fs.writeFileSync(STORE, JSON.stringify({ ...tok, saved_at: new Date().toISOString() }, null, 2), { mode: 0o600 });
console.log(`[3/4] Access token received: ${mask(tok.access_token)}, expires in ${tok.expires_in}s, scope: ${tok.scope}`);
console.log(`      Tokens stored locally at ${STORE} (permissions 600). Never printed in full.`);

// 3. Live API actions
const me = await (await api('/user_account', tok.access_token)).json();
console.log(`[4/4] Live API call — connected account: @${me.username}`);
// Trial access: Pinterest requires writes to go through its API Sandbox (api-sandbox.pinterest.com).
const SB = 'https://api-sandbox.pinterest.com/v5';
const sb = (p, opts = {}) => fetch(`${SB}${p}`, { ...opts, headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' } });
const prodBoards = (await (await api('/boards?page_size=100', tok.access_token)).json()).items || [];
console.log('      Boards on account:', prodBoards.map(b => b.name).join(' | '));
console.log('      Trial access: creating the demo Pin through the Pinterest API Sandbox.');
let board = ((await (await sb('/boards?page_size=100')).json()).items || [])[0];
if (!board) {
  const cb = await sb('/boards', { method: 'POST', body: JSON.stringify({ name: 'BollywoodEdge Demo Board', description: 'BollywoodEdge buying guides', privacy: 'PUBLIC' }) });
  board = await cb.json();
  if (!cb.ok) { console.log('      ❌ Sandbox board failed:', JSON.stringify(board).slice(0, 200)); process.exit(1); }
  console.log(`      Created sandbox board "${board.name}"`);
}

// newest US guide from our live site feed (sitemap)
const sm = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]*\/articles\/[^<]+)<\/loc>/g)].map(m => m[1]);
const slug = urls.reverse().find(u => /under-\d+-dollars/.test(u)) || urls[0];
const page = await (await fetch(slug.endsWith('.html') ? slug : slug + '.html')).text();
const img = (page.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
const title = ((page.match(/<title>([^<]+)<\/title>/) || [])[1] || 'BollywoodEdge guide').replace(/\s*-\s*BollywoodEdge\s*$/, '');
const pin = await sb('/pins', { method: 'POST', body: JSON.stringify({
  board_id: board.id, title: title.slice(0, 100), alt_text: title,
  description: `${title} #CelebrityStyle #AmazonFinds`.slice(0, 500),
  link: slug.endsWith('.html') ? slug : slug + '.html', media_source: { source_type: 'image_url', url: img },
}) });
const pj = await pin.json();
console.log(pin.ok ? `      ✅ Pin created: id ${pj.id} on board "${board.name}" — "${title}"` : `      ❌ Pin failed: HTTP ${pin.status} ${JSON.stringify(pj).slice(0, 200)}`);

// 4. Show refresh handling
if (tok.refresh_token) {
  const nt = await tokenCall({ grant_type: 'refresh_token', refresh_token: tok.refresh_token });
  fs.writeFileSync(STORE, JSON.stringify({ ...tok, ...nt, saved_at: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(`      Token refresh works: new access token ${mask(nt.access_token)}, saved securely.`);
}
console.log('\nDone. The app only creates Pins on our own account.');
