/**
 * GrapeGreen browser SLM API
 * Loads the exported grapegreen-model.json TensorFlow.js transformer and runs
 * real next-token inference. This module is browser-side; it does not expose a
 * server API and does not upload prompts or mutate weights in Firestore.
 */
const webguide = ["To Access The Web You May Do Only If You Require It To Answear The user the following commands: WikiSearch(article); replace the article word inside with whatever information you need to access, for current date say CurDate(); if you want to know time say CurTime(); and if you want to check duckduckgo say DDGsearch(query) replace query with what you want to search, and for doing math do MathCalculate(expression) can multiplycation that is * or division that is / or subtraction that is - or addation that is + then enter the following 2 numbers to do math, for news search do NewsSearch(article, date); for article that means what you wnat to search, for date that means the CurDate();"];
const MODEL_URL = new URL("./grapegreen-model.json", import.meta.url);
const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm";

const SPECIAL = Object.freeze({
  BOS: 0,
  EOS: 1,
  UNK: 2,
  USER: 3,
  ASSISTANT: 4,
  BYTE_OFFSET: 5
});

const TIER_LIMITS = Object.freeze({
  free: { maxOutputTokens: 150, memoryTokens: 800, maxThinkTimeMs: 11000 },
  plus: { maxOutputTokens: 200, memoryTokens: 950, maxThinkTimeMs: 17000 },
  pro: { maxOutputTokens: 250, memoryTokens: 1150, maxThinkTimeMs: 24000 },
  max: { maxOutputTokens: 300, memoryTokens: 1300, maxThinkTimeMs: 35000 }
});

