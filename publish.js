const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ============================================================
// CONFIGURATION
// ============================================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SITE_DIR = process.cwd();
const ASSOCIATE_TAG = "bollywoodedge-20";
const AMAZON_BASE = "https://www.amazon.com";
// ============================================================

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const TOPICS = [
  { title: "Katrina Kaif Skincare Routine", category: "Skincare", tags: ["Katrina Kaif", "Skincare", "Glow"], emoji: "✨", amazonQuery: "vitamin+c+serum+skincare" },
  { title: "Ranveer Singh Street Style Guide", category: "Men's Style", tags: ["Ranveer Singh", "Street Style", "Men"], emoji: "👑", amazonQuery: "men+streetwear+jacket" },
  { title: "Priyanka Chopra Jewellery Picks", category: "Accessories", tags: ["Priyanka Chopra", "Jewellery", "Accessories"], emoji: "💍", amazonQuery: "statement+jewellery+women" },
  { title: "Bollywood Wedding Guest Outfit Guide", category: "Ethnic Wear", tags: ["Wedding", "Ethnic Wear", "Lehenga"], emoji: "🪷", amazonQuery: "wedding+guest+lehenga" },
  { title: "Sara Ali Khan Beauty Essentials", category: "Beauty", tags: ["Sara Ali Khan", "Beauty", "Makeup"], emoji: "💄", amazonQuery: "makeup+kit+bestseller" },
  { title: "Bollywood Mens Fragrance Guide", category: "Fragrance", tags: ["Men", "Fragrance", "Cologne"], emoji: "🌸", amazonQuery: "men+perfume+bestseller" },
  { title: "Alia Bhatt Casual Looks on Amazon", category: "Fashion", tags: ["Alia Bhatt", "Casual", "Fashion"], emoji: "👗", amazonQuery: "casual+kurta+set+women" },
  { title: "Deepika Padukone Gym Wear Picks", category: "Fitness", tags: ["Deepika Padukone", "Gym", "Fitness"], emoji: "💪", amazonQuery: "women+gym+wear" },
  { title: "Kareena Kapoor Maternity Style", category: "Fashion", tags: ["Kareena Kapoor", "Maternity", "Style"], emoji: "🌟", amazonQuery: "maternity+wear+women" },
  { title: "Sonam Kapoor Red Carpet Looks", category: "Luxury", tags: ["Sonam Kapoor", "Red Carpet", "Glamour"], emoji: "🎬", amazonQuery: "evening+gown+women" },
  { title: "Hrithik Roshan Fitness Wardrobe", category: "Men's Fitness", tags: ["Hrithik Roshan", "Fitness", "Men"], emoji: "🏋️", amazonQuery: "men+gym+wear" },
  { title: "Janhvi Kapoor Summer Style Guide", category: "Summer Fashion", tags: ["Janhvi Kapoor", "Summer", "Style"], emoji: "☀️", amazonQuery: "summer+dress+women" },
  { title: "Anushka Sharma Athleisure Guide", category: "Fitness", tags: ["Anushka Sharma", "Athleisure", "Style"], emoji: "🧘", amazonQuery: "women+athleisure+wear" },
  { title: "Vidya Balan Saree Style Decoded", category: "Ethnic Wear", tags: ["Vidya Balan", "Saree", "Traditional"], emoji: "🪷", amazonQuery: "cotton+silk+saree" },
  { title: "Tiger Shroff Streetwear Guide", category: "Men's Style", tags: ["Tiger Shroff", "Streetwear", "Men"], emoji: "👟", amazonQuery: "men+joggers+streetwear" },
  { title: "Taapsee Pannu Minimalist Style", category: "Fashion", tags: ["Taapsee Pannu", "Minimalist", "Casual"], emoji: "🤍", amazonQuery: "minimalist+women+fashion" },
];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getExistingSlugs(articlesDir) {
  if (!fs.existsSync(articlesDir)) return [];
  return fs.readdirSync(articlesDir)
    .filter(f => f.endsWith(".html"))
    .map(f => f.replace(".html", ""));
}

