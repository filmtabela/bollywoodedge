const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ============================================================
// CONFIGURATION
// ============================================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const SITE_DIR = process.cwd();
// FIX 2026-07-12: article CTAs previously pointed at Amazon.com with the US
// tag — Indian traffic was being sent to the wrong marketplace. Primary
// market is India; US tag kept for future OneLink use.
const ASSOCIATE_TAG = "bollywooded0f-21"; // Amazon.in
const ASSOCIATE_TAG_US = "bollywoodedge-20"; // Amazon.com (reference only)
const AMAZON_BASE = "https://www.amazon.in";
// ============================================================

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ============================================================
// PRODUCT CATALOG — hero + long-tail affiliate products
// asin: null → link falls back to a tagged Amazon search (still sets the
// 24h cookie, never 404s). Fill in real ASINs over time for stronger
// conversion. NEVER remove the tag parameter.
// ============================================================
const PRODUCTS = {
  "hero-jeans":       { name: "Wide-Leg Baggy High-Waist Jeans",        keywords: "wide leg baggy jeans women high waisted", price: "\u20B9899\u20131,999",   asin: null, img: "denim jeans street style woman" },
  "hero-airfryer":    { name: "Air Fryer 4\u20136L",                    keywords: "air fryer 5 litre",                       price: "\u20B94,500\u20139,000", asin: null, img: "air fryer kitchen healthy cooking" },
  "tail-sunscreen":   { name: "Centella Gel Sunscreen SPF 50",          keywords: "centella sunscreen gel spf 50",           price: "\u20B9300\u2013700",     asin: null, img: "sunscreen skincare summer woman" },
  "tail-vitc-serum":  { name: "Vitamin C Face Serum",                   keywords: "vitamin c serum face",                    price: "\u20B9350\u2013800",     asin: null, img: "face serum skincare glowing skin" },
  "tail-kurti":       { name: "Festive Kurti Set",                      keywords: "kurti set women festive",                 price: "\u20B9600\u20131,500",   asin: null, img: "indian ethnic kurti fashion woman" },
  "tail-grooming":    { name: "Beard Grooming Kit",                     keywords: "beard grooming kit men",                  price: "\u20B9400\u20131,200",   asin: null, img: "beard grooming men barber" },
  "tail-silk-pillow": { name: "Satin Pillowcase + Heatless Curler Set", keywords: "satin pillowcase heatless curler",        price: "\u20B9300\u2013900",     asin: null, img: "silk pillow hair curls beauty" },
  "tail-makeup-kit":  { name: "Everyday Makeup Kit",                    keywords: "makeup kit women everyday",               price: "\u20B9500\u20131,500",   asin: null, img: "makeup products cosmetics flatlay" },
  "tail-handbag":     { name: "Tote / Shoulder Handbag",                keywords: "tote bag women shoulder handbag",         price: "\u20B9700\u20132,000",   asin: null, img: "tote handbag fashion woman street" },
  "tail-fitness":     { name: "Resistance Bands Set",                   keywords: "resistance bands set workout",            price: "\u20B9300\u20131,000",   asin: null, img: "resistance bands home workout" },
  "tail-perfume":     { name: "Long-Lasting Eau de Parfum",             keywords: "perfume long lasting women",              price: "\u20B9500\u20131,200",   asin: null, img: "perfume bottle luxury elegant" },
  "tail-leggings":    { name: "High-Waist Yoga Leggings",               keywords: "high waist yoga leggings women",          price: "\u20B9500\u20131,000",   asin: null, img: "yoga leggings workout woman" },
};

// Default products injected per category (topic.products overrides this)
const CATEGORY_PRODUCTS = {
  "Skincare":        ["tail-vitc-serum", "tail-sunscreen"],
  "Beauty":          ["tail-makeup-kit", "tail-vitc-serum"],
  "Fashion":         ["hero-jeans", "tail-handbag"],
  "Men's Style":     ["tail-grooming"],
  "Ethnic Wear":     ["tail-kurti", "tail-handbag"],
  "Fitness":         ["tail-leggings", "tail-fitness"],
  "Men's Fitness":   ["tail-fitness", "tail-grooming"],
  "Accessories":     ["tail-handbag"],
  "Summer Fashion":  ["hero-jeans", "tail-sunscreen"],
  "Luxury":          ["tail-handbag", "tail-perfume"],
  "Fragrance":       ["tail-perfume"],
  "Hollywood Glam":  ["hero-jeans", "tail-makeup-kit"],
  "Hollywood Men":   ["tail-grooming"],
};

function affiliateLink(p) {
  if (p.asin) return `${AMAZON_BASE}/dp/${p.asin}?tag=${ASSOCIATE_TAG}`;
  return `${AMAZON_BASE}/s?k=${encodeURIComponent(p.keywords)}&tag=${ASSOCIATE_TAG}`;
}

