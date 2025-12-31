import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

const USE_CACHE = true;

const MAX_TOKENS = 100;
const MODEL = "gpt-4o-mini";

function hashPrompt(prompt) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function extractTextFromResponse(data) {
  // Responses API structure: data.output[0].content[0].text
  if (data?.output?.[0]?.content?.[0]?.text) {
    let text = data.output[0].content[0].text;

    // Remove JSON encoding if present (text might be "\"quoted text\"")
    if (typeof text === "string") {
      // Try JSON parsing first for proper unescaping
      if (text.startsWith('"') && text.endsWith('"')) {
        try {
          text = JSON.parse(text);
        } catch (e) {
          // If parsing fails, manually remove quotes
          text = text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        }
      }
      
      // Strip any remaining leading/trailing quotes (single or double)
      text = text.replace(/^["']+|["']+$/g, '').trim();
    }

    return text;
  }

  return null;
}

export async function getCachedCompletion(prompt) {
  const hash = hashPrompt(prompt);

  const result = await pool.query(
    "SELECT completion, created_at FROM llm_cache WHERE prompt_hash = $1",
    [hash],
  );

  if (result.rows.length > 0) {
    let completion = result.rows[0].completion;
    // Strip quotes from cached completions for consistency
    if (typeof completion === "string") {
      completion = completion.replace(/^["']+|["']+$/g, '').trim();
    }
    return completion;
  }

  return null;
}

export async function cacheCompletion(prompt, completion) {
  const hash = hashPrompt(prompt);

  await pool.query(
    `INSERT INTO llm_cache (prompt_hash, prompt, completion, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (prompt_hash) DO UPDATE SET 
       completion = EXCLUDED.completion,
       created_at = NOW()`,
    [hash, prompt, completion],
  );
}

export async function getCompletion(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  if (USE_CACHE) {
    const cached = await getCachedCompletion(prompt);
    if (cached) {
      return { completion: cached, cached: true };
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          type: "message",
          role: "system",
          content:
            "You are a witty, playful assistant that enhances statistics with short, fun commentary. Keep responses under 15 words. Be clever and conversational. Do not wrap your response in quotes.",
        },
        {
          type: "message",
          role: "user",
          content: prompt,
        },
      ],
      max_output_tokens: MAX_TOKENS,
      // temperature: 1.9
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  let completion = extractTextFromResponse(data);

  // Fallback to old format if needed
  if (!completion) {
    completion =
      data.output?.[0]?.content || data.choices?.[0]?.message?.content || "";
  }

  // Ensure completion is always a string
  if (typeof completion !== "string") {
    console.error(
      "❌ [LLM] Completion is not a string! Type:",
      typeof completion,
      "Value:",
      completion,
    );
    completion = "";
  }

  if (USE_CACHE) {
    await cacheCompletion(prompt, completion);
  }

  return { completion, cached: false };
}

export async function initLLMCache() {
  const sql = `
    CREATE TABLE IF NOT EXISTS llm_cache (
      prompt_hash TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      completion TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_llm_created_at ON llm_cache(created_at);
  `;

  await pool.query(sql);
}
