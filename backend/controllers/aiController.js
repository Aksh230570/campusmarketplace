/**
 * AI Controller
 * Uses Google Gemini 1.5 Flash (free) by default.
 * Falls back to OpenAI GPT-3.5 if OPENAI_API_KEY is set.
 *
 * Resume-worthy AI features:
 *  - Smart listing description generation
 *  - AI price suggestion using live comparable listings
 *  - Auto tag generation for search optimization
 *  - Spam & fraud detection with scoring
 *  - Context-aware marketplace assistant chatbot
 *  - Negotiation tip generator
 */

const Listing = require("../models/Listing");

// ── AI Client factory ─────────────────────
const getAI = () => {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = require("openai");
    return {
      type: "openai",
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    };
  }
  if (process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return {
      type: "gemini",
      client: genai.getGenerativeModel({ model: "gemini-2.0-flash" }),
    };
  }
  return null;
};

const generate = async (prompt, expectJson = false) => {
  const ai = getAI();
  if (!ai) {
    const err = new Error("NO_AI_CONFIGURED");
    err.status = 503;
    throw err;
  }

  let text;
  if (ai.type === "openai") {
    const res = await ai.client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
    });
    text = res.choices[0].message.content.trim();
  } else {
    const res = await ai.client.generateContent(prompt);
    text = res.response.text().trim();
  }

  // Strip markdown code fences if AI wraps JSON in them
  if (expectJson) {
    text = text.replace(/```(?:json)?|```/g, "").trim();
  }

  return text;
};

// ── 1. Generate Description ───────────────
exports.generateDescription = async (req, res) => {
  try {
    const { title, category, condition } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const text = await generate(
      `You are helping a college student write a marketplace listing description.
Item: "${title}"
Category: ${category}
Condition: ${condition}

Write a 2-3 paragraph honest, conversational product description in a student-to-student tone.
- Mention what makes it worth buying
- Mention any relevant condition details
- Keep it under 200 words
- Do NOT start with "I am selling" or any heading
- Sound natural, not salesy`
    );

    res.json({ description: text });
  } catch (err) {
    handleAIError(err, res);
  }
};

// ── 2. Suggest Price ─────────────────────
exports.suggestPrice = async (req, res) => {
  try {
    const { title, category, condition } = req.body;

    // Pull real comparable listings from same college
    const comparables = await Listing.find({
      college: req.user.college,
      category,
      status: "available",
      _id: { $ne: req.body.listingId },
    })
      .limit(5)
      .select("title price condition");

    const comparableText = comparables.length
      ? comparables
          .map((l) => `- ${l.title} (${l.condition}): ₹${l.price}`)
          .join("\n")
      : "No similar listings found at this college yet.";

    const text = await generate(
      `You are a pricing assistant for a college campus marketplace in India.

Item to price: "${title}"
Category: ${category}
Condition: ${condition}

Current similar listings at this college:
${comparableText}

Suggest a fair resale price in Indian Rupees.
Respond ONLY with valid JSON, no explanation outside the JSON:
{
  "min": <number>,
  "suggested": <number>,
  "max": <number>,
  "reasoning": "<one concise sentence explaining the price>"
}`,
      true
    );

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: "AI returned invalid JSON. Try again." });
    }
    handleAIError(err, res);
  }
};

// ── 3. Generate Tags ─────────────────────
exports.generateTags = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    const text = await generate(
      `Generate search tags for this college marketplace listing.

Title: "${title}"
Category: ${category}
Description: "${(description || "").slice(0, 300)}"

Return ONLY a JSON array of 5-8 lowercase search tags.
Example: ["laptop","apple","macbook","m1","college","electronics"]
No explanation, just the JSON array.`,
      true
    );

    const tags = JSON.parse(text);
    res.json({ tags: Array.isArray(tags) ? tags : [] });
  } catch (err) {
    handleAIError(err, res);
  }
};

// ── 4. Spam / Fraud Detection ────────────
exports.detectSpam = async (req, res) => {
  try {
    const { title, description, price, category } = req.body;

    const text = await generate(
      `You are a fraud detection system for a college campus marketplace.
Analyze this listing for spam, fraud, or policy violations.

Title: "${title}"
Category: ${category}
Price: ₹${price}
Description: "${(description || "").slice(0, 400)}"

Check for: unrealistic pricing, suspicious language, duplicate/spam content,
prohibited items, scam patterns.

Respond ONLY with valid JSON:
{
  "spamScore": <0-100, where 0=clean 100=definite spam>,
  "isSpam": <true if spamScore > 60>,
  "flags": ["<specific issue 1>", "<specific issue 2>"],
  "recommendation": "<one sentence action>"
}`,
      true
    );

    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    handleAIError(err, res);
  }
};

// ── 5. Marketplace Assistant Chatbot ─────
exports.assistant = async (req, res) => {
  try {
    const { message, listingContext, conversationHistory = [] } = req.body;

    const context = listingContext
      ? `The user is currently viewing: "${listingContext.title}" — ₹${listingContext.price} (${listingContext.condition}), sold by ${listingContext.seller}.`
      : "";

    // Build conversation history for context
    const historyText = conversationHistory
      .slice(-4) // last 4 exchanges
      .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
      .join("\n");

    const text = await generate(
      `You are a helpful campus marketplace assistant for college students in India.
You help with buying/selling advice, price negotiations, safety tips, and platform guidance.
Keep responses concise (under 100 words) and friendly.

${context}
${historyText ? `\nPrevious conversation:\n${historyText}` : ""}

Student: ${message}
Assistant:`
    );

    res.json({ response: text });
  } catch (err) {
    handleAIError(err, res);
  }
};

// ── 6. Negotiation Tips ──────────────────
// Unique AI feature — gives buyer/seller negotiation advice
exports.negotiationTips = async (req, res) => {
  try {
    const { role, itemTitle, askingPrice, offerPrice } = req.body;

    const text = await generate(
      `You are a negotiation coach for college students buying/selling items.

Role: ${role} (buyer or seller)
Item: "${itemTitle}"
Asking price: ₹${askingPrice}
${offerPrice ? `Offer made: ₹${offerPrice}` : ""}

Give 3 practical, friendly negotiation tips for a college student.
Keep each tip to one sentence. Format as a JSON array of strings.
Example: ["Tip one here.", "Tip two here.", "Tip three here."]`,
      true
    );

    const tips = JSON.parse(text);
    res.json({ tips: Array.isArray(tips) ? tips : [] });
  } catch (err) {
    handleAIError(err, res);
  }
};

// ── Error helper ─────────────────────────
function handleAIError(err, res) {
  console.error("AI error:", err.message);
  if (err.message === "NO_AI_CONFIGURED") {
    return res.status(503).json({
      error: "AI_UNAVAILABLE",
      message: "No AI API key configured. Add GEMINI_API_KEY to your .env file.",
    });
  }
  res.status(500).json({ error: "AI request failed", message: err.message });
}
