import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import https from "https";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-workspace-id": "wrkspc_01HZV5EzeEM42jg4JLB9UxR8",
  },
});

const AMAZON_TAG = "bollywooded0f-21"; // Fixed affiliate tag
const ASIN_CACHE = {}; // Cache ASINs to avoid repeated lookups

function createBatchRequest(
  custom_id,
  topic,
  model = "claude-haiku-4-5-20251001",
  systemPrompt,
  userPrompt
) {
  return {
    custom_id: custom_id,
    params: {
      model: model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    },
  };
}

async function submitBatch(requests) {
  if (requests.length === 0) {
    console.log("No requests to batch.");
    return null;
  }

  console.log(`Submitting BollywoodEdge batch with ${requests.length} requests...`);

  const batch = await client.beta.messages.batches.create({
    requests: requests,
  });

  console.log(`Batch submitted. ID: ${batch.id}`);
  fs.writeFileSync("batch-id.txt", batch.id);

  return batch;
}

async function pollBatchResults(batchId) {
  let batch = await client.beta.messages.batches.retrieve(batchId);

  while (batch.processing_status === "in_progress") {
    console.log(`Batch processing... waiting 60s`);
    await new Promise((resolve) => setTimeout(resolve, 60000));
    batch = await client.beta.messages.batches.retrieve(batchId);
  }

  console.log(`Batch complete. Status: ${batch.processing_status}`);

  if (batch.processing_status === "succeeded") {
    const results = await client.beta.messages.batches.results(batchId);
    const articles = [];

    for await (const result of results) {
      if (result.result.type === "succeeded") {
        articles.push({
          id: result.custom_id,
          content: result.result.message.content[0].text,
          status: "success",
        });
      } else {
        console.error(`Request failed:`, result.result);
        articles.push({
          id: result.custom_id,
          status: "failed",
        });
      }
    }

    return articles;
  }

  return [];
}