function getTodaysTopic(existingSlugs) {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[(dayOfYear + i) % TOPICS.length];
    if (!existingSlugs.includes(slugify(topic.title))) return topic;
  }
  return TOPICS[dayOfYear % TOPICS.length];
}

function getArticleMetadata(articlesDir, slugs) {
  return slugs.map(slug => {
    const filePath = path.join(articlesDir, `${slug}.html`);
    const content = fs.readFileSync(filePath, "utf8");

    // Match title from <title> tag, strip suffix
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch ? titleMatch[1] : slug;
    const title = rawTitle.replace(/\s*-\s*BollywoodEdge\s*$/, "").trim();

    // Always prefer TOPICS as source of truth for category/emoji
    const matchedTopic = TOPICS.find(t => slugify(t.title) === slug);
    const category = matchedTopic ? matchedTopic.category : "Fashion";
    const emoji = matchedTopic ? matchedTopic.emoji : "✨";
    const emojiCat = `${emoji} ${category}`;

    return { slug, title, emojiCat, category };
  }).reverse();
}

function getCategoryVisual(category) {
  const visuals = {
    "Skincare": {
      bg: ["#1A0A1F", "#3D1A5C"], accent: "#AFA9EC", mid: "#7F77DD",
      shape: `<ellipse cx="100" cy="78" rx="30" ry="35" fill="#7F77DD" opacity="0.45"/>
        <circle cx="100" cy="42" r="11" fill="#EEEDFE" opacity="0.95"/>
        <circle cx="88" cy="74" r="6" fill="#AFA9EC" opacity="0.6"/>
        <circle cx="112" cy="70" r="5" fill="#AFA9EC" opacity="0.5"/>
        <circle cx="100" cy="82" r="7" fill="#AFA9EC" opacity="0.7"/>
        <path d="M82 112 Q100 120 118 112" stroke="#AFA9EC" stroke-width="1.5" fill="none"/>
        <path d="M84 112 L82 125 M116 112 L118 125" stroke="#AFA9EC" stroke-width="3" stroke-linecap="round"/>`,
      label: "SKINCARE"
    },
    "Men's Style": {
      bg: ["#0D1A2E", "#1E3A5F"], accent: "#85B7EB", mid: "#378ADD",
      shape: `<path d="M90 40 L110 40 L116 55 L130 55 L130 112 L70 112 L70 55 L84 55 Z" fill="#378ADD" opacity="0.7"/>
        <rect x="88" y="28" width="24" height="16" rx="4" fill="#85B7EB" opacity="0.8"/>
        <circle cx="100" cy="36" r="7" fill="#E6F1FB" opacity="0.95"/>
        <path d="M75 112 L72 125 M125 112 L128 125" stroke="#85B7EB" stroke-width="3" stroke-linecap="round"/>
        <path d="M84 55 L100 70 L116 55" stroke="#B5D4F4" stroke-width="1" fill="none" opacity="0.6"/>`,
      label: "MEN'S STYLE"
    },
    "Accessories": {
      bg: ["#1A150A", "#3D3010"], accent: "#FAC775", mid: "#EF9F27",
      shape: `<path d="M70 75 Q85 45 100 50 Q115 45 130 75 Q115 105 100 100 Q85 105 70 75Z" fill="#EF9F27" opacity="0.6"/>
        <circle cx="100" cy="75" r="10" fill="#FAC775" opacity="0.9"/>
        <path d="M65 75 L55 65 M135 75 L145 65" stroke="#FAC775" stroke-width="2"/>
        <circle cx="100" cy="38" r="11" fill="#FAEEDA" opacity="0.95"/>
        <path d="M84 112 L82 125 M116 112 L118 125" stroke="#FAC775" stroke-width="3" stroke-linecap="round"/>`,
      label: "ACCESSORIES"
    },
    "Ethnic Wear": {
      bg: ["#0A1F0F", "#1D5C2A"], accent: "#5DCAA5", mid: "#1D9E75",
      shape: `<path d="M100 30 Q80 35 76 55 L72 112 Q100 120 128 112 L124 55 Q120 35 100 30Z" fill="#1D9E75" opacity="0.75"/>
        <path d="M86 112 L84 125 M114 112 L116 125" stroke="#5DCAA5" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="24" r="10" fill="#9FE1CB" opacity="0.95"/>
        <path d="M82 62 Q100 56 118 62" stroke="#9FE1CB" stroke-width="1.5" fill="none"/>
        <path d="M79 77 Q100 70 121 77" stroke="#9FE1CB" stroke-width="1" fill="none" opacity="0.5"/>
        <path d="M80 92 Q100 85 120 92" stroke="#9FE1CB" stroke-width="1" fill="none" opacity="0.3"/>`,
      label: "ETHNIC WEAR"
    },
    "Beauty": {
      bg: ["#1F0A0A", "#5C1A1A"], accent: "#F0997B", mid: "#D85A30",
      shape: `<path d="M80 58 Q100 45 120 58 L130 112 H70 Z" fill="#993C1D" opacity="0.8"/>
        <circle cx="100" cy="40" r="11" fill="#F5C4B3" opacity="0.95"/>
        <circle cx="93" cy="66" r="3.5" fill="#F5C4B3" opacity="0.7"/>
        <circle cx="107" cy="66" r="3.5" fill="#F5C4B3" opacity="0.7"/>
        <circle cx="100" cy="61" r="3.5" fill="#F5C4B3" opacity="0.7"/>
        <path d="M85 112 L83 125 M115 112 L117 125" stroke="#F0997B" stroke-width="3" stroke-linecap="round"/>`,
      label: "BEAUTY"
    },
    "Fashion": {
      bg: ["#1A0010", "#6B0050"], accent: "#FF6B9D", mid: "#E91E8C",
      shape: `<path d="M85 50 Q100 42 115 50 L122 112 H78 Z" fill="#E91E8C" opacity="0.75"/>
        <path d="M78 112 L75 125 M122 112 L125 125" stroke="#FF6B9D" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="36" r="11" fill="#FBEAF0" opacity="0.95"/>
        <path d="M85 68 Q100 62 115 68" stroke="#FF6B9D" stroke-width="1.5" fill="none"/>
        <path d="M83 83 Q100 76 117 83" stroke="#FF6B9D" stroke-width="1" fill="none" opacity="0.5"/>`,
      label: "FASHION"
    },
    "Fragrance": {
      bg: ["#0F1A2E", "#1A2E4A"], accent: "#9FE1CB", mid: "#1D9E75",
      shape: `<rect x="82" y="55" width="36" height="52" rx="6" fill="#1D9E75" opacity="0.7"/>
        <rect x="90" y="42" width="20" height="16" rx="3" fill="#5DCAA5" opacity="0.8"/>
        <rect x="97" y="35" width="6" height="10" rx="2" fill="#9FE1CB" opacity="0.9"/>
        <ellipse cx="100" cy="55" rx="18" ry="4" fill="#9FE1CB" opacity="0.5"/>
        <path d="M88 74 Q100 70 112 74" stroke="#9FE1CB" stroke-width="1" fill="none"/>
        <path d="M88 86 Q100 82 112 86" stroke="#9FE1CB" stroke-width="1" fill="none" opacity="0.5"/>`,
      label: "FRAGRANCE"
    },
    "Fitness": {
      bg: ["#1A0010", "#3D0030"], accent: "#FF6B9D", mid: "#E91E8C",
      shape: `<path d="M82 70 Q100 64 118 70 L124 112 H76 Z" fill="#E91E8C" opacity="0.7"/>
        <circle cx="100" cy="44" r="10" fill="#FFF5FA" opacity="0.95"/>
        <ellipse cx="100" cy="52" rx="18" ry="8" fill="#E91E8C" opacity="0.5"/>
        <path d="M82 88 Q100 82 118 88" stroke="#FF6B9D" stroke-width="1.5" fill="none"/>
        <path d="M80 103 Q100 96 120 103" stroke="#FF6B9D" stroke-width="1" fill="none" opacity="0.5"/>
        <path d="M88 112 L86 125 M112 112 L114 125" stroke="#FF6B9D" stroke-width="3" stroke-linecap="round"/>`,
      label: "FITNESS"
    },
    "Summer Fashion": {
      bg: ["#1A1200", "#3D2D00"], accent: "#FAC775", mid: "#EF9F27",
      shape: `<circle cx="100" cy="30" r="16" fill="#EF9F27" opacity="0.35"/>
        <path d="M88 48 Q100 42 112 48 L118 112 H82 Z" fill="#EF9F27" opacity="0.75"/>
        <circle cx="100" cy="36" r="11" fill="#FAEEDA" opacity="0.95"/>
        <path d="M82 112 L80 125 M118 112 L120 125" stroke="#FAC775" stroke-width="3" stroke-linecap="round"/>
        <path d="M85 70 Q100 64 115 70" stroke="#FAC775" stroke-width="1.5" fill="none"/>`,
      label: "SUMMER"
    },
    "Luxury": {
      bg: ["#1A1500", "#3D3200"], accent: "#FAC775", mid: "#BA7517",
      shape: `<path d="M80 50 Q100 38 120 50 L128 112 H72 Z" fill="#BA7517" opacity="0.7"/>
        <circle cx="100" cy="36" r="11" fill="#FAEEDA" opacity="0.95"/>
        <polygon points="100,54 103,62 112,62 105,67 108,75 100,70 92,75 95,67 88,62 97,62" fill="#FAC775" opacity="0.85"/>
        <path d="M80 112 L77 125 M120 112 L123 125" stroke="#FAC775" stroke-width="3" stroke-linecap="round"/>`,
      label: "LUXURY"
    },
    "Men's Fitness": {
      bg: ["#0A1520", "#1A2E40"], accent: "#85B7EB", mid: "#378ADD",
      shape: `<path d="M85 48 Q100 40 115 48 L122 112 H78 Z" fill="#378ADD" opacity="0.7"/>
        <circle cx="100" cy="36" r="11" fill="#E6F1FB" opacity="0.95"/>
        <rect x="68" y="66" width="14" height="6" rx="3" fill="#85B7EB" opacity="0.7"/>
        <rect x="118" y="66" width="14" height="6" rx="3" fill="#85B7EB" opacity="0.7"/>
        <path d="M82 69 L118 69" stroke="#85B7EB" stroke-width="2"/>
        <path d="M83 85 Q100 78 117 85" stroke="#85B7EB" stroke-width="1.5" fill="none"/>
        <path d="M80 112 L78 125 M120 112 L122 125" stroke="#85B7EB" stroke-width="3" stroke-linecap="round"/>`,
      label: "MEN'S FITNESS"
    }
  };

  const v = visuals[category] || visuals["Fashion"];

  return `<svg viewBox="0 0 200 150" width="200" height="150" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${v.bg[0]}"/>
        <stop offset="100%" stop-color="${v.bg[1]}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="150" fill="url(#bg-grad)"/>
    ${v.shape}
    <text x="100" y="138" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="${v.accent}" font-style="italic" letter-spacing="2">${v.label}</text>
    <line x1="30" y1="134" x2="60" y2="134" stroke="${v.mid}" stroke-width="0.5" opacity="0.5"/>
    <line x1="140" y1="134" x2="170" y2="134" stroke="${v.mid}" stroke-width="0.5" opacity="0.5"/>
  </svg>`;
}