function productsForTopic(topic) {
  const ids = topic.products || CATEGORY_PRODUCTS[topic.category] || [];
  return ids.filter(id => PRODUCTS[id]).map(id => ({ id, ...PRODUCTS[id] }));
}

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
  { title: "Taapsee Pannu Minimalist Style", category: "Fashion", tags: ["Taapsee Pannu", "Minimalist", "Casual"], emoji: "🤍", amazonQuery: "minimalist+women+fashion" },
  // NEW TOPICS — batch 2
  { title: "Kiara Advani Date Night Looks", category: "Fashion", tags: ["Kiara Advani", "Date Night", "Glam"], emoji: "✨", amazonQuery: "party+wear+dress+women+india" },
  { title: "Shraddha Kapoor Everyday Style", category: "Fashion", tags: ["Shraddha Kapoor", "Casual", "Everyday"], emoji: "🌸", amazonQuery: "casual+western+wear+women" },
  { title: "Varun Dhawan Casual Street Style", category: "Men's Style", tags: ["Varun Dhawan", "Street Style", "Casual"], emoji: "👟", amazonQuery: "men+casual+sneakers+streetwear+india" },
  { title: "Kajol Ethnic Wear Guide", category: "Ethnic Wear", tags: ["Kajol", "Ethnic", "Traditional"], emoji: "🪷", amazonQuery: "salwar+kameez+ethnic+women" },
  { title: "Disha Patani Beachwear Picks", category: "Summer Fashion", tags: ["Disha Patani", "Beach", "Summer"], emoji: "🌊", amazonQuery: "beachwear+coverup+women+india" },
  { title: "Sidharth Malhotra Men's Grooming Guide", category: "Men's Style", tags: ["Sidharth Malhotra", "Grooming", "Men"], emoji: "💈", amazonQuery: "men+grooming+kit+india" },
  { title: "Madhuri Dixit Timeless Style", category: "Fashion", tags: ["Madhuri Dixit", "Classic", "Elegance"], emoji: "👑", amazonQuery: "elegant+salwar+suit+women" },
  { title: "Kriti Sanon Luxury Handbag Guide", category: "Accessories", tags: ["Kriti Sanon", "Handbag", "Luxury"], emoji: "👜", amazonQuery: "luxury+handbag+women+india" },
  { title: "Shahid Kapoor Smart Casual Wardrobe", category: "Men's Style", tags: ["Shahid Kapoor", "Smart Casual", "Men"], emoji: "👔", amazonQuery: "smart+casual+men+outfit+india" },
  { title: "Alia Bhatt Bridal Lehenga Inspiration", category: "Ethnic Wear", tags: ["Alia Bhatt", "Bridal", "Lehenga"], emoji: "🪷", amazonQuery: "bridal+lehenga+women" },
  { title: "Jacqueline Fernandez Fitness Style", category: "Fitness", tags: ["Jacqueline Fernandez", "Fitness", "Yoga"], emoji: "🧘", amazonQuery: "yoga+wear+women+india" },
  { title: "Ranbir Kapoor Airport Fashion Guide", category: "Men's Style", tags: ["Ranbir Kapoor", "Airport", "Travel"], emoji: "✈️", amazonQuery: "men+travel+outfit+india" },
  { title: "Shilpa Shetty Wellness and Skincare", category: "Skincare", tags: ["Shilpa Shetty", "Wellness", "Skincare"], emoji: "🌿", amazonQuery: "face+serum+anti+aging+india" },
  { title: "Nora Fatehi Party Wear Guide", category: "Fashion", tags: ["Nora Fatehi", "Party", "Dance"], emoji: "💃", amazonQuery: "party+wear+indo+western+women" },
  { title: "Amitabh Bachchan Classic Men's Style", category: "Men's Style", tags: ["Amitabh Bachchan", "Classic", "Men"], emoji: "🎩", amazonQuery: "classic+men+kurta+pajama" },
  // HOLLYWOOD TOPICS
  { title: "Margot Robbie Red Carpet Style Guide", category: "Hollywood Glam", tags: ["Margot Robbie", "Red Carpet", "Hollywood"], emoji: "⭐", amazonQuery: "red+carpet+evening+gown+women" },
  { title: "Zendaya Fashion Icon Looks on Amazon", category: "Hollywood Glam", tags: ["Zendaya", "Fashion", "Style"], emoji: "✨", amazonQuery: "fashion+forward+women+dress" },
  { title: "Ryan Gosling Ken Style Wardrobe Guide", category: "Hollywood Men", tags: ["Ryan Gosling", "Style", "Hollywood"], emoji: "🕺", amazonQuery: "men+casual+blazer+style" },
  { title: "Jennifer Lopez Ageless Fitness Style", category: "Fitness", tags: ["Jennifer Lopez", "Fitness", "Glam"], emoji: "💪", amazonQuery: "women+gym+wear+stylish" },
  { title: "Timothee Chalamet Avant-Garde Mens Fashion", category: "Hollywood Men", tags: ["Timothee Chalamet", "Fashion", "Men"], emoji: "🎬", amazonQuery: "men+fashion+forward+jacket" },
  { title: "Selena Gomez Casual Street Style Picks", category: "Hollywood Glam", tags: ["Selena Gomez", "Street Style", "Casual"], emoji: "🌟", amazonQuery: "women+casual+chic+outfit" },
  { title: "Chris Hemsworth Gym Workout Wardrobe", category: "Hollywood Men", tags: ["Chris Hemsworth", "Fitness", "Men"], emoji: "🏋️", amazonQuery: "men+gym+wear+tank+top" },
  { title: "Taylor Swift Eras Tour Fashion Guide", category: "Hollywood Glam", tags: ["Taylor Swift", "Concert", "Fashion"], emoji: "🎤", amazonQuery: "sequin+dress+women+party" },
  { title: "Angelina Jolie Minimalist Luxury Style", category: "Hollywood Glam", tags: ["Angelina Jolie", "Minimalist", "Luxury"], emoji: "👑", amazonQuery: "minimalist+luxury+dress+women" },
  { title: "Tom Holland Street Style Guide", category: "Hollywood Men", tags: ["Tom Holland", "Street Style", "Men"], emoji: "🕷️", amazonQuery: "men+streetwear+hoodie+casual" },
  { title: "Dua Lipa Pop Star Fashion on Amazon", category: "Hollywood Glam", tags: ["Dua Lipa", "Pop", "Fashion"], emoji: "🎵", amazonQuery: "women+pop+star+outfit+glam" },
  { title: "Brad Pitt Classic Hollywood Mens Style", category: "Hollywood Men", tags: ["Brad Pitt", "Classic", "Men"], emoji: "🎩", amazonQuery: "men+classic+chino+blazer" },
  { title: "Rihanna Fenty Beauty Makeup Guide", category: "Beauty", tags: ["Rihanna", "Fenty", "Makeup"], emoji: "💄", amazonQuery: "full+coverage+foundation+women" },
  { title: "Beyonce Stage Glam Style Guide", category: "Hollywood Glam", tags: ["Beyonce", "Stage", "Glam"], emoji: "🌟", amazonQuery: "gold+bodysuit+women+glam" },
  { title: "Leonardo DiCaprio Smart Casual Style Guide", category: "Hollywood Men", tags: ["Leonardo DiCaprio", "Smart Casual", "Men"], emoji: "🎬", amazonQuery: "men+smart+casual+chino+shirt" },
  { title: "Hailey Bieber Model Off-Duty Style", category: "Hollywood Glam", tags: ["Hailey Bieber", "Model", "Street Style"], emoji: "✨", amazonQuery: "model+off+duty+women+outfit" },
  { title: "Dwayne Johnson Fitness and Style", category: "Hollywood Men", tags: ["Dwayne Johnson", "Fitness", "Men"], emoji: "💪", amazonQuery: "men+oversized+gym+shirt" },
  { title: "Sydney Sweeney Clean Girl Aesthetic", category: "Hollywood Glam", tags: ["Sydney Sweeney", "Clean Girl", "Aesthetic"], emoji: "🤍", amazonQuery: "women+clean+aesthetic+outfit" },
  { title: "Harry Styles Bold Fashion Guide", category: "Hollywood Men", tags: ["Harry Styles", "Fashion", "Bold"], emoji: "🌈", amazonQuery: "men+bold+fashion+colourful+shirt" },
  { title: "Kylie Jenner Glam Makeup and Style", category: "Beauty", tags: ["Kylie Jenner", "Glam", "Makeup"], emoji: "💋", amazonQuery: "glam+makeup+kit+lipstick+set" },
  { title: "Pedro Pascal Rugged Casual Style", category: "Hollywood Men", tags: ["Pedro Pascal", "Rugged", "Men"], emoji: "🎬", amazonQuery: "men+rugged+casual+jacket" },
  { title: "Priyanka Chopra Hollywood Red Carpet Looks", category: "Hollywood Glam", tags: ["Priyanka Chopra", "Hollywood", "Red Carpet"], emoji: "🌟", amazonQuery: "evening+gown+women+luxury" },
  { title: "Florence Pugh Eclectic Fashion Style", category: "Hollywood Glam", tags: ["Florence Pugh", "Eclectic", "Bold"], emoji: "🌺", amazonQuery: "women+eclectic+fashion+dress" },
  { title: "Jacob Elordi Tall Mens Fashion Guide", category: "Hollywood Men", tags: ["Jacob Elordi", "Style", "Tall"], emoji: "🕶️", amazonQuery: "men+slim+fit+trousers+shirt" },
  { title: "Anya Taylor-Joy Gothic Glam Style", category: "Hollywood Glam", tags: ["Anya Taylor-Joy", "Gothic", "Glam"], emoji: "🖤", amazonQuery: "gothic+glam+women+dress+dark" },
  { title: "Austin Butler Retro Rock Mens Style", category: "Hollywood Men", tags: ["Austin Butler", "Retro", "Rock"], emoji: "🎸", amazonQuery: "men+retro+rock+style+shirt" },
  { title: "Olivia Rodrigo Gen-Z Fashion Picks", category: "Hollywood Glam", tags: ["Olivia Rodrigo", "Gen-Z", "Fashion"], emoji: "🎶", amazonQuery: "women+gen+z+fashion+y2k+style" },
  { title: "Cillian Murphy Peaky Blinders Style Guide", category: "Hollywood Men", tags: ["Cillian Murphy", "Peaky Blinders", "Men"], emoji: "🎩", amazonQuery: "men+tweed+cap+waistcoat" },
  { title: "Sabrina Carpenter Sweet Aesthetic Style", category: "Hollywood Glam", tags: ["Sabrina Carpenter", "Sweet", "Pop"], emoji: "🍬", amazonQuery: "women+sweet+aesthetic+mini+dress" },
  { title: "Paul Mescal Simple Masculine Style", category: "Hollywood Men", tags: ["Paul Mescal", "Simple", "Men"], emoji: "🤎", amazonQuery: "men+simple+linen+shirt+shorts" },
  // COMMERCIAL TOPICS — high buyer-intent, high-commission (added 2026-07-12)
  { title: "The Baggy Jeans Airport Look Under 2000", category: "Fashion", tags: ["Airport Look", "Baggy Jeans", "Street Style"], emoji: "👖", amazonQuery: "wide+leg+baggy+jeans+women", products: ["hero-jeans", "tail-handbag"] },
  { title: "The Korean Sunscreen Trend Taking Over Indian Skincare", category: "Skincare", tags: ["Korean Skincare", "Sunscreen", "Glass Skin"], emoji: "☀️", amazonQuery: "centella+sunscreen+gel+spf+50", products: ["tail-sunscreen"] },
  { title: "Camera Ready Skin The Vitamin C Serum Guide", category: "Skincare", tags: ["Vitamin C", "Serum", "Glow"], emoji: "🍊", amazonQuery: "vitamin+c+serum+face", products: ["tail-vitc-serum", "tail-sunscreen"] },
  { title: "The Air Fryer Diet How Actors Eat Fried and Stay Lean", category: "Fitness", tags: ["Air Fryer", "Healthy Eating", "Fitness"], emoji: "🍟", amazonQuery: "air+fryer+5+litre", products: ["hero-airfryer"] },
  { title: "The Festive Kurti Edit Screen Inspired Looks Under 1500", category: "Ethnic Wear", tags: ["Kurti", "Festive", "Ethnic"], emoji: "🪷", amazonQuery: "kurti+set+women+festive", products: ["tail-kurti", "tail-handbag"] },
  { title: "Heatless Curls and Silk Pillowcases Overnight Hair Secrets", category: "Beauty", tags: ["Hair Care", "Heatless Curls", "Silk Pillowcase"], emoji: "💇", amazonQuery: "satin+pillowcase+heatless+curler", products: ["tail-silk-pillow"] },
  { title: "The 10 Minute No Makeup Look Whats Actually in the Kit", category: "Beauty", tags: ["No Makeup Look", "Makeup Kit", "Everyday Beauty"], emoji: "💄", amazonQuery: "makeup+kit+women+everyday", products: ["tail-makeup-kit", "tail-vitc-serum"] },
  { title: "Inside a Celebrity Trainers Gym Bag Home Workout Gear", category: "Fitness", tags: ["Home Workout", "Resistance Bands", "Fitness Gear"], emoji: "🏋️", amazonQuery: "resistance+bands+set+workout", products: ["tail-fitness", "tail-leggings"] },
  { title: "The Handbags Every Heroine Carries Affordable Versions", category: "Accessories", tags: ["Handbags", "Tote Bags", "Celebrity Style"], emoji: "👜", amazonQuery: "tote+bag+women+shoulder+handbag", products: ["tail-handbag", "hero-jeans"] },
];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Returns slugs sorted by file modification time — newest first
function getExistingSlugs(articlesDir) {
  if (!fs.existsSync(articlesDir)) return [];
  return fs.readdirSync(articlesDir)
    .filter(f => f.endsWith(".html"))
    .map(f => ({
      slug: f.replace(".html", ""),
      mtime: fs.statSync(path.join(articlesDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(f => f.slug);
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

    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch ? titleMatch[1] : slug;
    const title = rawTitle.replace(/\s*-\s*BollywoodEdge\s*$/, "").trim();

    const matchedTopic = TOPICS.find(t => slugify(t.title) === slug);
    const category = matchedTopic ? matchedTopic.category : "Fashion";
    const emoji = matchedTopic ? matchedTopic.emoji : "✨";
    const emojiCat = `${emoji} ${category}`;

    const thumbMatch = content.match(/<meta name="pexels-thumb" content="([^"]+)">/);
    const thumb = thumbMatch ? thumbMatch[1] : null;

    return { slug, title, emojiCat, category, thumb };
  });
  // NOTE: no .reverse() here — slugs already come in newest-first order from getExistingSlugs
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
    },
    "Hollywood Glam": {
      bg: ["#0A0A1F", "#1A1050"], accent: "#C9A96E", mid: "#A07830",
      shape: `<polygon points="100,25 106,42 124,42 110,53 116,70 100,59 84,70 90,53 76,42 94,42" fill="#C9A96E" opacity="0.9"/>
        <circle cx="100" cy="90" r="16" fill="#A07830" opacity="0.4"/>
        <path d="M84 112 L82 125 M116 112 L118 125" stroke="#C9A96E" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="108" r="5" fill="#C9A96E" opacity="0.7"/>`,
      label: "HOLLYWOOD"
    },
    "Hollywood Men": {
      bg: ["#0F0F0F", "#1A1A2E"], accent: "#E8D5B7", mid: "#8B7355",
      shape: `<rect x="82" y="38" width="36" height="48" rx="4" fill="#8B7355" opacity="0.7"/>
        <circle cx="100" cy="30" r="11" fill="#E8D5B7" opacity="0.95"/>
        <path d="M82 60 L76 112 M118 60 L124 112" stroke="#8B7355" stroke-width="8" stroke-linecap="round"/>
        <path d="M82 60 L100 68 L118 60" fill="#A08060" opacity="0.8"/>
        <line x1="88" y1="75" x2="112" y2="75" stroke="#E8D5B7" stroke-width="1" opacity="0.5"/>
        <line x1="88" y1="85" x2="112" y2="85" stroke="#E8D5B7" stroke-width="1" opacity="0.3"/>`,
      label: "HOLLYWOOD MEN"
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

async function fetchPexelsImage(query, category, overrideQuery = null) {
  try {
    if (!PEXELS_API_KEY) return null;
    // Build a clean search query — no celebrity names, just fashion/style keywords
    const searchTerms = {
      "Skincare": "skincare beauty woman glowing",
      "Men's Style": "men fashion style outfit",
      "Accessories": "fashion accessories jewellery woman",
      "Ethnic Wear": "indian ethnic fashion woman",
      "Beauty": "makeup beauty woman glamour",
      "Fashion": "fashion woman style outfit",
      "Fragrance": "perfume fragrance luxury",
      "Fitness": "fitness gym workout woman",
      "Summer Fashion": "summer fashion woman beach",
      "Luxury": "luxury fashion woman elegant",
      "Men's Fitness": "men gym fitness workout",
      "Hollywood Glam": "red carpet fashion glamour woman",
      "Hollywood Men": "men suit fashion style actor",
    };
    const q = overrideQuery || searchTerms[category] || query.replace(/[^a-zA-Z ]/g, "").toLowerCase();
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=10&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return null;
    // Pick a random photo from results for variety
    const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
    return {
      url: photo.src.large2x || photo.src.large,
      thumb: photo.src.medium,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      pexelsUrl: photo.url
    };
  } catch (e) {
    console.log("Pexels fetch failed, using SVG fallback:", e.message);
    return null;
  }
}

async function generateArticle(topic, products = []) {
  console.log(`\n📝 Generating article: ${topic.title}...`);
  const productBlock = products.length
    ? `\n\nWeave the following specific products into the article naturally — mention each of them at least once where it fits the style advice. The FIRST time you mention each product, write the mention EXACTLY in this marker format: [[product-id|natural phrase you'd use in the sentence]]. Example: "pair it with [[${products[0].id}|a structured tote bag]]". Use each marker exactly once; write about the product normally after that.\nProducts:\n${products.map(p => `- id: ${p.id} — ${p.name} (price range ${p.price})`).join("\n")}`
    : "";
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `Write a detailed SEO-optimised celebrity style guide article about: "${topic.title}"

The article should:
- Be 600-800 words
- Have an engaging introduction mentioning the celebrity and their iconic style
- Include 4-5 specific product recommendations with descriptions (these will link to Amazon)
- Have subheadings using H2 tags
- Be written for style-conscious readers aged 20-40 interested in celebrity fashion (both Bollywood and Hollywood)
- Naturally include relevant Amazon shopping keywords throughout
- End with a call to action to shop on Amazon
- Be factual, engaging and editorial in tone like a fashion magazine article
- Do NOT include any HTML tags, just plain text with subheadings marked as ## Subheading${productBlock}

Return ONLY the article text, no preamble.`
    }]
  });
  return message.content[0].text;
}

