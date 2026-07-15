import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

function buildArticleHTML(title, content) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title} - BollywoodEdge</title>
  <meta name="description" content="${title}">
</head>
<body>
  <article>
    <h1>${title}</h1>
    ${content}
  </article>
</body>
</html>`;

  return { slug, html };
}

async function publishArticle(title, content) {
  const { slug, html } = buildArticleHTML(title, content);
  const htmlPath = path.join("articles", `${slug}.html`);

  if (!fs.existsSync("articles")) {
    fs.mkdirSync("articles", { recursive: true });
  }

  fs.writeFileSync(htmlPath, html);
  console.log(`Published BollywoodEdge article: ${slug}`);

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

    console.log(`Published ${articles.length} BollywoodEdge articles`);
    fs.unlinkSync("batch-id.txt");
    return;
  }

  console.log("Building BollywoodEdge batch...");

  const topics = getRandomTopics(3);
  const requests = [];

  for (const topic of topics) {
    const systemPrompt = `You are a lifestyle and entertainment writer for BollywoodEdge, writing for affluent Indian readers aged 25-45. Focus on style, luxury, and aspirational content. Incorporate relevant product recommendations and affiliate links naturally.`;

    const userPrompt = `Write an engaging BollywoodEdge article about: "${topic}"

Target: Affluent Indian readers interested in lifestyle, luxury, fashion

Requirements:
- 800-1200 words
- Engaging, conversational tone
- Include specific product/brand recommendations
- Format as HTML <p> and <h2> tags
- Create natural opportunities for affiliate links (e.g., "Check out this brand on Amazon")
- End with a style takeaway or inspiration`;

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
