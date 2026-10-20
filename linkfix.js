// linkfix.js — keeps every Amazon link on the site honest. Zero API tokens.
//
// What it does to each amazon.in search link (/s?k=...):
//   1. Forces the correct Store ID (bollywooded0f-21). Clicks on any other tag
//      earn nothing for us.
//   2. Adds Amazon's own price filter (rh=p_36) matching the price the article
//      promises next to that link ("₹1,200–2,200", "From ₹999", "under ₹5,000").
//      Without it, "Banarasi sarees under ₹5,000" opened results full of
//      ₹15,000 sarees — the reader feels misled and leaves.
// Safe to run any number of times (idempotent).
//
// Used two ways:
//   node linkfix.js           → fixes every page, prints a report
//   node linkfix.js --check   → changes nothing; exits 1 if any link is wrong
//   require('./linkfix').fixAll(dir) → called by publish.js before each commit

const fs = require("fs");
const path = require("path");

const TAG = "bollywooded0f-21";
const LINK_RE = /https?:\/\/(?:www\.)?amazon\.in\/s\?[^"'\s<>]*/g;
const PRICE_RE = /(from|under|below|starting at|starts at)?\s*₹\s?([\d,]+)(?:\s*(?:–|-|—|to)\s*₹?\s?([\d,]+))?/gi;

const num = s => parseInt(String(s).replace(/,/g, ""), 10);

function parsePrice(text) {
  // Returns {lo, hi} in rupees (either may be null) for the LAST price in text.
  let m, last = null;
  PRICE_RE.lastIndex = 0;
  while ((m = PRICE_RE.exec(text))) last = m;
  if (!last) return null;
  const word = (last[1] || "").toLowerCase();
  const a = num(last[2]), b = last[3] ? num(last[3]) : null;
  if (!a) return null;
  if (b) return { lo: Math.min(a, b), hi: Math.max(a, b) };
  if (word === "under" || word === "below") return { lo: null, hi: a };
  if (word) return { lo: a, hi: null };          // from / starting at
  return { lo: a, hi: a };                        // single price
}

function filterFor(price, cap) {
  // Some slack either side so Amazon still shows plenty of choice.
  let lo = price && price.lo ? Math.floor(price.lo * 0.7) : null;
  let hi = price && price.hi ? Math.ceil(price.hi * 1.2) : null;
  if (price && price.lo && !price.hi) hi = null;            // "From ₹999"
  if (cap) hi = hi ? Math.min(hi, cap) : cap;                // title budget wins
  if (lo && hi && lo >= hi) lo = Math.floor(hi * 0.5);
  if (!lo && !hi) return null;
  return `p_36%3A${lo ? lo * 100 : ""}-${hi ? hi * 100 : ""}`; // Amazon uses paise
}

function rewriteUrl(url, rh) {
  let [base, query = ""] = url.replace(/&amp;/g, "&").split("?");
  const params = query.split("&").filter(p => p && !/^(tag|rh)=/.test(p));
  if (rh) params.push(`rh=${rh}`);
  params.push(`tag=${TAG}`);
  return `${base}?${params.join("&").replace(/&/g, "&amp;")}`;
}

function stripTags(s) { return s.replace(/<[^>]*>/g, " "); }

function fixHtml(html) {
  const titleM = html.match(/<title>([^<]*)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleM ? stripTags(titleM[1]) : "";
  const capM = title.match(/(?:under|below)\s*₹?\s?([\d,]+)/i);
  const cap = capM ? num(capM[1]) : null;

  const out = [];
  let last = 0, prevEnd = 0, changed = 0;
  const links = [...html.matchAll(LINK_RE)];
  links.forEach((m, i) => {
    const start = m.index, end = start + m[0].length;
    const nextStart = i + 1 < links.length ? links[i + 1].index : html.length;
    // Price search window: the same line first, then up to 3 lines above,
    // never crossing into another product's link.
    const lineStart = html.lastIndexOf("\n", start) + 1;
    let lineEnd = html.indexOf("\n", end); if (lineEnd < 0) lineEnd = html.length;
    const tagClose = html.indexOf(">", end);               // skip rest of <a ...>
    const after = stripTags(html.slice(tagClose + 1, Math.min(lineEnd, nextStart))).replace(/\s+/g, " ").trim();
    const before = stripTags(html.slice(Math.max(lineStart, prevEnd), start));
    let price = parsePrice(before) || parsePrice(after.slice(0, 80));
    if (!price) {
      let s = lineStart;
      for (let k = 0; k < 3 && s > 0; k++) s = html.lastIndexOf("\n", s - 2) + 1;
      price = parsePrice(stripTags(html.slice(Math.max(s, prevEnd), lineStart)));
    }
    const fixed = rewriteUrl(m[0], filterFor(price, cap));
    if (fixed !== m[0]) changed++;
    out.push(html.slice(last, start), fixed);
    last = end; prevEnd = end;
  });
  out.push(html.slice(last));
  return { html: out.join(""), changed, total: links.length };
}

function htmlFiles(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".html")).map(f => path.join(dir, f));
  const art = path.join(dir, "articles");
  if (fs.existsSync(art)) files.push(...fs.readdirSync(art).filter(f => f.endsWith(".html")).map(f => path.join(art, f)));
  return files;
}

// Cloudflare Web Analytics (free visitor counts; added 20-Oct-2026). Ensured on
// every page, so new articles from any template get it automatically.
const BEACON = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "ec5f74b874a14742abd8512d72289e70"}'></script><!-- End Cloudflare Web Analytics -->`;
function addBeacon(html) {
  if (html.includes("cloudflareinsights.com/beacon") || !/<\/body>/i.test(html)) return html;
  return html.replace(/<\/body>(?![\s\S]*<\/body>)/i, BEACON + "\n</body>");
}

function fixAll(dir, { write = true } = {}) {
  const report = { files: 0, links: 0, changed: 0, badTag: 0, noFilter: [] };
  for (const fp of htmlFiles(dir)) {
    const src = fs.readFileSync(fp, "utf8");
    report.badTag += (src.match(/amazon\.in\/[^"'\s<>]*tag=(?!bollywooded0f-21)[\w-]+/g) || []).length;
    const r = fixHtml(src);
    const withBeacon = addBeacon(r.html);
    if (withBeacon !== r.html) { r.html = withBeacon; r.changed++; report.beacons = (report.beacons || 0) + 1; }
    report.links += r.total;
    if (r.changed) { report.files++; report.changed += r.changed; if (write) fs.writeFileSync(fp, r.html); }
    for (const u of (write ? r.html : src).match(LINK_RE) || []) if (!/rh=p_36/.test(u)) report.noFilter.push(`${path.relative(dir, fp)}: ${u.slice(0, 90)}`);
  }
  return report;
}

module.exports = { fixHtml, fixAll, parsePrice, filterFor };

if (require.main === module) {
  const check = process.argv.includes("--check");
  const r = fixAll(__dirname, { write: !check });
  console.log(`${r.links} Amazon search links · ${r.changed} ${check ? "need fixing" : "fixed"} in ${r.files} files · wrong tag before: ${r.badTag}`);
  console.log(`${r.noFilter.length} links without a price filter (no price on the page to match):`);
  r.noFilter.slice(0, 40).forEach(l => console.log("  " + l));
  if (check && r.changed) process.exit(1);
}