// Replace [[product-id|anchor text]] markers with tagged affiliate links;
// strip any markers that didn't resolve so raw brackets never reach the page.
function linkifyProducts(text, products) {
  let out = text;
  for (const p of products) {
    const re = new RegExp(`\\[\\[${p.id}\\|([^\\]]+)\\]\\]`, "g");
    out = out.replace(re, `<a href="${affiliateLink(p)}" target="_blank" rel="nofollow sponsored noopener">$1</a>`);
  }
  out = out.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  out = out.replace(/\[\[([^\]]*)\]\]/g, "$1");
  return out;
}

function buildShopTheLookHTML(products) {
  if (!products.length) return "";
  const items = products.map(p =>
    `<li style="margin-bottom:10px;font-size:14px;line-height:1.6;"><a href="${affiliateLink(p)}" target="_blank" rel="nofollow sponsored noopener" style="color:var(--pink);font-weight:600;text-decoration:none;">${p.name}</a> <span style="color:var(--muted);">(${p.price})</span></li>`
  ).join("\n      ");
  return `
  <div class="shop-box">
    <h3>🛍 Shop the Look</h3>
    <p>Handpicked to match this guide — all on Amazon India.</p>
    <ul style="list-style:none;margin:0;padding:0;">
      ${items}
    </ul>
  </div>`;
}

