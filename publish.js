const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ============================================================
// CONFIGURATION
// ============================================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SITE_DIR = process.cwd();
// ============================================================

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const TOPICS = [
  { title: "Katrina Kaif Skincare Routine", category: "Skincare", tags: ["Katrina Kaif", "Skincare", "Glow"], emoji: "✨", amazonQuery: "vitamin+c+serum+skincare+india" },
  { title: "Ranveer Singh Street Style Guide", category: "Men's Style", tags: ["Ranveer Singh", "Street Style", "Men"], emoji: "👑", amazonQuery: "men+streetwear+jacket+india" },
  { title: "Priyanka Chopra Jewellery Picks", category: "Accessories", tags: ["Priyanka Chopra", "Jewellery", "Accessories"], emoji: "💍", amazonQuery: "statement+jewellery+women+india" },
  { title: "Bollywood Wedding Guest Outfit Guide", category: "Ethnic Wear", tags: ["Wedding", "Ethnic Wear", "Lehenga"], emoji: "🪷", amazonQuery: "wedding+guest+lehenga+india" },
  { title: "Sara Ali Khan Beauty Essentials", category: "Beauty", tags: ["Sara Ali Khan", "Beauty", "Makeup"], emoji: "💄", amazonQuery: "makeup+kit+india+bestseller" },
  { title: "Bollywood Mens Fragrance Guide", category: "Fragrance", tags: ["Men", "Fragrance", "Cologne"], emoji: "🌸", amazonQuery: "men+perfume+india+bestseller" },
  { title: "Alia Bhatt Casual Looks on Amazon", category: "Fashion", tags: ["Alia Bhatt", "Casual", "Fashion"], emoji: "👗", amazonQuery: "casual+kurta+set+women+india" },
  { title: "Deepika Padukone Gym Wear Picks", category: "Fitness", tags: ["Deepika Padukone", "Gym", "Fitness"], emoji: "💪", amazonQuery: "women+gym+wear+india" },
];

function getTodaysTopic() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return TOPICS[dayOfYear % TOPICS.length];
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
- Include 4-5 specific product recommendations with descriptions (these will link to Amazon India)
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
<meta name="description" content="${topic.title} - shop every piece on Amazon India. Bollywood style decoded.">
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
.article-hero{background:linear-gradient(135deg,#1A0010,#6B0050);padding:48px 16px;text-align:center;color:#fff;}
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
    <a href="/#fashion" class="header-badge">Shop Now</a>
  </div>
</header>
<div class="article-hero">
  <div class="cat-label">${topic.emoji} ${topic.category}</div>
  <h1>${topic.title}</h1>
  <div class="meta">Style Guide - ${today} - Amazon picks inside</div>
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
    <p>Find the best products handpicked to match this look - all available on Amazon India with fast delivery.</p>
    <a href="https://www.amazon.in/s?k=${topic.amazonQuery}&tag=bollywoodedge-21" class="shop-btn" target="_blank" rel="nofollow">Shop on Amazon India</a>
  </div>
</div>
<footer>
  <p style="font-size:18px;font-family:'Playfair Display',serif;color:#fff;margin-bottom:8px;">BollywoodEdge</p>
  <p>Celebrity Style. Real Products. Every Day.</p>
  <p style="margin-top:12px;"><a href="/">Back to BollywoodEdge</a> - <a href="/articles.html">All Style Guides</a></p>
  <p style="margin-top:16px;font-size:12px;">As an Amazon Associate, BollywoodEdge earns from qualifying purchases.<br>Associate ID: <strong>bollywoodedge-21</strong></p>
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

  const topic = getTodaysTopic();
  console.log(`📌 Today's topic: ${topic.title}`);

  try {
    const articleText = await generateArticle(topic);
    const slug = slugify(topic.title);
    const html = buildArticleHTML(topic, articleText);

    const articlesDir = path.join(SITE_DIR, "articles");
    if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });
    const filePath = path.join(articlesDir, `${slug}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`✅ Article saved: ${filePath}`);

    gitPush(slug);

    console.log(`\n✅ Done!`);
    console.log(`📌 Article: ${topic.title}`);
    console.log(`🔗 URL: https://imraankhan.in/articles/${slug}.html`);
    console.log(`🛍  Tag: bollywoodedge-21`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