// Automated ASIN lookup via Amazon search (scrapes first result)
async function getASINFromAmazon(productName) {
  if (ASIN_CACHE[productName]) {
    return ASIN_CACHE[productName];
  }

  return new Promise((resolve) => {
    const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(productName)}`;
    
    https.get(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        // Extract ASIN from Amazon search results (look for /dp/ASIN pattern)
        const match = data.match(/\/dp\/([A-Z0-9]{10})/);
        const asin = match ? match[1] : null;
        
        if (asin) {
          ASIN_CACHE[productName] = asin;
          console.log(`✓ Found ASIN for "${productName}": ${asin}`);
        } else {
          console.log(`✗ Could not find ASIN for "${productName}" — using search link`);
        }
        
        resolve(asin);
      });
    }).on("error", () => {
      console.log(`⚠ Error looking up "${productName}" — using search link`);
      resolve(null);
    });
  });
}

// Replace [PRODUCT_LINK:...] tags with actual affiliate links
async function injectAffiliateLinks(htmlContent) {
  const productRegex = /\[PRODUCT_LINK:([^\|]+)\|([^\]]+)\]/g;
  let match;
  let result = htmlContent;

  while ((match = productRegex.exec(htmlContent)) !== null) {
    const productName = match[1].trim();
    const description = match[2].trim();

    const asin = await getASINFromAmazon(productName);
    
    let affiliateLink;
    if (asin) {
      // Direct product link with affiliate tag
      affiliateLink = `<a href="https://amazon.in/dp/${asin}?tag=${AMAZON_TAG}" target="_blank" rel="noopener noreferrer">${productName}</a>`;
    } else {
      // Fallback to search link with affiliate tag
      affiliateLink = `<a href="https://amazon.in/s?k=${encodeURIComponent(productName)}&tag=${AMAZON_TAG}" target="_blank" rel="noopener noreferrer">${productName}</a>`;
    }

    result = result.replace(match[0], affiliateLink);
  }

  return result;
}

function buildArticleHTML(title, content) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - BollywoodEdge</title>
  <meta name="description" content="${title}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Georgia, serif; line-height: 1.7; max-width: 700px; margin: 0 auto; padding: 20px; }
    article { color: #333; }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    h2 { font-size: 1.8em; margin-top: 30px; }
    p { margin: 15px 0; }
    a { color: #d4af37; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    <p><em>Published: ${new Date().toLocaleDateString()}</em></p>
    ${content}
    <hr>
    <p><small>BollywoodEdge - Lifestyle & Fashion For Affluent India</small></p>
  </article>
</body>
</html>`;

  return { slug, html };
}

async function publishArticle(title, content) {
  const { slug, html } = buildArticleHTML(title, content);
  
  // Inject affiliate links (auto-lookup ASINs)
  const htmlWithLinks = await injectAffiliateLinks(html);
  
  const htmlPath = path.join("articles", `${slug}.html`);

  if (!fs.existsSync("articles")) {
    fs.mkdirSync("articles", { recursive: true });
  }

  fs.writeFileSync(htmlPath, htmlWithLinks);
  console.log(`✓ Published: ${slug}`);

  return slug;
}

function getRandomTopics(count = 3) {
  const topics = [
    "Best Luxury Watches Under 50k: Affordable Elegance",
    "Hidden Gems: Indian Celebrities Wearing Underrated Fashion Brands",
    "The Art of Power Dressing: CEO Style Lessons from Business Icons",
    "Sustainable Luxury: High-End Fashion Brands Going Green",
    "Celebrity Travel Hacks: How to Travel Like Bollywood Stars",
    "Desk Setup Ideas from Silicon Valley Entrepreneurs",
    "The Psychology of Luxury: Why We Crave Premium Goods",
    "Designer Dupes That Actually Work: Shopping Smart",
    "Grooming on a Budget: Premium Results, Affordable Price",
    "Networking Events Fashion: What to Wear for Success",
  ];

  const shuffled = [...topics].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function main() {
  if (process.argv[2] === "retrieve" && fs.existsSync("batch-id.txt")) {
    const batchId = fs.readFileSync("batch-id.txt", "utf-8").trim();
    console.log(`Retrieving BollywoodEdge batch ${batchId}...`);

    const articles = await pollBatchResults(batchId);

    for (const article of articles) {
      if (article.status === "success") {
        const title = article.id.replace("bollywood-", "").replace(/-/g, " ");
        await publishArticle(title, article.content);
      }
    }

    console.log(`✓ Published ${articles.length} BollywoodEdge articles`);
    fs.unlinkSync("batch-id.txt");
    return;
  }

  console.log("Building BollywoodEdge batch...");

  const topics = getRandomTopics(3);
  const requests = [];

  for (const topic of topics) {
    const systemPrompt = `You are a lifestyle and entertainment writer for BollywoodEdge, writing for affluent Indian readers aged 25-45. Focus on style, luxury, and aspirational content. Incorporate relevant product recommendations naturally.`;

    const userPrompt = `Write an engaging BollywoodEdge article about: "${topic}"

Target: Affluent Indian readers interested in lifestyle, luxury, fashion

Requirements:
- 800-1200 words
- Engaging, conversational tone
- Include 2-3 specific product recommendations
- Format as HTML <p> and <h2> tags
- When mentioning products, use this format: [PRODUCT_LINK:Product Name|brief-description]
  Example: [PRODUCT_LINK:Casio G-Shock GA2100|affordable luxury watch]
- End with a style takeaway or inspiration

The [PRODUCT_LINK:...] tags will be automatically converted to working affiliate links.`;

    requests.push(
      createBatchRequest(
        `bollywood-${topic.toLowerCase().replace(/\s+/g, "-")}`,
        topic,
        "claude-haiku-4-5-20251001",
        systemPrompt,
        userPrompt
      )
    );
  }

  const batch = await submitBatch(requests);

  if (batch) {
    console.log(`\nBollywoodEdge Batch queued. Retrieve with:`);
    console.log(`  node publish.js retrieve`);
    console.log(`Cost: 50% off. Processing 12-24 hours.`);
  }
}

main().catch(console.error);