async function generateArticle(topic) {
  console.log(`\n📝 Generating article: ${topic.title}...`);
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `Write a detailed SEO-optimised Bollywood style guide article about: "${topic.title}"

The article should:
- Be 600-800 words
- Have an engaging introduction mentioning the celebrity
- Include 4-5 specific product recommendations with descriptions (these will link to Amazon)
- Have subheadings using H2 tags
- Be written for Indian women aged 20-40 interested in Bollywood fashion
- End with a call to action to shop on Amazon
- Be factual, engaging and editorial in tone like a magazine article
- Do NOT include any HTML tags, just plain text with subheadings marked as ## Subheading

Return ONLY the article text, no preamble.`
    }]
  });
  return message.content[0].text;
}

function buildArticleHTML(topic, articleText) {
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const visual = getCategoryVisual(topic.category);
  const bodyHTML = articleText.split("\n").map(line => {
    if (line.startsWith("## ")) return `<h2>${line.replace("## ", "")}</h2>`;
    if (line.trim() === "") return "";
    return `<p>${line}</p>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic.title} - BollywoodEdge</title>
<meta name="description" content="${topic.title} - shop every piece on Amazon. Bollywood style decoded.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--pink:#E91E8C;--coral:#FF6B9D;--dark:#1A0010;--text:#2D0020;--muted:#8B4570;--white:#FFFFFF;}
body{font-family:'DM Sans',sans-serif;background:#FFF5FA;color:var(--text);overflow-x:hidden;}
.ticker-wrap{background:var(--dark);color:var(--white);padding:10px 0;overflow:hidden;white-space:nowrap;}
.ticker-inner{display:inline-block;animation:ticker 30s linear infinite;}
.ticker-inner span{margin:0 40px;font-size:13px;}
.ticker-inner span b{color:var(--coral);}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
header{background:var(--white);border-bottom:3px solid var(--pink);position:sticky;top:0;z-index:100;}
.header-inner{max-width:1200px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:64px;}
.logo{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--pink);text-decoration:none;}
.logo span{color:var(--dark);}
.tagline{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;display:block;margin-top:-4px;}
.header-badge{background:var(--pink);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-decoration:none;}
.article-hero{background:linear-gradient(135deg,#1A0010,#6B0050);padding:48px 16px 36px;text-align:center;color:#fff;}
.article-visual{display:flex;justify-content:center;margin-bottom:20px;}
.article-visual svg{border-radius:12px;max-width:200px;}
.article-hero .cat-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--coral);font-weight:600;margin-bottom:12px;}
.article-hero h1{font-family:'Playfair Display',serif;font-size:clamp(24px,5vw,42px);font-weight:700;line-height:1.2;margin-bottom:12px;}
.article-hero .meta{font-size:13px;color:rgba(255,255,255,0.6);}
.tags{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:16px;}
.tag{background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:12px;}
.article-body{max-width:780px;margin:0 auto;padding:48px 16px;}
.article-body p{font-size:16px;line-height:1.8;color:var(--text);margin-bottom:20px;}
.article-body h2{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--dark);margin:36px 0 16px;}
.shop-box{background:var(--white);border:1px solid #F0D0E8;border-radius:16px;padding:24px;margin:32px 0;}
.shop-box h3{font-family:'Playfair Display',serif;font-size:18px;color:var(--dark);margin-bottom:8px;}
.shop-box p{font-size:14px;color:var(--muted);margin-bottom:16px;}
.shop-btn{display:inline-block;background:var(--pink);color:#fff;font-weight:600;font-size:14px;padding:10px 24px;border-radius:24px;text-decoration:none;}
.disclosure{background:#FFF0F7;border-left:4px solid var(--pink);padding:10px 16px;font-size:12px;color:var(--muted);margin-bottom:32px;}
footer{background:var(--dark);color:rgba(255,255,255,0.6);text-align:center;padding:32px 16px;font-size:13px;line-height:1.8;margin-top:48px;}
footer a{color:var(--coral);text-decoration:none;}
footer strong{color:#fff;}
</style>
</head>
<body>
<div class="ticker-wrap">
  <div class="ticker-inner">
    <span><b>Deepika Padukone</b> airport look decoded</span>
    <span><b>SRK</b> style guide now live</span>
    <span><b>Alia vs Ananya</b> - who wins?</span>
    <span>${topic.emoji} <b>${topic.title}</b> - shop now</span>
    <span><b>Deepika Padukone</b> airport look decoded</span>
    <span><b>SRK</b> style guide now live</span>
    <span><b>Alia vs Ananya</b> - who wins?</span>
    <span>${topic.emoji} <b>${topic.title}</b> - shop now</span>
  </div>
</div>
<header>
  <div class="header-inner">
    <a href="/" class="logo">Bollywood<span>Edge</span>
      <span class="tagline">Celebrity Style. Real Products.</span>
    </a>
    <a href="/articles.html" class="header-badge">All Guides</a>
  </div>
</header>
<div class="article-hero">
  <div class="article-visual">${visual}</div>
  <div class="cat-label">${topic.emoji} ${topic.category}</div>
  <h1>${topic.title}</h1>
  <div class="meta">Style Guide &mdash; ${today} &mdash; Amazon picks inside</div>
  <div class="tags">
    ${topic.tags.map(t => `<span class="tag">${t}</span>`).join("")}
  </div>
</div>
<div class="article-body">
  <div class="disclosure">
    As an Amazon Associate, BollywoodEdge earns from qualifying purchases. Prices subject to change.
  </div>
  ${bodyHTML}
  <div class="shop-box">
    <h3>${topic.emoji} Shop ${topic.title.split(" ").slice(0,3).join(" ")} Picks on Amazon</h3>
    <p>Find the best products handpicked to match this look — available on Amazon with fast delivery.</p>
    <a href="${AMAZON_BASE}/s?k=${topic.amazonQuery}&tag=${ASSOCIATE_TAG}" class="shop-btn" target="_blank" rel="nofollow">Shop on Amazon</a>
  </div>
</div>
<footer>
  <p style="font-size:18px;font-family:'Playfair Display',serif;color:#fff;margin-bottom:8px;">BollywoodEdge</p>
  <p>Celebrity Style. Real Products. Every Day.</p>
  <p style="margin-top:12px;"><a href="/">Home</a> &middot; <a href="/articles.html">All Style Guides</a></p>
  <p style="margin-top:16px;font-size:12px;">As an Amazon Associate, BollywoodEdge earns from qualifying purchases.<br>Associate ID: <strong>${ASSOCIATE_TAG}</strong></p>
  <p style="margin-top:12px;font-size:12px;">Copyright ${new Date().getFullYear()} BollywoodEdge</p>
</footer>
</body>
</html>`;
}

function buildArticlesIndexHTML(articles) {
  const gridCards = articles.slice(1).map(a => {
    const visual = getCategoryVisual(a.category);
    return `<div class="grid-card">
      <div class="grid-visual">${visual}</div>
      <div class="grid-cat">${a.emojiCat}</div>
      <h3><a href="/articles/${a.slug}.html">${a.title}</a></h3>
      <a href="/articles/${a.slug}.html" class="read-more">Read more →</a>
    </div>`;
  }).join("\n");

  const sidebarRecent = articles.slice(1, 5).map(a => `
    <div class="sidebar-item">
      <div class="sidebar-cat">${a.emojiCat}</div>
      <h4><a href="/articles/${a.slug}.html">${a.title}</a></h4>
      <a href="/articles/${a.slug}.html" class="read-more">Read more →</a>
    </div>`).join("\n");

  const featuredVisual = articles[0] ? getCategoryVisual(articles[0].category) : "";
  const tickerItems = articles.slice(0, 5).map(a =>
    `<span>${a.emojiCat.split(" ")[0]} <b>${a.title}</b> — shop now</span>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All Style Guides - BollywoodEdge</title>
<meta name="description" content="Bollywood celebrity style guides with Amazon picks. Shop every look.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--pink:#E91E8C;--coral:#FF6B9D;--dark:#1A0010;--text:#2D0020;--muted:#8B4570;--white:#FFFFFF;}
body{font-family:'DM Sans',sans-serif;background:#FFF5FA;color:var(--text);overflow-x:hidden;}
.ticker-wrap{background:var(--dark);color:var(--white);padding:10px 0;overflow:hidden;white-space:nowrap;}
.ticker-inner{display:inline-block;animation:ticker 30s linear infinite;}
.ticker-inner span{margin:0 40px;font-size:13px;}
.ticker-inner span b{color:var(--coral);}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
header{background:var(--white);border-bottom:3px solid var(--pink);position:sticky;top:0;z-index:100;}
.header-inner{max-width:1200px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:64px;}
.logo{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--pink);text-decoration:none;}
.logo span{color:var(--dark);}
.tagline{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;display:block;margin-top:-4px;}
.header-right{display:flex;gap:12px;align-items:center;}
.nav-link{font-size:13px;font-weight:600;color:var(--muted);text-decoration:none;}
.header-badge{background:var(--pink);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-decoration:none;}
.page-hero{background:linear-gradient(135deg,#1A0010,#6B0050);padding:40px 16px;text-align:center;color:#fff;}
.page-hero h1{font-family:'Playfair Display',serif;font-size:clamp(22px,4vw,36px);margin-bottom:8px;}
.page-hero p{font-size:14px;color:rgba(255,255,255,0.6);}
.main-layout{max-width:1200px;margin:0 auto;padding:40px 16px;display:grid;grid-template-columns:1fr 300px;gap:40px;}
@media(max-width:768px){.main-layout{grid-template-columns:1fr;}}
.featured-card{background:linear-gradient(135deg,#3D0030,#6B0050);border-radius:16px;padding:32px;color:#fff;margin-bottom:32px;display:flex;gap:24px;align-items:center;}
@media(max-width:600px){.featured-card{flex-direction:column;text-align:center;}}
.featured-card svg{border-radius:10px;flex-shrink:0;}
.featured-card .cat-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--coral);font-weight:600;margin-bottom:10px;}
.featured-card h2{font-family:'Playfair Display',serif;font-size:clamp(18px,2.5vw,26px);margin-bottom:10px;line-height:1.3;}
.featured-desc{font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:18px;}
.read-link{display:inline-block;color:var(--coral);font-weight:600;font-size:14px;text-decoration:none;}
.section-title{font-family:'Playfair Display',serif;font-size:22px;color:var(--dark);margin-bottom:20px;display:flex;align-items:center;gap:12px;}
.count-badge{background:var(--pink);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;font-family:'DM Sans',sans-serif;}
.articles-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;}
.grid-card{background:var(--white);border-radius:12px;overflow:hidden;border:1px solid #F0D0E8;}
.grid-visual svg{width:100%;height:auto;display:block;}
.grid-cat{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;margin:14px 16px 6px;}
.grid-card h3{font-family:'Playfair Display',serif;font-size:15px;margin:0 16px 10px;line-height:1.4;}
.grid-card h3 a{color:var(--dark);text-decoration:none;}
.grid-card h3 a:hover{color:var(--pink);}
.read-more{display:inline-block;font-size:13px;font-weight:600;color:var(--pink);text-decoration:none;margin:0 16px 16px;}
.sidebar{position:sticky;top:80px;align-self:start;}
.sidebar-box{background:var(--white);border-radius:12px;padding:24px;border:1px solid #F0D0E8;margin-bottom:24px;}
.sidebar-box h3{font-family:'Playfair Display',serif;font-size:16px;color:var(--dark);margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #F0D0E8;}
.sidebar-item{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #F9E8F4;}
.sidebar-item:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none;}
.sidebar-cat{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;margin-bottom:4px;}
.sidebar-item h4{font-family:'Playfair Display',serif;font-size:14px;margin-bottom:6px;line-height:1.4;}
.sidebar-item h4 a{color:var(--dark);text-decoration:none;}
.sidebar-item h4 a:hover{color:var(--pink);}
.shop-sidebar{background:linear-gradient(135deg,#E91E8C,#FF6B9D);border-radius:12px;padding:24px;text-align:center;color:#fff;}
.shop-sidebar h3{font-family:'Playfair Display',serif;font-size:18px;margin-bottom:8px;}
.shop-sidebar p{font-size:13px;opacity:0.9;margin-bottom:16px;}
.shop-btn{display:inline-block;background:#fff;color:var(--pink);font-weight:700;font-size:13px;padding:10px 20px;border-radius:20px;text-decoration:none;}
footer{background:var(--dark);color:rgba(255,255,255,0.6);text-align:center;padding:32px 16px;font-size:13px;line-height:1.8;margin-top:48px;}
footer a{color:var(--coral);text-decoration:none;}
footer strong{color:#fff;}
</style>
</head>
<body>
<div class="ticker-wrap">
  <div class="ticker-inner">
    ${tickerItems}${tickerItems}
  </div>
</div>
<header>
  <div class="header-inner">
    <a href="/" class="logo">Bollywood<span>Edge</span>
      <span class="tagline">Celebrity Style. Real Products.</span>
    </a>
    <div class="header-right">
      <a href="/" class="nav-link">Home</a>
      <a href="/articles.html" class="nav-link">Style Guides</a>
      <a href="/#fashion" class="header-badge">Shop Now</a>
    </div>
  </div>
</header>
<div class="page-hero">
  <h1>✨ All Style Guides</h1>
  <p>Bollywood celebrity looks decoded — every piece shoppable on Amazon</p>
</div>
<div class="main-layout">
  <div class="main-col">
    ${articles[0] ? `
    <div class="featured-card">
      <div style="flex-shrink:0">${featuredVisual}</div>
      <div>
        <div class="cat-label">${articles[0].emojiCat} · FEATURED</div>
        <h2>${articles[0].title}</h2>
        <p class="featured-desc">The latest style guide — every look decoded with Amazon picks inside.</p>
        <a href="/articles/${articles[0].slug}.html" class="read-link">Read the full guide →</a>
      </div>
    </div>` : ""}
    <div class="section-title">All Style Guides <span class="count-badge">${articles.length} ARTICLES</span></div>
    <div class="articles-grid">
      ${gridCards}
    </div>
  </div>
  <div class="sidebar">
    <div class="sidebar-box">
      <h3>Recent Guides</h3>
      ${sidebarRecent}
    </div>
    <div class="shop-sidebar">
      <h3>Shop Bollywood Style</h3>
      <p>Find every look on Amazon — fast delivery, real products.</p>
      <a href="https://www.amazon.in/?tag=bollywoodedge-21" class="shop-btn" target="_blank" rel="nofollow">Shop Amazon →</a>
    </div>
  </div>
</div>
<footer>
  <p style="font-size:18px;font-family:'Playfair Display',serif;color:#fff;margin-bottom:8px;">BollywoodEdge</p>
  <p>Celebrity Style. Real Products. Every Day.</p>
  <p style="margin-top:12px;"><a href="/">Home</a> &middot; <a href="/articles.html">All Style Guides</a></p>
  <p style="margin-top:16px;font-size:12px;">As an Amazon Associate, BollywoodEdge earns from qualifying purchases.</p>
  <p style="margin-top:12px;font-size:12px;">Copyright ${new Date().getFullYear()} BollywoodEdge</p>
</footer>
</body>
</html>`;
}

function gitPush(slug) {
  console.log("\n📤 Pushing to GitHub...");
  try {
    execSync(`git add .`, { stdio: "inherit" });
    execSync(`git commit -m "Auto-publish: ${slug}"`, { stdio: "inherit" });
    execSync(`git push origin main`, { stdio: "inherit" });
    console.log("✅ Pushed to GitHub — Cloudflare will deploy in ~30 seconds");
  } catch (err) {
    console.error("❌ Git push failed:", err.message);
  }
}

async function main() {
  console.log("🎬 BollywoodEdge Auto-Publisher Starting...\n");

  const articlesDir = path.join(SITE_DIR, "articles");
  if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });

  const existingSlugs = getExistingSlugs(articlesDir);
  const topic = getTodaysTopic(existingSlugs);
  console.log(`📌 Today's topic: ${topic.title}`);

  try {
    const articleText = await generateArticle(topic);
    const slug = slugify(topic.title);
    const html = buildArticleHTML(topic, articleText);

    const filePath = path.join(articlesDir, `${slug}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`✅ Article saved: ${filePath}`);

    const allSlugs = getExistingSlugs(articlesDir);
    const allArticles = getArticleMetadata(articlesDir, allSlugs);
    const indexHTML = buildArticlesIndexHTML(allArticles);
    const indexPath = path.join(SITE_DIR, "articles.html");
    fs.writeFileSync(indexPath, indexHTML);
    console.log(`✅ Articles index updated: ${allArticles.length} articles listed`);

    gitPush(slug);

    console.log(`\n✅ Done!`);
    console.log(`📌 Article: ${topic.title}`);
    console.log(`🔗 URL: https://imraankhan.in/articles/${slug}.html`);
    console.log(`🛍  Tag: ${ASSOCIATE_TAG}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