function buildArticleHTML(topic, articleText, pexelsImage = null, products = [], midImage = null) {
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const visual = getCategoryVisual(topic.category);
  const heroImageHTML = pexelsImage
    ? `<div class="article-photo-hero" style="background-image:url('${pexelsImage.url}')"></div>
       <div class="photo-credit">📷 <a href="${pexelsImage.pexelsUrl}" target="_blank" rel="nofollow noopener">${pexelsImage.photographer}</a> via Pexels</div>`
    : `<div class="article-visual">${visual}</div>`;
  const linkedText = linkifyProducts(articleText, products);
  let bodyHTML = linkedText.split("\n").map(line => {
    if (line.startsWith("# ") && !line.startsWith("## ")) return "";
    if (line.startsWith("## ")) return `<h2>${line.replace("## ", "")}</h2>`;
    if (line.trim() === "") return "";
    return `<p>${line}</p>`;
  }).join("\n");
  // Insert an optional second image after the first H2 section for a richer page
  if (midImage && (!pexelsImage || midImage.url !== pexelsImage.url)) {
    const midImageHTML = `<figure style="margin:28px 0;"><img src="${midImage.url}" alt="${topic.title}" style="width:100%;border-radius:16px;display:block;" loading="lazy"><figcaption style="font-size:11px;color:var(--muted);margin-top:6px;">📷 <a href="${midImage.pexelsUrl}" target="_blank" rel="nofollow noopener" style="color:var(--muted);">${midImage.photographer}</a> via Pexels</figcaption></figure>`;
    const parts = bodyHTML.split("<h2>");
    if (parts.length > 2) {
      bodyHTML = parts[0] + "<h2>" + parts[1] + midImageHTML + "\n" + parts.slice(2).map(s => "<h2>" + s).join("");
    } else {
      bodyHTML = bodyHTML + "\n" + midImageHTML;
    }
  }
  const shopTheLookHTML = buildShopTheLookHTML(products);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic.title} - BollywoodEdge</title>