const NEE_POPUP_KEYWORDS = [
  "suicide", "suiside", "kill myself", "end my life", "self harm",
  "cutting myself", "want to die"
];
const ILLEGAL_TERMS = ["hack", "murder", "rape", "theft"];
const PROFANITY_TERMS = [
  "pussy", "nigger", "nigga", "fuck", "dick", "cock", "bitch",
  "ass", "asshole", "shit", "crap", "whore"
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let tfPromise;
let modelPromise;
let modelState = null;
let mode = 2; // 0 = offline; 1 = training/dev; 2 = inference

function getTensorFlow() {
  if (!tfPromise) {
    tfPromise = import(TFJS_URL).then(async (tf) => {
      await tf.ready();
      return tf;
    });
  }
  return tfPromise;
}

function validateAndCreateModel(tf, data) {
  const architecture = data?.architecture;
  if (
    data?.format !== "grapegreen-mini-transformer" ||
    data?.version !== 1 ||
    !architecture ||
    !data?.tokenizer ||
    !Array.isArray(data.tokenizer.pieces) ||
    !Array.isArray(data.tokenizer.merges) ||
    !data.parameters ||
    !Number.isInteger(architecture.vocabularySize) ||
    data.tokenizer.pieces.length !== architecture.vocabularySize
  ) {
    throw new Error("grapegreen-model.json is not a supported model export.");
  }

  const tensors = {};
  try {
    for (const [name, entry] of Object.entries(data.parameters)) {
      if (!Array.isArray(entry?.shape) || !Array.isArray(entry?.values)) {
        throw new Error(`Invalid parameter entry: ${name}`);
      }
      const expectedSize = entry.shape.reduce((product, dimension) => {
        if (!Number.isInteger(dimension) || dimension < 1) {
          throw new Error(`Invalid shape for parameter ${name}.`);
        }
        return product * dimension;
      }, 1);
      if (expectedSize !== entry.values.length) {
        throw new Error(`Parameter ${name} has a shape/value count mismatch.`);
      }
      if (!entry.values.every((value) => Number.isFinite(value))) {
        throw new Error(`Parameter ${name} contains a non-finite value.`);
      }
      tensors[name] = tf.tensor(entry.values, entry.shape, "float32");
    }

    const required = [
      "tokenEmbedding", "positionEmbedding", "languageModelWeight",
      "languageModelBias"
    ];
    for (let layer = 0; layer < architecture.layers; layer++) {
      const key = `layer${layer}`;
      required.push(
        `${key}_query`, `${key}_key`, `${key}_value`,
        `${key}_attentionOutput`, `${key}_norm1Scale`, `${key}_norm1Bias`,
        `${key}_ff1`, `${key}_ff1Bias`, `${key}_ff2`, `${key}_ff2Bias`,
        `${key}_norm2Scale`, `${key}_norm2Bias`
      );
    }
    for (const name of required) {
      if (!tensors[name]) throw new Error(`Model is missing parameter ${name}.`);
    }

    const allowed = Array.isArray(data.allowedGenerationTokens) &&
      data.allowedGenerationTokens.length
      ? new Set(data.allowedGenerationTokens.filter((id) =>
          Number.isInteger(id) && id >= 0 && id < architecture.vocabularySize
        ))
      : null;

    return {
      tf,
      architecture,
      tokenizer: data.tokenizer,
      parameters: tensors,
      allowedGenerationTokens: allowed
    };
  } catch (error) {
    Object.values(tensors).forEach((tensor) => tensor.dispose());
    throw error;
  }
}

export async function loadModel() {
  if (modelState) return modelState;
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, response] = await Promise.all([
        getTensorFlow(),
        fetch(MODEL_URL)
      ]);
      if (!response.ok) {
        throw new Error(`Could not load grapegreen-model.json (HTTP ${response.status}).`);
      }
      const data = await response.json();
      modelState = validateAndCreateModel(tf, data);
      return modelState;
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

// Compatibility with the old terminal shell import. This now loads the actual
// transformer export; it does not initialize random placeholder weights.
export async function loadWeightsMatrix() {
  await loadModel();
  return "Loaded grapegreen-model.json transformer weights.";
}

export function setMode(nextMode) {
  if (![0, 1, 2].includes(Number(nextMode))) {
    throw new Error("Mode must be 0 (offline), 1 (development), or 2 (inference).");
  }
  mode = Number(nextMode);
}

export function getMode() {
  return mode;
}

// The exported file is an inference checkpoint, not a trainable optimizer
// checkpoint. Do not pretend that random weight mutation is model training.
export async function submitTerminalFeedback() {
  return "Feedback is unavailable: grapegreen-model.json is an inference-only export.";
}

function normalizeForModeration(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matchesWholeTerm(cleanText, terms) {
  return terms.some((term) => {
    const normalizedTerm = normalizeForModeration(term);
    return normalizedTerm && ` ${cleanText} `.includes(` ${normalizedTerm} `);
  });
}

function inferMood(text) {
  const signals = [
    ["distressed", /\b(overwhelmed|hopeless|terrified|panicking|devastated|miserable|can't cope|cannot cope)\b/i],
    ["sad", /\b(sad|lonely|grieving|heartbroken|down|depressed|crying)\b/i],
    ["angry", /\b(angry|furious|pissed|irritated|frustrated)\b/i],
    ["anxious", /\b(anxious|worried|nervous|scared|afraid|stressed)\b/i],
    ["happy", /\b(happy|great|excited|wonderful|thrilled|glad)\b/i]
  ];
  return signals.find(([, pattern]) => pattern.test(text))?.[0] ?? "neutral";
}

function resolveRequest(input) {
  if (typeof input === "string" || input == null) {
    return { query: String(input ?? ""), context: "", plan: "free", generation: {} };
  }
  return {
    query: String(input.query ?? input.prompt ?? ""),
    context: String(input.context?.text ?? input.context ?? ""),
    plan: String(input.plan ?? "free").toLowerCase(),
    generation: input.generation ?? {},
    signal: input.signal
  };
}

function tokenizerEncode(text, tokenizer) {
  let tokens = Array.from(encoder.encode(text), (byte) => byte + SPECIAL.BYTE_OFFSET);
  for (const merge of tokenizer.merges) {
    const [left, right, newId] = merge;
    const next = [];
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length && tokens[i] === left && tokens[i + 1] === right) {
        next.push(newId);
        i++;
      } else {
        next.push(tokens[i]);
      }
    }
    tokens = next;
  }
  return tokens;
}

function tokenizerDecode(ids, tokenizer) {
  const bytes = [];
  for (const id of ids) {
    if (id < SPECIAL.BYTE_OFFSET) continue;
    const piece = tokenizer.pieces[id];
    if (!Array.isArray(piece)) continue;
    bytes.push(...piece);
  }
  return decoder.decode(new Uint8Array(bytes));
}

function truncateToTokens(text, tokenizer, maxTokens) {
  if (!text || maxTokens <= 0) return "";
  const ids = tokenizerEncode(text, tokenizer);
  return tokenizerDecode(ids.slice(-maxTokens), tokenizer);
}

function layerNorm(tf, input, scale, bias) {
  const moments = tf.moments(input, [-1], true);
  return input
    .sub(moments.mean)
    .mul(tf.rsqrt(moments.variance.add(1e-5)))
    .mul(scale)
    .add(bias);
}

function forward(state, inputIds) {
  const { tf, architecture, parameters: p } = state;
  return tf.tidy(() => {
    const seqLen = inputIds.shape[0];
    const dimension = architecture.dimension;
    const heads = architecture.heads;
    const headDim = dimension / heads;
    if (!Number.isInteger(headDim)) throw new Error("Invalid model head dimensions.");

    let x = tf.gather(p.tokenEmbedding, inputIds);
    x = x.add(p.positionEmbedding.slice([0, 0], [seqLen, dimension]));

    const maskValues = new Float32Array(seqLen * seqLen);
    for (let q = 0; q < seqLen; q++) {
      for (let k = q + 1; k < seqLen; k++) maskValues[q * seqLen + k] = -1e9;
    }
    const causalMask = tf.tensor2d(maskValues, [seqLen, seqLen]).expandDims(0);

    for (let layer = 0; layer < architecture.layers; layer++) {
      const key = `layer${layer}`;
      const query = x.matMul(p[`${key}_query`])
        .reshape([seqLen, heads, headDim]).transpose([1, 0, 2]);
      const keys = x.matMul(p[`${key}_key`])
        .reshape([seqLen, heads, headDim]).transpose([1, 0, 2]);
      const values = x.matMul(p[`${key}_value`])
        .reshape([seqLen, heads, headDim]).transpose([1, 0, 2]);
      const scores = query.matMul(keys.transpose([0, 2, 1])).div(Math.sqrt(headDim));
      const attention = tf.softmax(scores.add(causalMask), -1);
      const attended = attention.matMul(values)
        .transpose([1, 0, 2]).reshape([seqLen, dimension])
        .matMul(p[`${key}_attentionOutput`]);

      const afterAttention = layerNorm(
        tf, x.add(attended), p[`${key}_norm1Scale`], p[`${key}_norm1Bias`]
      );
      const feedForward = tf.relu(
        afterAttention.matMul(p[`${key}_ff1`]).add(p[`${key}_ff1Bias`])
      ).matMul(p[`${key}_ff2`]).add(p[`${key}_ff2Bias`]);
      x = layerNorm(
        tf, afterAttention.add(feedForward),
        p[`${key}_norm2Scale`], p[`${key}_norm2Bias`]
      );
    }

    return x.matMul(p.languageModelWeight).add(p.languageModelBias);
  });
}

function nextTokenLogits(state, contextIds) {
  const tf = state.tf;
  const input = tf.tensor1d(contextIds, "int32");
  let output;
  try {
    output = forward(state, input);
    const lastPosition = output.shape[0] - 1;
    const last = output.slice(
      [lastPosition, 0], [1, state.architecture.vocabularySize]
    ).reshape([state.architecture.vocabularySize]);
    try {
      return Array.from(last.dataSync());
    } finally {
      last.dispose();
    }
  } finally {
    input.dispose();
    if (output) output.dispose();
  }
}

function sampleToken(state, contextIds, generatedIds, settings) {
  const logits = nextTokenLogits(state, contextIds);
  const counts = new Map();
  for (const id of generatedIds.slice(-64)) counts.set(id, (counts.get(id) ?? 0) + 1);

  const allowed = state.allowedGenerationTokens;
  const candidates = [];
  for (let token = 0; token < logits.length; token++) {
    if (
      token === SPECIAL.BOS || token === SPECIAL.USER ||
      token === SPECIAL.ASSISTANT || token === SPECIAL.UNK ||
      (allowed && !allowed.has(token))
    ) continue;

    let score = Number.isFinite(logits[token]) ? logits[token] : -1e9;
    const count = counts.get(token) ?? 0;
    if (count && token !== SPECIAL.EOS) {
      score = score >= 0
        ? score / settings.repetitionPenalty
        : score * settings.repetitionPenalty;
      score -= settings.presencePenalty + settings.frequencyPenalty * count;
    }
    candidates.push({ token, score: score / settings.temperature });
  }
  if (!candidates.length) return SPECIAL.EOS;

  candidates.sort((a, b) => b.score - a.score);
  const top = settings.topK > 0 ? candidates.slice(0, settings.topK) : candidates;
  const maxScore = top[0].score;
  const weights = top.map(({ score }) => Math.exp(score - maxScore));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const nucleus = [];
  let cumulative = 0;
  for (let i = 0; i < top.length; i++) {
    const probability = weights[i] / total;
    nucleus.push({ token: top[i].token, weight: probability });
    cumulative += probability;
    if (cumulative >= settings.topP) break;
  }

  let draw = Math.random() * nucleus.reduce((sum, item) => sum + item.weight, 0);
  for (const item of nucleus) {
    draw -= item.weight;
    if (draw <= 0) return item.token;
  }
  return nucleus[nucleus.length - 1].token;
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function showThinking() {
  if (typeof document === "undefined") return () => {};
  let element = document.getElementById("ai-thinking");
  let created = false;
  if (!element) {
    element = document.createElement("div");
    element.id = "ai-thinking";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    document.body.appendChild(element);
    created = true;
  }
  element.hidden = false;
  let step = 0;
  element.textContent = "Thinking";
  const timer = setInterval(() => {
    step = (step + 1) % 4;
    element.textContent = `Thinking${".".repeat(step)}`;
  }, 400);
  return () => {
    clearInterval(timer);
    element.hidden = true;
    element.textContent = "";
    if (created) element.remove();
  };
}

function moderationReply(text, username) {
  const clean = normalizeForModeration(text);
  if (matchesWholeTerm(clean, NEE_POPUP_KEYWORDS)) {
    return `I’m sorry you’re going through a tough time, ${username}. Call or text 988, or visit 988lifeline.org. If there is immediate danger, call 911.`;
  }
  if (matchesWholeTerm(clean, ILLEGAL_TERMS)) {
    return "[SYSTEM NOTICE]: Request aborted because it matched a restricted term.";
  }
  if (matchesWholeTerm(clean, PROFANITY_TERMS)) {
    return "[MODERATION NOTICE]: Please keep the conversation civil.";
  }
  return null;
}

/**
 * Main inference entry point. Accepts a plain query string or a request object:
 * { query, context: { text }, plan, generation, signal }.
 *
 * `plan` is a browser-provided hint, not trusted authorization. Enforce paid
 * plans on a trusted backend before exposing paid limits in a public product.
 */
export async function receiveRequest(input) {
  if (mode === 0) return "System offline.";

  const request = resolveRequest(input);
  const query = request.query.trim();
  if (!query) return "Please enter a message.";

  const username = String(globalThis.currentUsername ?? "user");
  const blocked = moderationReply(query, username);
  if (blocked) return blocked;

  const mood = inferMood(query);
  const requestedPlan = String(request.plan ?? "free").toLowerCase();
const plan = requestedPlan === "owner"
  ? "max"
  : Object.hasOwn(TIER_LIMITS, requestedPlan)
    ? requestedPlan
    : "free";
  const limits = TIER_LIMITS[plan];
  const generation = request.generation;
  const maxOutputTokens = Math.max(1, Math.min(
    limits.maxOutputTokens,
    Number.isFinite(Number(generation.maxOutputTokens))
      ? Math.floor(Number(generation.maxOutputTokens))
      : limits.maxOutputTokens
  ));
  const maxThinkTimeMs = Math.max(1, Math.min(
    limits.maxThinkTimeMs,
    Number.isFinite(Number(generation.maxThinkTimeMs))
      ? Number(generation.maxThinkTimeMs)
      : limits.maxThinkTimeMs
  ));
  const settings = {
    temperature: Math.min(2, Math.max(0.05, Number(generation.temperature) || 0.7)),
    topK: Math.max(0, Math.floor(Number(generation.topK) || 40)),
    topP: Math.min(1, Math.max(0.01, Number(generation.topP) || 0.95)),
    repetitionPenalty: Math.min(2, Math.max(1, Number(generation.repetitionPenalty) || 1.1)),
    presencePenalty: Math.max(0, Number(generation.presencePenalty) || 0),
    frequencyPenalty: Math.max(0, Number(generation.frequencyPenalty) || 0)
  };

  const stopThinking = showThinking();
  const deadline = Date.now() + maxThinkTimeMs;
  try {
    const state = await loadModel();
    if (request.signal?.aborted) throw new Error("Request was cancelled.");
    if (Date.now() >= deadline) throw new Error("Maximum thinking time reached while loading the model.");

    const memory = truncateToTokens(request.context, state.tokenizer, limits.memoryTokens);
    const prompt = [
      `User mood: ${mood}.`,
      memory ? `Recent conversation context (use only if helpful):\n${memory}` : "",
      `for web ${webguide}`,
      `User: ${query}`
    ].filter(Boolean).join("\n\n");

    const promptIds = tokenizerEncode(prompt, state.tokenizer);
    const maxContext = state.architecture.maxContext;
    const contextIds = [
      SPECIAL.BOS,
      SPECIAL.USER,
      ...promptIds.slice(-(maxContext - 3)),
      SPECIAL.ASSISTANT
    ];
    const generated = [];

    for (let step = 0; step < maxOutputTokens; step++) {
      if (request.signal?.aborted) throw new Error("Request was cancelled.");
      if (Date.now() >= deadline) break;

      const token = sampleToken(state, contextIds, generated, settings);
      if (token === SPECIAL.EOS) break;
      generated.push(token);
      contextIds.push(token);
      if (contextIds.length > maxContext) contextIds.shift();
      await yieldToBrowser();
    }

    const answer = tokenizerDecode(generated, state.tokenizer).trim();
    return answer || "I couldn't generate a response for that prompt.";
  } catch (error) {
    console.error("GrapeGreen model inference failed:", error);
    return `[GRAPE AI ERROR]: ${error.message || "Model inference failed."}`;
  } finally {
    stopThinking();
  }
}

// Preserve the prior default mode and make the inference API available to
// callers that import this file as an ES module.
const CORS_PROXY_URL = "https://corsproxy.io/";

async function fetchJsonWithFallback(targetUrl) {
  const target = targetUrl.toString();
  const proxyUrl = new URL(CORS_PROXY_URL);
  proxyUrl.searchParams.set("url", target);

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy request failed: HTTP ${response.status}`);
    }
    return await response.json();
  } catch (proxyError) {
    try {
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`Direct request failed: HTTP ${response.status}`);
      }
      return await response.json();
    } catch (directError) {
      throw new AggregateError(
        [proxyError, directError],
        "Both the proxy and direct requests failed. The service may be unavailable or block browser requests."
      );
    }
  }
}

export function CurTime() {
  return new Date().toLocaleTimeString();
}

export function CurDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function WikiSearch(article_name) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "opensearch",
    format: "json",
    origin: "*",
    limit: "10",
    search: String(article_name ?? "")
  });

  const [query, titles = [], descriptions = [], urls = []] =
    await fetchJsonWithFallback(url);

  return titles.map((title, index) => ({
    title,
    description: descriptions[index] ?? "",
    url: urls[index] ?? "",
    query
  }));
}

export async function DDGsearch(search) {
  const url = new URL("https://api.duckduckgo.com/");
  url.search = new URLSearchParams({
    q: String(search ?? ""),
    format: "json",
    no_html: "1",
    skip_disambig: "1"
  });

  const data = await fetchJsonWithFallback(url);

  return {
    heading: data.Heading ?? "",
    answer: data.Answer ?? "",
    abstract: data.AbstractText ?? "",
    abstractUrl: data.AbstractURL ?? "",
    relatedTopics: data.RelatedTopics ?? []
  };
}

// Uses GDELT, which does not require an API key.
// date must be YYYY-MM-DD and is interpreted as a UTC date.
export async function NewsSearch(article, date = CurDate()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (!match) {
    throw new Error("date must be in YYYY-MM-DD format");
  }

  const [, year, month, day] = match;
  const start = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day)
  ));

  if (
    start.getUTCFullYear() !== Number(year) ||
    start.getUTCMonth() !== Number(month) - 1 ||
    start.getUTCDate() !== Number(day)
  ) {
    throw new Error("date is not a valid calendar date");
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const formatGdeltDate = (value) =>
    value.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.search = new URLSearchParams({
    query: String(article ?? ""),
    mode: "ArtList",
    format: "json",
    maxrecords: "25",
    sort: "DateDesc",
    startdatetime: formatGdeltDate(start),
    enddatetime: formatGdeltDate(end)
  });

  const data = await fetchJsonWithFallback(url);

  return (data.articles ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    date: item.seendate ?? "",
    source: item.domain ?? ""
  }));
}

// Safely evaluates arithmetic without eval() or Function().
// Supports +, -, *, /, %, ^, parentheses, decimals, and unary +/−.
export function MathCalculate(expression) {
  const input = String(expression ?? "").trim();
  if (!input) {
    throw new Error("Enter a math expression.");
  }

  const compact = input.replace(/\s+/g, "");
  const tokens =
    compact.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/%^]/g) ?? [];

  if (tokens.join("") !== compact) {
    throw new Error("Expression contains unsupported characters.");
  }

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  function parsePrimary() {
    const token = take();

    if (token === "(") {
      const value = parseAdditive();
      if (take() !== ")") {
        throw new Error("Missing closing parenthesis.");
      }
      return value;
    }

    if (token === undefined || !/^(?:\d|\.)/.test(token)) {
      throw new Error("Expected a number.");
    }

    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new Error("Number is out of range.");
    }
    return value;
  }

  function parsePower() {
    const left = parsePrimary();
    if (peek() === "^") {
      take();
      return left ** parseUnary();
    }
    return left;
  }

  function parseUnary() {
    if (peek() === "+") {
      take();
      return parseUnary();
    }
    if (peek() === "-") {
      take();
      return -parseUnary();
    }
    return parsePower();
  }

  function parseMultiplicative() {
    let value = parseUnary();

    while (["*", "/", "%"].includes(peek())) {
      const operator = take();
      const right = parseUnary();

      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("Cannot divide by zero.");
      }

      if (operator === "*") value *= right;
      else if (operator === "/") value /= right;
      else value %= right;
    }

    return value;
  }

  function parseAdditive() {
    let value = parseMultiplicative();

    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  const result = parseAdditive();

  if (index !== tokens.length) {
    throw new Error(`Unexpected token: ${peek()}`);
  }
  if (!Number.isFinite(result)) {
    throw new Error("Result is not a finite number.");
  }

  return result;
}
export default receiveRequest;
