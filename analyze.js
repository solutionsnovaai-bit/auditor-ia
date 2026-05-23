export const config = { runtime: "edge" };

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyAJKndXI7Hwo9zZsW54pITXBYhftamzAHw";
const GROQ_KEY   = process.env.GROQ_API_KEY   || "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";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Groq (texto) ──────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Groq erro ${resp.status}`);

  // Normaliza pra formato Gemini que o App.jsx já espera
  const text = data.choices?.[0]?.message?.content || "";
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

// ── Gemini (áudio) ────────────────────────────────────────────────────────────
async function callGemini(model, contents, generationConfig) {
  const modelName = model
    .replace("gemini-1.5-flash", "gemini-2.0-flash")
    .replace("gemini-1.5-pro",   "gemini-2.0-flash")
    .replace("gemini-pro",       "gemini-2.0-flash");

  const url = `${GEMINI_API_URL}/${modelName}:generateContent?key=${GEMINI_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Gemini erro ${resp.status}`);
  return data;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Body inválido" }, 400); }

  const { provider, model, contents, generationConfig, prompt } = body;

  try {
    let data;

    if (provider === "groq") {
      data = await callGroq(prompt);
    } else {
      data = await callGemini(model, contents, generationConfig);
    }

    return json(data);
  } catch (err) {
    return json({ error: err.message || "Erro inesperado" }, 500);
  }
}