<meta name="description" content="${topic.title} - shop every piece on Amazon. Bollywood style decoded.">
${pexelsImage ? `<meta property="og:image" content="${pexelsImage.url}">
<meta name="pexels-thumb" content="${pexelsImage.thumb}">` : ''}
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
.article-photo-hero{width:100%;height:380px;background-size:cover;background-position:center top;border-radius:0;margin-bottom:0;position:relative;}
.photo-credit{font-size:10px;color:rgba(255,255,255,0.4);margin-top:4px;margin-bottom:16px;}
.photo-credit a{color:rgba(255,255,255,0.5);text-decoration:none;}
.article-visual{display:flex;justify-content:center;margin-bottom:20px;}
.article-visual svg{border-radius:12px;max-width:200px;}
.article-hero .cat-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--coral);font-weight:600;margin-bottom:12px;}
.article-hero h1{font-family:'Playfair Display',serif;font-size:clamp(24px,5vw,42px);font-weight:700;line-height:1.2;margin-bottom:12px;}
.article-hero .meta{font-size:13px;color:rgba(255,255,255,0.6);}
.tags{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:16px;}
.tag{background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:12px;}
.article-body{max-width:780px;margin:0 auto;padding:48px 16px;}
.article-body p{font-size:16px;line-height:1.8;color:var(--text);margin-bottom:20px;}
.article-body p a{color:var(--pink);font-weight:600;text-decoration:underline;text-decoration-color:#F0D0E8;text-underline-offset:3px;}
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
  ${heroImageHTML}
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
  ${shopTheLookHTML}
  <div class="shop-box">
    <h3>${topic.emoji} Shop ${topic.title.split(" ").slice(0,3).join(" ")} Picks on Amazon</h3>
    <p>Find the best products handpicked to match this look — available on Amazon with fast delivery.</p>
    <a href="${AMAZON_BASE}/s?k=${topic.amazonQuery}&tag=${ASSOCIATE_TAG}" class="shop-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon</a>
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
    const cardImg = a.thumb
      ? `<div class="grid-visual"><img src="${a.thumb}" alt="${a.title}" style="width:100%;height:150px;object-fit:cover;display:block;border-radius:8px 8px 0 0;" loading="lazy"></div>`
      : `<div class="grid-visual">${visual}</div>`;
    return `<div class="grid-card">
      ${cardImg}
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
        <div class="cat-label">${articles[0].emojiCat} · LATEST</div>
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
      <a href="https://www.amazon.in/?tag=bollywooded0f-21" class="shop-btn" target="_blank" rel="nofollow sponsored noopener">Shop Amazon →</a>
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

function buildHomepageHTML(articles) {
  const tickerItems = articles.slice(0, 6).map(a =>
    `<span>${a.emojiCat.split(" ")[0]} <b>${a.title}</b> — shop now</span>`
  ).join("");

  const featuredArticle = articles[0];
  const featuredVisual = featuredArticle ? getCategoryVisual(featuredArticle.category) : "";

  const gridCards = articles.slice(1, 7).map(a => {
    const visual = getCategoryVisual(a.category);
    const cardImg = a.thumb
      ? `<img src="${a.thumb}" alt="${a.title}" style="width:100%;height:160px;object-fit:cover;display:block;" loading="lazy">`
      : visual.replace('width="200" height="150"', 'width="100%" height="160"');
    return `
    <a href="/articles/${a.slug}.html" style="text-decoration:none;">
      <div class="article-card">
        <div class="article-card-img" style="padding:0;overflow:hidden;">
          ${cardImg}
        </div>
        <div class="article-card-body">
          <div class="ac-cat">${a.emojiCat}</div>
          <div class="ac-title">${a.title}</div>
          <span class="ac-link">Read more →</span>
        </div>
      </div>
    </a>`;
  }).join("\n");

  const featuredVisualResized = featuredVisual.replace('width="200" height="150"', 'width="100%" height="100%"');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BollywoodEdge – Bollywood Fashion, Beauty & Style</title>
<meta name="description" content="Shop Bollywood-inspired fashion, beauty, and accessories. Celebrity style picks, trending looks, and curated product recommendations from India's favourite film world.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--pink:#E91E8C;--hot:#FF0066;--coral:#FF6B9D;--light:#FFF0F7;--dark:#1A0010;--text:#2D0020;--muted:#8B4570;--white:#FFFFFF;--gold:#FFB800;}
body{font-family:'DM Sans',sans-serif;background:#FFF5FA;color:var(--text);overflow-x:hidden;}
.ticker-wrap{background:var(--dark);color:var(--white);padding:10px 0;overflow:hidden;white-space:nowrap;}
.ticker-inner{display:inline-block;animation:ticker 30s linear infinite;}
.ticker-inner span{margin:0 40px;font-size:13px;letter-spacing:.5px;}
.ticker-inner span b{color:var(--coral);}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
header{background:var(--white);border-bottom:3px solid var(--pink);position:sticky;top:0;z-index:100;}
.header-inner{max-width:1200px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:64px;}
.logo{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--pink);text-decoration:none;letter-spacing:-0.5px;}
.logo span{color:var(--dark);}
.tagline{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;display:block;margin-top:-4px;}
.header-nav{display:flex;align-items:center;gap:16px;}
.header-nav a{color:var(--muted);font-size:13px;font-weight:600;text-decoration:none;letter-spacing:.3px;}
.header-nav a:hover{color:var(--pink);}
.header-badge{background:var(--pink);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;letter-spacing:.5px;text-decoration:none;}
.hero{background:linear-gradient(135deg,#1A0010 0%,#3D0030 50%,#6B0050 100%);color:#fff;padding:48px 16px;text-align:center;position:relative;overflow:hidden;}
.hero::before{content:'★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★';position:absolute;top:10px;left:0;right:0;font-size:12px;color:rgba(255,255,255,0.08);letter-spacing:8px;}
.hero h1{font-family:'Playfair Display',serif;font-size:clamp(28px,6vw,52px);font-weight:700;line-height:1.1;margin-bottom:12px;}
.hero h1 em{color:var(--coral);font-style:italic;}
.hero p{font-size:16px;color:rgba(255,255,255,0.75);max-width:500px;margin:0 auto 24px;}
.hero-cta{display:inline-block;background:var(--hot);color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:30px;text-decoration:none;letter-spacing:.5px;}
.disclosure{background:#FFF0F7;border-left:4px solid var(--pink);padding:10px 16px;font-size:12px;color:var(--muted);text-align:center;}
.cats{background:var(--white);border-bottom:1px solid #F0D0E8;padding:12px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.cats-inner{display:flex;gap:8px;max-width:1200px;margin:0 auto;min-width:max-content;}
.cat-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:24px;border:1.5px solid var(--pink);background:var(--white);color:var(--pink);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none;transition:all .2s;}
.cat-btn:hover,.cat-btn.active{background:var(--pink);color:#fff;}
.articles-section{max-width:1200px;margin:0 auto;padding:48px 16px 32px;}
.articles-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:14px;border-bottom:2px solid var(--light);}
.articles-section-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--dark);}
.articles-count{background:var(--pink);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;}
.articles-view-all{color:var(--pink);font-size:14px;font-weight:700;text-decoration:none;border:1.5px solid var(--pink);padding:6px 16px;border-radius:20px;}
.articles-view-all:hover{background:var(--pink);color:#fff;}
.hero-article{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--white);border-radius:20px;overflow:hidden;border:1px solid #F0D0E8;margin-bottom:24px;transition:box-shadow .2s;text-decoration:none;}
.hero-article:hover{box-shadow:0 16px 48px rgba(233,30,140,0.12);}
.hero-article-img{min-height:280px;display:flex;flex-direction:column;justify-content:flex-end;padding:28px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1A0010,#6B0050);}
.hero-article-visual{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;opacity:0.7;}
.hero-article-visual svg{width:100%;height:100%;object-fit:cover;}
.hero-article-content{position:relative;z-index:1;}
.hero-article-img .art-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--coral);font-weight:600;margin-bottom:10px;}
.hero-article-img h2{font-family:'Playfair Display',serif;font-size:clamp(18px,2.5vw,26px);font-weight:700;color:#fff;line-height:1.2;margin-bottom:12px;}
.hero-article-img .art-meta{font-size:12px;color:rgba(255,255,255,0.55);}
.hero-article-body{padding:28px;display:flex;flex-direction:column;justify-content:center;background:var(--white);}
.hero-article-body .art-excerpt{font-size:14px;color:var(--muted);line-height:1.7;margin-bottom:20px;}
.art-read-btn{display:inline-block;background:var(--pink);color:#fff;font-weight:600;font-size:13px;padding:10px 22px;border-radius:24px;text-decoration:none;align-self:flex-start;}
.art-read-btn:hover{background:var(--hot);}
.article-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px;}
.article-card{background:var(--white);border-radius:16px;overflow:hidden;border:1px solid #F0D0E8;transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column;}
.article-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(233,30,140,0.12);}
.article-card-img{height:160px;overflow:hidden;}
.article-card-img svg{width:100%;height:100%;}
.article-card-body{padding:16px;flex:1;display:flex;flex-direction:column;}
.ac-cat{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--coral);font-weight:600;margin-bottom:6px;}
.ac-title{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--dark);margin-bottom:10px;line-height:1.4;flex:1;}
.ac-link{color:var(--pink);font-size:13px;font-weight:600;text-decoration:none;}
.view-all-banner{background:linear-gradient(135deg,#E91E8C,#FF6B9D);border-radius:16px;padding:24px;text-align:center;color:#fff;margin-top:8px;}
.view-all-banner h3{font-family:'Playfair Display',serif;font-size:20px;margin-bottom:8px;}
.view-all-banner p{font-size:13px;opacity:0.9;margin-bottom:16px;}
.view-all-btn{display:inline-block;background:#fff;color:var(--pink);font-weight:700;font-size:14px;padding:10px 28px;border-radius:24px;text-decoration:none;}
.section{max-width:1200px;margin:0 auto;padding:40px 16px;}
.section-header{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid var(--light);}
.section-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--dark);}
.section-badge{background:var(--pink);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;letter-spacing:.5px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
.card{background:var(--white);border-radius:16px;overflow:hidden;border:1px solid #F0D0E8;transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column;}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(233,30,140,0.15);}
.card-img{width:100%;height:180px;object-fit:cover;background:#FFF0F7;display:flex;align-items:center;justify-content:center;font-size:48px;}
.card-body{padding:14px;flex:1;display:flex;flex-direction:column;}
.card-cat{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--coral);font-weight:600;margin-bottom:4px;}
.card-title{font-size:14px;font-weight:600;color:var(--dark);margin-bottom:6px;line-height:1.4;}
.card-desc{font-size:12px;color:var(--muted);line-height:1.5;flex:1;margin-bottom:12px;}
.card-price{font-size:13px;font-weight:600;color:var(--pink);margin-bottom:10px;}
.card-btn{display:block;background:var(--pink);color:#fff;text-align:center;padding:9px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;}
.card-btn:hover{background:var(--hot);}
footer{background:var(--dark);color:rgba(255,255,255,0.6);text-align:center;padding:32px 16px;font-size:13px;line-height:1.8;}
footer a{color:var(--coral);text-decoration:none;}
footer strong{color:#fff;}
[id]{scroll-margin-top:80px;}
@media(max-width:700px){
  .hero-article{grid-template-columns:1fr;}
  .hero-article-img{min-height:200px;}
  .hero h1{font-size:28px;}
  .grid{grid-template-columns:repeat(2,1fr);}
  .article-cards{grid-template-columns:1fr;}
}
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
    <div class="header-nav">
      <a href="/articles.html">✍ Style Guides</a>
      <a href="#fashion" class="header-badge">🛍 Shop Now</a>
    </div>
  </div>
</header>
<div class="hero">
  <h1>Dress Like Your<br><em>Favourite Star</em></h1>
  <p>Bollywood-inspired fashion, beauty & accessories — all on Amazon</p>
  <a href="#articles" class="hero-cta">Read Style Guides ↓</a>
</div>
<div class="disclosure">
  📢 As an Amazon Associate, BollywoodEdge earns from qualifying purchases. Prices subject to change.
</div>
<div class="cats">
  <div class="cats-inner">
    <a href="#articles" class="cat-btn">📖 Style Guides</a>
    <a href="#fashion" class="cat-btn">👗 Fashion</a>
    <a href="#beauty" class="cat-btn">💄 Beauty</a>
    <a href="#accessories" class="cat-btn">💍 Accessories</a>
    <a href="#skincare" class="cat-btn">✨ Skincare</a>
    <a href="#fragrance" class="cat-btn">🌸 Fragrance</a>
    <a href="#ethnic" class="cat-btn">🪷 Ethnic Wear</a>
    <a href="#fitness" class="cat-btn">💪 Fitness</a>
    <a href="#gifts" class="cat-btn">🎁 Gifts</a>
  </div>
</div>

<div id="articles" class="articles-section">
  <div class="articles-section-header">
    <div style="display:flex;align-items:center;gap:12px;">
      <h2 class="articles-section-title">📖 Style Guides & Celebrity Looks</h2>
      <span class="articles-count">${articles.length} GUIDES</span>
    </div>
    <a href="/articles.html" class="articles-view-all">View all guides →</a>
  </div>

  ${featuredArticle ? `
  <a href="/articles/${featuredArticle.slug}.html" class="hero-article">
    <div class="hero-article-img">
      <div class="hero-article-visual">${featuredVisualResized}</div>
      <div class="hero-article-content">
        <div class="art-label">${featuredArticle.emojiCat} · LATEST</div>
        <h2>${featuredArticle.title}</h2>
        <div class="art-meta">Style Guide · Amazon picks inside</div>
      </div>
    </div>
    <div class="hero-article-body">
      <p class="art-excerpt">Bollywood style decoded — every look broken down with real products you can shop right now on Amazon India.</p>
      <span class="art-read-btn">Read the Guide →</span>
    </div>
  </a>` : ""}

  <div class="article-cards">
    ${gridCards}
  </div>

  <div class="view-all-banner">
    <h3>✨ ${articles.length} Style Guides & Growing</h3>
    <p>New celebrity style guide published every day — all with Amazon picks inside.</p>
    <a href="/articles.html" class="view-all-btn">View All Style Guides →</a>
  </div>
</div>

<div id="fashion" class="section">
  <div class="section-header">
    <h2 class="section-title">👗 Fashion</h2>
    <span class="section-badge">TRENDING</span>
  </div>
  <div class="grid">
    <div class="card"><div class="card-img">👗</div><div class="card-body"><div class="card-cat">Celebrity Style</div><div class="card-title">Bollywood-Inspired Anarkali Suit</div><div class="card-desc">Elegant floral embroidery — as seen on your favourite stars at film premieres</div><div class="card-price">From ₹1,299</div><a href="https://www.amazon.in/s?k=anarkali+suit+women&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">👘</div><div class="card-body"><div class="card-cat">Alia Bhatt Inspired</div><div class="card-title">Printed Kurta Set</div><div class="card-desc">Contemporary Indian casual — perfect for brunch, events and everyday elegance</div><div class="card-price">From ₹899</div><a href="https://www.amazon.in/s?k=printed+kurta+set+women&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">🥻</div><div class="card-body"><div class="card-cat">Red Carpet Look</div><div class="card-title">Designer Saree Collection</div><div class="card-desc">Georgette, silk and chiffon sarees inspired by Bollywood award nights</div><div class="card-price">From ₹1,999</div><a href="https://www.amazon.in/s?k=designer+saree+women&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
</div>

<div id="beauty" class="section" style="background:var(--light);border-radius:24px;margin:0 16px;padding:40px 24px;max-width:none;">
  <div style="max-width:1200px;margin:0 auto;">
  <div class="section-header"><h2 class="section-title">💄 Beauty</h2><span class="section-badge">BESTSELLERS</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">💄</div><div class="card-body"><div class="card-cat">Katrina Kaif Picks</div><div class="card-title">Long-Wear Liquid Lipstick Set</div><div class="card-desc">Smudge-proof, transfer-resistant formula in 12 Bollywood-favourite shades</div><div class="card-price">From ₹499</div><a href="https://www.amazon.in/s?k=long+wear+liquid+lipstick+set&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">👁️</div><div class="card-body"><div class="card-cat">Glam Makeup</div><div class="card-title">Smoky Eye Palette</div><div class="card-desc">12 richly pigmented shades for the classic Bollywood smoky eye look</div><div class="card-price">From ₹699</div><a href="https://www.amazon.in/s?k=smoky+eye+palette&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">✨</div><div class="card-body"><div class="card-cat">Glow Essentials</div><div class="card-title">Highlighter & Blush Duo</div><div class="card-desc">Achieve the dewy Bollywood glow — perfect for photography and events</div><div class="card-price">From ₹399</div><a href="https://www.amazon.in/s?k=highlighter+blush+makeup&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
  </div>
</div>

<div id="accessories" class="section">
  <div class="section-header"><h2 class="section-title">💍 Accessories</h2><span class="section-badge">NEW IN</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">💍</div><div class="card-body"><div class="card-cat">Priyanka Chopra Style</div><div class="card-title">Statement Oxidised Jewellery Set</div><div class="card-desc">Necklace, earrings and maang tikka — complete the ethnic look</div><div class="card-price">From ₹799</div><a href="https://www.amazon.in/s?k=oxidised+jewellery+set+ethnic&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">👜</div><div class="card-body"><div class="card-cat">Street Style</div><div class="card-title">Embroidered Potli Bag</div><div class="card-desc">Bollywood wedding season essential — zari work, multiple colour options</div><div class="card-price">From ₹599</div><a href="https://www.amazon.in/s?k=embroidered+potli+bag&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">🕶️</div><div class="card-body"><div class="card-cat">Star-Spotted</div><div class="card-title">Oversized Cat-Eye Sunglasses</div><div class="card-desc">Airport look approved — UV400 protection, seen on leading Bollywood actresses</div><div class="card-price">From ₹449</div><a href="https://www.amazon.in/s?k=cat+eye+sunglasses+women&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
</div>

<div id="skincare" class="section" style="background:var(--light);border-radius:24px;margin:0 16px;padding:40px 24px;max-width:none;">
  <div style="max-width:1200px;margin:0 auto;">
  <div class="section-header"><h2 class="section-title">✨ Skincare</h2><span class="section-badge">DEEPIKA'S PICKS</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">🌿</div><div class="card-body"><div class="card-cat">Glass Skin</div><div class="card-title">Vitamin C Brightening Serum</div><div class="card-desc">The glow secret behind Bollywood's flawless complexions — dermatologist-tested</div><div class="card-price">From ₹599</div><a href="https://www.amazon.in/s?k=vitamin+c+brightening+serum&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">☀️</div><div class="card-body"><div class="card-cat">Daily Essential</div><div class="card-title">SPF 50 Tinted Sunscreen</div><div class="card-desc">Lightweight, non-greasy formula — all skin types, no white cast</div><div class="card-price">From ₹349</div><a href="https://www.amazon.in/s?k=spf+50+tinted+sunscreen+india&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
  </div>
</div>

<div id="fragrance" class="section">
  <div class="section-header"><h2 class="section-title">🌸 Fragrance</h2><span class="section-badge">STAR SCENTS</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">🌸</div><div class="card-body"><div class="card-cat">For Her</div><div class="card-title">Floral Oriental Eau de Parfum</div><div class="card-desc">Inspired by the signature scents of Bollywood's leading ladies — long-lasting, elegant</div><div class="card-price">From ₹899</div><a href="https://www.amazon.in/s?k=floral+oriental+perfume+women+india&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">🫙</div><div class="card-body"><div class="card-cat">For Him</div><div class="card-title">Oud & Woody Cologne</div><div class="card-desc">Bold, masculine and distinctly desi — the scent of Bollywood's leading men</div><div class="card-price">From ₹799</div><a href="https://www.amazon.in/s?k=oud+woody+cologne+men+india&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
</div>

<div id="ethnic" class="section" style="background:var(--light);border-radius:24px;margin:0 16px;padding:40px 24px;max-width:none;">
  <div style="max-width:1200px;margin:0 auto;">
  <div class="section-header"><h2 class="section-title">🪷 Ethnic Wear</h2><span class="section-badge">WEDDING SEASON</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">🪷</div><div class="card-body"><div class="card-cat">Wedding Collection</div><div class="card-title">Banarasi Silk Lehenga</div><div class="card-desc">Bridal-quality weaves at accessible prices — available in 20+ colour combinations</div><div class="card-price">From ₹2,499</div><a href="https://www.amazon.in/s?k=banarasi+silk+lehenga&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">🎋</div><div class="card-body"><div class="card-cat">Festive Ready</div><div class="card-title">Embroidered Salwar Kameez</div><div class="card-desc">Eid, Diwali and wedding season staple — mirror work, thread embroidery options</div><div class="card-price">From ₹1,199</div><a href="https://www.amazon.in/s?k=embroidered+salwar+kameez+festive&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
  </div>
</div>

<div id="fitness" class="section">
  <div class="section-header"><h2 class="section-title">💪 Fitness</h2><span class="section-badge">STAR WORKOUT</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">🏋️</div><div class="card-body"><div class="card-cat">Gym Wear</div><div class="card-title">High-Waist Yoga Leggings</div><div class="card-desc">As worn by Bollywood's fittest actresses — squat-proof, moisture-wicking fabric</div><div class="card-price">From ₹699</div><a href="https://www.amazon.in/s?k=high+waist+yoga+leggings+women&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">🧘</div><div class="card-body"><div class="card-cat">Wellness</div><div class="card-title">Premium Yoga Mat</div><div class="card-desc">Non-slip, eco-friendly — the workout essential for Bollywood's wellness routines</div><div class="card-price">From ₹999</div><a href="https://www.amazon.in/s?k=premium+yoga+mat+non+slip&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
</div>

<div id="gifts" class="section" style="background:var(--light);border-radius:24px;margin:0 16px 40px;padding:40px 24px;max-width:none;">
  <div style="max-width:1200px;margin:0 auto;">
  <div class="section-header"><h2 class="section-title">🎁 Gifts</h2><span class="section-badge">FOR EVERY OCCASION</span></div>
  <div class="grid">
    <div class="card"><div class="card-img">🎁</div><div class="card-body"><div class="card-cat">Gift Sets</div><div class="card-title">Luxury Beauty Gift Hamper</div><div class="card-desc">Curated skincare and makeup gifts — perfect for birthdays, anniversaries, Eid & Diwali</div><div class="card-price">From ₹1,499</div><a href="https://www.amazon.in/s?k=luxury+beauty+gift+hamper+india&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
    <div class="card"><div class="card-img">💝</div><div class="card-body"><div class="card-cat">For Her</div><div class="card-title">Bollywood-Style Jewellery Gift Box</div><div class="card-desc">Layered necklace, earrings and bracelet set — elegant packaging, ready to gift</div><div class="card-price">From ₹999</div><a href="https://www.amazon.in/s?k=jewellery+gift+set+women+india&tag=bollywooded0f-21" class="card-btn" target="_blank" rel="nofollow sponsored noopener">Shop on Amazon →</a></div></div>
  </div>
  </div>
</div>

<footer>
  <p style="font-size:18px;font-family:'Playfair Display',serif;color:#fff;margin-bottom:8px;">BollywoodEdge</p>
  <p>Celebrity Style. Real Products. Every Day.</p>
  <p style="margin-top:12px;"><a href="/articles.html">Style Guides</a> &nbsp;·&nbsp; <a href="#fashion">Shop</a></p>
  <p style="margin-top:16px;font-size:12px;">As an Amazon Associate, BollywoodEdge earns from qualifying purchases made through links on this site.<br>Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.<br><br>Associate IDs: <strong>bollywooded0f-21</strong> (Amazon.in) · <strong>bollywoodedge-20</strong> (Amazon.com)</p>
  <p style="margin-top:12px;font-size:12px;">© ${new Date().getFullYear()} BollywoodEdge</p>
</footer>
<script>
const catBtns = document.querySelectorAll('.cat-btn');
const sections = document.querySelectorAll('[id]');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting){
      catBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('href') === '#' + e.target.id);
      });
    }
  });
}, {threshold:0.3});
sections.forEach(s => observer.observe(s));
</script>
</body>
</html>`;
}

function gitPush(slug) {
  console.log("\n📤 Pushing to GitHub...");
  try {
    execSync(`git config user.email "filmtabela@gmail.com"`, { stdio: "inherit" });
    execSync(`git config user.name "BollywoodEdge Bot"`, { stdio: "inherit" });
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
  // One-time self-heal: repair old amazon.com links + retrofit Shop the Look
  // boxes into existing articles that don't have one yet
  for (const f of fs.readdirSync(articlesDir).filter(x => x.endsWith(".html"))) {
    const fp = path.join(articlesDir, f);
    let c = fs.readFileSync(fp, "utf8");
    let changed = false;
    const fixed = c
      .split("https://www.amazon.com/s?").join("https://www.amazon.in/s?")
      .split("tag=bollywoodedge-20").join("tag=bollywooded0f-21");
    if (fixed !== c) { c = fixed; changed = true; console.log(`🔧 Fixed old links in ${f}`); }
    if (!c.includes("Shop the Look")) {
      const t = TOPICS.find(x => slugify(x.title) === f.replace(".html", ""));
      const prods = t ? productsForTopic(t) : [];
      if (prods.length && c.includes('<div class="shop-box">')) {
        c = c.replace('<div class="shop-box">', buildShopTheLookHTML(prods).trim() + '\n  <div class="shop-box">');
        changed = true;
        console.log(`🛍  Retrofitted Shop the Look into ${f}`);
      }
    }
    if (changed) fs.writeFileSync(fp, c);
  }

  const existingSlugs = getExistingSlugs(articlesDir);
  const topic = getTodaysTopic(existingSlugs);
  console.log(`📌 Today's topic: ${topic.title}`);

  try {
    const products = productsForTopic(topic);
    if (products.length) console.log(`🛍  Products: ${products.map(p => p.id).join(", ")}`);
    const articleText = await generateArticle(topic, products);
    const slug = slugify(topic.title);
    console.log("🖼️  Fetching Pexels images...");
    const heroQuery = products[0] && products[0].img ? products[0].img : null;
    const pexelsImage = await fetchPexelsImage(topic.title, topic.category, heroQuery);
    if (pexelsImage) {
      console.log(`✅ Hero image: ${pexelsImage.photographer}${heroQuery ? ` (query: ${heroQuery})` : ""}`);
    } else {
      console.log("⚠️  No Pexels image — using SVG visual");
    }
    const midQuery = products[1] && products[1].img ? products[1].img : null;
    const midImage = await fetchPexelsImage(topic.title, topic.category, midQuery);
    if (midImage) console.log(`✅ Mid-article image: ${midImage.photographer}${midQuery ? ` (query: ${midQuery})` : ""}`);
    const html = buildArticleHTML(topic, articleText, pexelsImage, products, midImage);

    const filePath = path.join(articlesDir, `${slug}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`✅ Article saved: ${filePath}`);

    const allSlugs = getExistingSlugs(articlesDir);
    const allArticles = getArticleMetadata(articlesDir, allSlugs);
    const indexHTML = buildArticlesIndexHTML(allArticles);
    const indexPath = path.join(SITE_DIR, "articles.html");
    fs.writeFileSync(indexPath, indexHTML);
    console.log(`✅ Articles index updated: ${allArticles.length} articles listed`);

    const homepageHTML = buildHomepageHTML(allArticles);
    const homepagePath = path.join(SITE_DIR, "index.html");
    fs.writeFileSync(homepagePath, homepageHTML);
    console.log(`✅ Homepage updated with ${allArticles.length} articles`);

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
