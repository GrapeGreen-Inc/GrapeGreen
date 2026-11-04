/**
 * @license
 * Copyright 2026 Grape AI
 * All Core Application State Logic and Cryptographic Systems Verified.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// ==========================================================================
// 1. FIREBASE SETUP CONFIGURATION
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC1U_R5oyruWiEFYVIjGS8bezsXizbGFos",
  authDomain: "grape-ai-grapegreen.firebaseapp.com",
  databaseURL: "https://grape-ai-grapegreen-default-rtdb.firebaseio.com",
  projectId: "grape-ai-grapegreen",
  storageBucket: "grape-ai-grapegreen.firebasestorage.app",
  messagingSenderId: "795782941580",
  appId: "1:795782941580:web:e149993e9714e0c430e4a9",
  measurementId: "G-N5QJYR2J33"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// ==========================================================================
// 2. CHAT PARAMETERS & STATE SYSTEM
// ==========================================================================
const history = [];
let parameters = [""]; /* how params work in this field you put 8bit int thingys like [-.00000000] or [+.00000000] and stuff idk. */
const hyperparameters = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
  candidateCount: 1,
  presencePenalty: 0.0,
  frequencyPenalty: 0.0
};
let Grape_Api_Prompt = ""; // 🗄️ This will hold your raw metadata/response globally
const parameterSettings = ["mood", "intent", "context", "target", "empathy", "persona"];
const moods = ["happy", "sad", "angry", "scared", "flirty", "neutral", "disguised", "anxious"];
const tiers = ["free", "plus", "pro", "max", "owner"];
const BadCussWords = ["pussy", "nigger", "nigga", "fuck", "dick", "cock", "bitch", "ass", "asshole", "shit", "crap", "whore"];
const IllegialStuff = ["hack", "murder", "rape", "theft"];
const NEE_popup_keywords = [
  "suiside",
  "suicide",
  "kill myself",
  "end my life",
  "self harm",
  "cutting myself",
  "want to die"
];

const ownerName = "MattyGrapeGreenOwner";
let currentUsername = "user";
let NEE_response = `i know you are going thru a tough time ${currentUsername} and you deserve support call or text 988 or go to thier site at 988lifeline.org if its serious call 911 im here for you.`;

let currentQuery = "";
let currentResponse = "";
let nlpDecodedOutput = "";
let currentMood = "neutral";

// FEATURE FLAG CONTROLLER:
// 0 = Block responses with WIP warning message
// 1 = Allow active internal NLP and simulation logic outputs
let READY = 0;

const CRYPTO_KEY_1 = "GrapeKeyAlpha99xTrueShield";
const CRYPTO_KEY_2 = "GrapeKeyBeta44yVanguardNode";
const CRYPTO_KEY_3 = "GrapeKeyGamma11zUltimateGate";

let activeUserSession = null;
let activeUserPlan = "free";

// ==========================================================================
// 3. SAFE DOM & STATE HELPERS
// ==========================================================================
function safeGetElement(id) {
  return document.getElementById(id) || null;
}

function updateNotification(message, type = "") {
  const box = safeGetElement("notification-box");
  if (!box) return;
  box.className = (type || "").trim();
  box.style.display = message ? "block" : "none";
  box.innerText = message || "";
}

function setActiveForm(mode) {
  const loginForm = safeGetElement("login-form");
  const signupForm = safeGetElement("signup-form");
  const loginButton = safeGetElement("show-login-btn");
  const signupButton = safeGetElement("show-signup-btn");

  if (!loginForm || !signupForm || !loginButton || !signupButton) return;

  if (mode === "login") {
    loginButton.classList.add("active");
    signupButton.classList.remove("active");
    loginForm.classList.add("active");
    signupForm.classList.remove("active");
  } else {
    signupButton.classList.add("active");
    loginButton.classList.remove("active");
    signupForm.classList.add("active");
    loginForm.classList.remove("active");
  }
}

function setAuthOverlayHidden(isHidden) {
  const overlay = safeGetElement("auth-overlay");
  if (!overlay) return;
  if (isHidden) overlay.classList.add("hidden");
  else overlay.classList.remove("hidden");
}

function updateUIUsernameDisplay(name) {
  const el = safeGetElement("username-display");
  if (el) el.innerText = name || "Guest User";
}

function updateUITierDisplay() {
  const el = safeGetElement("tier-badge");
  if (!el) return;
  const safeTier = String(activeUserPlan || "free").toUpperCase();
  el.innerText = safeTier + " Plan";
}

function updateActivePlanUIMarkers(tierName) {
  const searchKey = "plan-" + String(tierName || "free").toLowerCase();
  const allPlanCards = document.querySelectorAll(".tier-card");
  allPlanCards.forEach((card) => {
    card.classList.remove("active");
    if (card.id === searchKey) {
      card.classList.add("active");
    }
  });
}

function isGuestSession(sessionValue) {
  return !!sessionValue && String(sessionValue).startsWith("guest_");
}

function loadGuestChats() {
  try {
    const stored = JSON.parse(localStorage.getItem("grape_guest_chats") || "[]");
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch (error) {
    console.warn("Guest chat cache could not be loaded.", error);
  }

  return [{ id: "guest_chat_1", title: "Guest Chat" }];
}

function saveGuestChats() {
  if (!isGuestSession(activeUserSession)) return;

  try {
    localStorage.setItem("grape_guest_chats", JSON.stringify(globalWorkspaceChatList));
  } catch (error) {
    console.warn("Guest chat cache could not be saved.", error);
  }
}

function activateGuestMode() {
  currentUsername = "Guest User";
  activeUserSession = "guest_" + Date.now();
  activeUserPlan = "free";

  updateUIUsernameDisplay(currentUsername);
  updateUITierDisplay();
  updateActivePlanUIMarkers(activeUserPlan);

  const authOverlay = safeGetElement("auth-overlay");
  if (authOverlay) {
    authOverlay.style.display = "none";
  }

  globalWorkspaceChatList = loadGuestChats();
  if (!globalWorkspaceChatList.length) {
    globalWorkspaceChatList = [{ id: "guest_chat_1", title: "Guest Chat" }];
  }

  focusActiveChatId = globalWorkspaceChatList[0].id;

  const activeChatTitle = safeGetElement("active-chat-title");
  if (activeChatTitle) activeChatTitle.innerText = globalWorkspaceChatList[0].title;

  renderWorkspaceChatsList();
  return activeUserSession;
}

// ==========================================================================
// 4. AUTO PARAM LOADING
// ==========================================================================
// Add this or replace your old loader inside dashboard/site/Grape_Ai/SLM.js

async function autoLoadAIParameters() {
  try {
    const response = await fetch("./params.txt");
    if (!response.ok) throw new Error("Local params.txt file could not be read.");

    const textData = await response.text();
    
    // Split lines, clean up whitespace, and strip empty space fragments
    const parsedLines = textData
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (parsedLines.length > 0) {
      // 1. Establish the count size based on what was found in the file
      const foundCount = parsedLines.length;
      
      // 2. Initialize a dedicated fast float array matching your 30K layer design targets
      window.GrapeSLMEngine.numParameters = foundCount;
      window.GrapeSLMEngine.weights = new Float32Array(foundCount);
      
      // 3. Loop through and parse each string row into raw float matrix elements ([+.00000000])
      for (let i = 0; i < foundCount; i++) {
        const val = parseFloat(parsedLines[i]);
        // Fallback to a tiny random weight bias if a line isn't a valid decimal value number
        window.GrapeSLMEngine.weights[i] = isNaN(val) ? (Math.random() - 0.5) : val;
      }
      
      console.log(`✅ Successfully loaded ${foundCount} parameter weights from params.txt straight into SLM engine memory profile!`);
    } else {
      console.warn("⚠️ Your local params.txt was successfully read but appears to be completely empty. Defaulting to randomized weight biases mapping.");
    }
  } catch (error) {
    console.error("❌ Failed to automatically stream local parameters configuration:", error);
    // Maintain random initialization if file loading drops so your engine compute calls don't crash
  }
}

// Fire the loader automatically on dashboard startup initialization passes
autoLoadAIParameters();


// ==========================================================================
// 5. CRYPTOGRAPHIC PIPELINE ENGINE
// ==========================================================================
function runCipherLayer(text, key, invert = false) {
  let keySum = 0;
  for (let i = 0; i < key.length; i++) {
    keySum += key.charCodeAt(i);
  }
  const shiftAmount = (keySum % 128) + 1;
  let finalOutput = "";

  for (let i = 0; i < text.length; i++) {
    let charCode = text.charCodeAt(i);
    if (!invert) {
      charCode = (charCode + shiftAmount) ^ (i % 5);
    } else {
      charCode = (charCode ^ (i % 5)) - shiftAmount;
    }
    finalOutput += String.fromCharCode(charCode);
  }
  return finalOutput;
}

function stringToBase16(str) {
  let hexadecimalResult = "";
  for (let i = 0; i < str.length; i++) {
    hexadecimalResult += str.charCodeAt(i).toString(16).padStart(4, "0");
  }
  return hexadecimalResult;
}

function base16ToString(hex) {
  let characterResult = "";
  for (let i = 0; i < hex.length; i += 4) {
    const rawValue = parseInt(hex.substr(i, 4), 16);
    characterResult += String.fromCharCode(rawValue);
  }
  return characterResult;
}

function encodeSecurePipeline(plainText) {
  if (!plainText) return "";
  const layer1Base64 = btoa(encodeURIComponent(plainText));
  const layer2Cipher = runCipherLayer(layer1Base64, CRYPTO_KEY_1, false);
  const layer3Cipher = runCipherLayer(layer2Cipher, CRYPTO_KEY_2, false);
  const layer4Cipher = runCipherLayer(layer3Cipher, CRYPTO_KEY_3, false);
  return stringToBase16(layer4Cipher);
}

function decodeSecurePipeline(cipherText) {
  if (!cipherText) return "";
  try {
    const layer4Cipher = base16ToString(cipherText);
    const layer3Cipher = runCipherLayer(layer4Cipher, CRYPTO_KEY_3, true);
    const layer2Cipher = runCipherLayer(layer3Cipher, CRYPTO_KEY_2, true);
    const layer1Base64 = runCipherLayer(layer2Cipher, CRYPTO_KEY_1, true);
    return decodeURIComponent(atob(layer1Base64));
  } catch (error) {
    console.error("Secure tracking pipeline encountered a breakdown:", error);
    return "[Secure Decryption Mismatch]";
  }
}

// ==========================================================================
// 6. NATURAL LANGUAGE PROCESSING (NLP) & MOOD UTILITIES
// ==========================================================================
function fetchCurrentTimestampString() {
  const currentMoment = new Date();
  return currentMoment.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function calculateContextMood(text) {
  const checkString = String(text || "").toLowerCase();

  const angerKeywords = ["angry", "mad", "hate", "annoyed", "stupid", "idiot", "trash", "broken"];
  const sadKeywords = ["sad", "cry", "hurt", "lonely", "bad", "depressed", "sorry", "unhappy"];
  const happyKeywords = ["happy", "good", "great", "love", "awesome", "cool", "nice", "glad", "yes"];
  const scaredKeywords = ["scared", "afraid", "panic", "worry", "creepy", "nervous", "shocked"];
  const flirtyKeywords = ["flirty", "cute", "wink", "hot", "date", "beautiful", "gorgeous", "sweetheart"];
  const anxiousKeywords = ["anxious", "scared", "stressed", "tense", "uneasy"];

  if (angerKeywords.some((keyword) => checkString.includes(keyword))) return "angry";
  if (sadKeywords.some((keyword) => checkString.includes(keyword))) return "sad";
  if (happyKeywords.some((keyword) => checkString.includes(keyword))) return "happy";
  if (scaredKeywords.some((keyword) => checkString.includes(keyword))) return "scared";
  if (flirtyKeywords.some((keyword) => checkString.includes(keyword))) return "flirty";
  if (anxiousKeywords.some((keyword) => checkString.includes(keyword))) return "anxious";

  return "neutral";
}

function processNLPDecode(userInputString) {
  if (!userInputString) {
    nlpDecodedOutput = "";
    return [];
  }

  let workingString = String(userInputString).trim();

  workingString = workingString
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const leetDictionary = {
    4: "a",
    "@": "a",
    8: "b",
    3: "e",
    9: "g",
    1: "l",
    "!": "l",
    0: "o",
    5: "s",
    "$": "s",
    7: "t",
    "+": "t",
    2: "z"
  };

  let normalized = workingString.toLowerCase();
  const parts = normalized.split(/\s+/);
  const transformed = parts.map((word) => {
    if (!word) return word;
    let leetCount = 0;
    for (const ch of word) {
      if (leetDictionary[ch]) leetCount++;
    }
    const leetDensity = leetCount / word.length;
    if (leetDensity >= 0.4) {
      return word.split("").map((ch) => leetDictionary[ch] || ch).join("");
    }
    return word;
  });

  let sanitizedString = transformed.join(" ");

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
  sanitizedString = sanitizedString.replace(emojiRegex, (matchingEmoji) => {
    const hexRepresentation = matchingEmoji.codePointAt(0).toString(16).toUpperCase();
    return ` uhex${hexRepresentation} `;
  });

  sanitizedString = sanitizedString.replace(/[^a-z0-9\s]/g, "");
  nlpDecodedOutput = sanitizedString.replace(/\s+/g, " ").trim();

  const stringWordTokens = nlpDecodedOutput.split(/\s+/).filter((token) => token.length > 0);
  const tokenizedNumericOutputArray = stringWordTokens.map((word) => {
    let characterValueSum = 0;
    for (let i = 0; i < word.length; i++) {
      characterValueSum += word.charCodeAt(i) * (i + 1);
    }
    return characterValueSum;
  });

  const scoreMatrix = {
    happy: 0,
    sad: 0,
    angry: 0,
    scared: 0,
    flirty: 0,
    anxious: 0
  };

  stringWordTokens.forEach((word) => {
    if (["happy", "good", "great", "love", "awesome", "cool", "nice", "glad", "yes"].includes(word)) scoreMatrix.happy += 1;
    if (["sad", "cry", "hurt", "lonely", "bad", "depressed", "sorry", "unhappy"].includes(word)) scoreMatrix.sad += 1;
    if (["angry", "mad", "hate", "annoyed", "stupid", "idiot", "trash", "broken"].includes(word)) scoreMatrix.angry += 1;
    if (["scared", "afraid", "panic", "worry", "creepy", "nervous", "shocked"].includes(word)) scoreMatrix.scared += 1;
    if (["flirty", "cute", "wink", "hot", "date", "beautiful", "gorgeous", "sweetheart"].includes(word)) scoreMatrix.flirty += 1;
    if (["anxious", "stressed", "tense", "uneasy"].includes(word)) scoreMatrix.anxious += 1;
  });

  let winner = "neutral";
  let highestScore = 0;
  Object.entries(scoreMatrix).forEach(([moodName, score]) => {
    if (score > highestScore) {
      highestScore = score;
      winner = moodName;
    }
  });

  currentMood = winner;
  return tokenizedNumericOutputArray;
}

// ==========================================================================
// 7. CORE COGNITIVE WORK IN PROGRESS AI ENGINE
// ==========================================================================
async function AiBrainFunction(inputPromptString, historicalMemorySummaryText = "") {
  const inputText = String(inputPromptString ?? "").trim();
  if (!inputText) return "Please enter a message.";

  const normalizeForModeration = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const cleanInput = normalizeForModeration(inputText);
  const username =
    typeof currentUsername !== "undefined" && currentUsername
      ? String(currentUsername)
      : "user";

  const matchesAny = (terms) =>
    Array.isArray(terms) &&
    terms.some((term) => {
      const normalizedTerm = normalizeForModeration(term);
      return normalizedTerm && ` ${cleanInput} `.includes(` ${normalizedTerm} `);
    });

  if (
    typeof NEE_popup_keywords !== "undefined" &&
    matchesAny(NEE_popup_keywords)
  ) {
    return `I’m sorry you’re going through a tough time, ${username}. Call or text 988, or visit 988lifeline.org. If there is immediate danger, call 911.`;
  }

  if (
    typeof IllegialStuff !== "undefined" &&
    matchesAny(IllegialStuff)
  ) {
    return "[SYSTEM NOTICE]: Request aborted because it matched a restricted term.";
  }

  if (
    typeof BadCussWords !== "undefined" &&
    matchesAny(BadCussWords)
  ) {
    return "[MODERATION NOTICE]: Please keep the conversation civil.";
  }

  const tierValue =
    typeof currentUserTier !== "undefined"
      ? currentUserTier
      : typeof userPlan !== "undefined"
        ? userPlan
        : "free";

  const tier = String(tierValue).toLowerCase();

  const tierLimits = {
    free: { maxOutputTokens: 150, memoryTokens: 800, maxThinkTimeMs: 11000 },
    plus: { maxOutputTokens: 200, memoryTokens: 950, maxThinkTimeMs: 17000 },
    pro: { maxOutputTokens: 250, memoryTokens: 1150, maxThinkTimeMs: 24000 },
    max: { maxOutputTokens: 300, memoryTokens: 1300, maxThinkTimeMs: 35000 }
  };

  const limits = tierLimits[tier] ?? tierLimits.free;

  // This is an approximate whitespace-token cap. API.js should enforce the
  // actual limit with the model's tokenizer.
  const contextWords =
    String(historicalMemorySummaryText ?? "").match(/\S+/gu) ?? [];
  const memoryContext = contextWords
    .slice(-limits.memoryTokens)
    .join(" ");

  const moodSignals = [
    {
      label: "distressed",
      pattern: /\b(overwhelmed|hopeless|terrified|panicking|devastated|miserable|can't cope|cannot cope)\b/i
    },
    {
      label: "sad",
      pattern: /\b(sad|lonely|grieving|heartbroken|down|depressed)\b/i
    },
    {
      label: "angry",
      pattern: /\b(angry|furious|pissed|irritated|frustrated)\b/i
    },
    {
      label: "anxious",
      pattern: /\b(anxious|worried|nervous|scared|afraid|stressed)\b/i
    },
    {
      label: "happy",
      pattern: /\b(happy|great|excited|wonderful|thrilled|glad)\b/i
    }
  ];

  const moodMatch = moodSignals.find(({ pattern }) => pattern.test(inputText));
  const mood = {
    label: moodMatch?.label ?? "unknown",
    confidence: "low",
    source: "text_heuristic"
  };

  let thinkingElement = document.getElementById("ai-thinking");
  let createdThinkingElement = false;

  if (!thinkingElement) {
    thinkingElement = document.createElement("div");
    thinkingElement.id = "ai-thinking";
    thinkingElement.setAttribute("role", "status");
    thinkingElement.setAttribute("aria-live", "polite");
    document.body.appendChild(thinkingElement);
    createdThinkingElement = true;
  }

  let animationStep = 0;
  thinkingElement.hidden = false;
  thinkingElement.textContent = "Thinking";

  const animationTimer = window.setInterval(() => {
    animationStep = (animationStep + 1) % 4;
    thinkingElement.textContent = `Thinking${".".repeat(animationStep)}`;
  }, 400);

  const controller = new AbortController();
  let timeoutId;

  try {
    // This loads the API module by its source path; it does not make an HTTP
    // API request. Update this path if the deployed site uses a different root.
    const apiModuleSrc = "/dashboard/site/Grape_Ai/API.js";
    const apiModule = await import(apiModuleSrc);

    if (typeof apiModule.receiveRequest !== "function") {
      throw new Error("API.js must export a receiveRequest() function.");
    }

    const request = {
      query: inputText,
      mood,
      context: {
        text: memoryContext,
        tokenLimit: limits.memoryTokens,
        policy: "optional_use_if_helpful"
      },
      generation: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxOutputTokens: limits.maxOutputTokens,
        maxThinkTimeMs: limits.maxThinkTimeMs
      },
      plan: tier,
      signal: controller.signal
    };

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        controller.abort();
        reject(new Error("The AI reached its maximum thinking time."));
      }, limits.maxThinkTimeMs);
    });

    const result = await Promise.race([
      apiModule.receiveRequest(request),
      timeoutPromise
    ]);

    if (typeof result === "string") return result;
    if (typeof result?.response === "string") return result.response;
    if (typeof result?.text === "string") return result.text;

    throw new Error("API.js returned no response text.");
  } catch (error) {
    console.error("AI module request failed:", error);
    return `[GRAPE AI ERROR]: ${error.message || "The request could not be completed."}`;
  } finally {
    window.clearInterval(animationTimer);
    window.clearTimeout(timeoutId);
    thinkingElement.hidden = true;
    thinkingElement.textContent = "";

    if (createdThinkingElement) thinkingElement.remove();
  }
}



// ==========================================================================
// 8. SIGNUP & DATABASE MANAGEMENT FUNCTIONS
// ==========================================================================
async function triggerSecureSignup(username, email, dateOfBirth, password) {
  const alertContainer = safeGetElement("notification-box");
  if (!alertContainer) return;

  alertContainer.className = "";
  alertContainer.style.display = "none";

  try {
    const checkedAccountRef = doc(db, "Ai-Users", username);
    const checkingSnapshot = await getDoc(checkedAccountRef);

    if (checkingSnapshot.exists()) {
      alertContainer.innerText = "This username is already taken. Please pick another one.";
      alertContainer.className = "error";
      alertContainer.style.display = "block";
      return;
    }

    const doubleEncryptedPassword = encodeSecurePipeline(password);
    const doubleEncryptedEmail = encodeSecurePipeline(email);
    const doubleEncryptedDOB = encodeSecurePipeline(dateOfBirth);

    let assignedUserTier = "free";
    if (username === ownerName) {
      assignedUserTier = "owner";
    }

    const newUserDocData = {
      username,
      gmail: doubleEncryptedEmail,
      dob: doubleEncryptedDOB,
      password: doubleEncryptedPassword,
      tier: assignedUserTier,
      accountCreated: fetchCurrentTimestampString()
    };

    await setDoc(doc(db, "Ai-Users", username), newUserDocData);

    alertContainer.innerText = "Account created successfully! Switching to sign in panel...";
    alertContainer.className = "success";
    alertContainer.style.display = "block";

    setTimeout(() => {
      const loginButton = safeGetElement("show-login-btn");
      if (loginButton) loginButton.click();
    }, 1500);
  } catch (error) {
    alertContainer.innerText = "Sign up sequence issue: " + error.message;
    alertContainer.className = "error";
    alertContainer.style.display = "block";
  }
}

async function processSecureLogin(username, password) {
  const alertContainer = safeGetElement("notification-box");
  if (!alertContainer) return;

  alertContainer.className = "";
  alertContainer.style.display = "none";

  try {
    const verifiedAccountRef = doc(db, "Ai-Users", username);
    const accountSnapshot = await getDoc(verifiedAccountRef);

    if (!accountSnapshot.exists()) {
      alertContainer.innerText = "Username or account record not found.";
      alertContainer.className = "error";
      alertContainer.style.display = "block";
      return;
    }

    const databaseUserData = accountSnapshot.data();
    const cleanDecodedPassword = decodeSecurePipeline(databaseUserData.password);

    if (cleanDecodedPassword !== password) {
      alertContainer.innerText = "Incorrect security password string. Please try again.";
      alertContainer.className = "error";
      alertContainer.style.display = "block";
      return;
    }

    activeUserSession = databaseUserData.username;
    activeUserPlan = databaseUserData.tier || "free";
    currentUsername = activeUserSession;
    NEE_response = `i know you are going thru a tough time ${currentUsername} and you deserve support call or text 988 or go to thier site at 988lifeline.org if its serious call 911 im here for you.`;

    const authOverlay = safeGetElement("auth-overlay");
    const usernameDisplay = safeGetElement("username-display");
    const tierBadge = safeGetElement("tier-badge");

    if (authOverlay) authOverlay.style.display = "none";
    if (usernameDisplay) usernameDisplay.innerText = activeUserSession;
    if (tierBadge) tierBadge.innerText = (activeUserPlan || "free").toUpperCase() + " Plan";

    updateActivePlanUIMarkers(activeUserPlan);
    await syncUserChatsDashboard();
  } catch (error) {
    alertContainer.innerText = "Sign in connection issue: " + error.message;
    alertContainer.className = "error";
    alertContainer.style.display = "block";
  }
}

// ==========================================================================
// 9. DASHBOARD CHAT LOGIC LAYOUT BINDINGS
// ==========================================================================
let globalWorkspaceChatList = [];
let focusActiveChatId = null;

async function syncUserChatsDashboard() {
  if (isGuestSession(activeUserSession)) {
    globalWorkspaceChatList = loadGuestChats();
    if (!globalWorkspaceChatList.length) {
      globalWorkspaceChatList = [{ id: "guest_chat_1", title: "Guest Chat" }];
    }
    focusActiveChatId = globalWorkspaceChatList[0].id;
    renderWorkspaceChatsList();
    return;
  }

  const containerSlot = safeGetElement("chats-list");
  if (!containerSlot) return;
  containerSlot.innerHTML = "";

  try {
    const queryReference = query(
      collection(db, "ai_users_history"),
      where("chatOwner", "==", activeUserSession)
    );
    const historySnapshot = await getDocs(queryReference);
    globalWorkspaceChatList = [];

    historySnapshot.forEach((chatNode) => {
      const chatNodeData = chatNode.data();
      globalWorkspaceChatList.push({
        id: chatNode.id,
        title: decodeSecurePipeline(chatNodeData.encryptedTitle) || "Encrypted Chat Node"
      });
    });

    renderWorkspaceChatsList();
  } catch (error) {
    console.warn("Firestore access restrictions. Initializing local workspace memory framework layer.", error);
    globalWorkspaceChatList = [{ id: "local_default_1", title: "Main Project Hub" }];
    renderWorkspaceChatsList();
  }
}

function renderWorkspaceChatsList() {
  const containerSlot = safeGetElement("chats-list");
  if (!containerSlot) return;
  containerSlot.innerHTML = "";

  globalWorkspaceChatList.forEach((chatItem) => {
    const isFocused = focusActiveChatId === chatItem.id;
    const itemRow = document.createElement("div");
    itemRow.className = `chat-list-item ${isFocused ? "active" : ""}`;

    itemRow.addEventListener("click", () => {
      focusActiveChatId = chatItem.id;
      const activeChatTitle = safeGetElement("active-chat-title");
      if (activeChatTitle) activeChatTitle.innerText = chatItem.title;
      renderWorkspaceChatsList();
    });

    itemRow.innerHTML = `
      <span class="chat-icon">💬</span>
      <span class="chat-item-title">${chatItem.title}</span>
      <div class="chat-item-actions">
        <button type="button" class="rename-btn" data-id="${chatItem.id}">✏️</button>
        <button type="button" class="delete-btn" data-id="${chatItem.id}">🗑️</button>
      </div>
    `;

    const renameButton = itemRow.querySelector(".rename-btn");
    const deleteButton = itemRow.querySelector(".delete-btn");

    if (renameButton) {
      renameButton.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerChatRenameAction(chatItem.id);
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerChatDeletionAction(chatItem.id);
      });
    }

    containerSlot.appendChild(itemRow);
  });
}

async function createNewChatWorkspaceNode() {
  if (isGuestSession(activeUserSession)) {
    const uniqueId = "guest_chat_" + Date.now();
    const baseTitleText = "Guest Chat " + (globalWorkspaceChatList.filter((item) => item.id.startsWith("guest_chat_")).length + 1);

    globalWorkspaceChatList.unshift({ id: uniqueId, title: baseTitleText });
    focusActiveChatId = uniqueId;
    saveGuestChats();

    const activeChatTitle = safeGetElement("active-chat-title");
    if (activeChatTitle) activeChatTitle.innerText = baseTitleText;

    renderWorkspaceChatsList();
    return;
  }

  if (!activeUserSession) return;

  const uniqueId = "chat_" + Date.now();
  const baseTitleText = "Chat Thread " + (globalWorkspaceChatList.length + 1);
  const secureTitlePayload = encodeSecurePipeline(baseTitleText);

  try {
    await setDoc(doc(db, "ai_users_history", uniqueId), {
      chatOwner: activeUserSession,
      encryptedTitle: secureTitlePayload,
      createdTimestamp: fetchCurrentTimestampString()
    });
  } catch (e) {
    console.warn("Unable to save new chat title to Firestore.", e);
  }

  globalWorkspaceChatList.unshift({ id: uniqueId, title: baseTitleText });
  focusActiveChatId = uniqueId;
  const activeChatTitle = safeGetElement("active-chat-title");
  if (activeChatTitle) activeChatTitle.innerText = baseTitleText;
  renderWorkspaceChatsList();
}

function triggerChatRenameAction(id) {
  const targetNode = globalWorkspaceChatList.find((item) => item.id === id);
  if (!targetNode) return;

  const nextTitleInput = prompt("Enter new title for this chat thread:", targetNode.title);
  if (!nextTitleInput || nextTitleInput.trim() === "") return;

  targetNode.title = nextTitleInput.trim();

  if (isGuestSession(activeUserSession)) {
    saveGuestChats();
  }

  renderWorkspaceChatsList();

  if (focusActiveChatId === id) {
    const activeChatTitle = safeGetElement("active-chat-title");
    if (activeChatTitle) activeChatTitle.innerText = targetNode.title;
  }
}

function triggerChatDeletionAction(id) {
  if (!confirm("Are you sure you want to permanently delete this chat history thread?")) return;

  globalWorkspaceChatList = globalWorkspaceChatList.filter((item) => item.id !== id);

  if (isGuestSession(activeUserSession)) {
    saveGuestChats();
  }

  if (focusActiveChatId === id) {
    focusActiveChatId = null;
    const activeChatTitle = safeGetElement("active-chat-title");
    if (activeChatTitle) activeChatTitle.innerText = "New Chat";
  }
  renderWorkspaceChatsList();
}

// ==========================================================================
// 10. MATH ENGINE
// ==========================================================================
function processTextMathEngine(textExpression) {
  let cleanText = String(textExpression || "").toLowerCase().trim();

  const mathDictionary = {
    pi: Math.PI,
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    units: 1,
    tens: 10,
    hundreds: 100,
    thousands: 1000,
    millions: 1000000,
    billions: 1000000000,
    trillions: 1000000000000,
    divided: "/",
    times: "*",
    multiply: "*",
    plus: "+",
    minus: "-",
    add: "+",
    subtract: "-",
    "greater than": ">",
    "less than": "<"
  };

  const sortedKeys = Object.keys(mathDictionary).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, "g");
    cleanText = cleanText.replace(regex, String(mathDictionary[key]));
  }

  cleanText = cleanText.replace(/[^0-9a-fA-F.+\-*/<> \(\)]/g, "").trim();

  try {
    if (cleanText === "") {
      currentResponse = 0;
      return currentResponse;
    }

    const executionOutputValue = new Function(`return (${cleanText});`)();
    currentResponse = executionOutputValue;
    console.log(`[MATH ENGINE]: "${textExpression}" -> "${cleanText}" = ${currentResponse}`);
    return currentResponse;
  } catch (error) {
    console.error(`[MATH ENGINE ERROR]: Failed to evaluate structural math string: "${cleanText}"`, error);
    currentResponse = "[MATH ENGINE EXCEPTION]: Invalid expression layout";
    return currentResponse;
  }
}

// ==========================================================================
// 11. CHAT IO & BUBBLES
// ==========================================================================
async function transmitChatMessagePayload() {
  const chatInputBox = safeGetElement("message-input");
  if (!chatInputBox) return;

  const baseMessageText = chatInputBox.value.trim();
  if (!baseMessageText) return;

  currentQuery = baseMessageText;
  appendChatBubbleDOM(currentQuery, "user-message", "User");
  chatInputBox.value = "";

  const simulatedCompressedMemorySummary = "[System memory status stable. Active session logs running.]";
  const finalCompiledBrainInputPrompt = await AiBrainFunction(
    currentQuery,
    simulatedCompressedMemorySummary
  );

  setTimeout(() => {
    if (READY === 1) {
      const nlpTokenResults = processNLPDecode(currentQuery);
      const detectedUserMood = calculateContextMood(currentQuery);
      currentResponse = `Processed text layers securely. Current timestamp verification check is [${fetchCurrentTimestampString()}]. Input clean text analyzed: "${nlpDecodedOutput}". Estimated communication flow intensity: ${nlpTokenResults.length}. Assigned mood profile: ${detectedUserMood}. Prompt trace: "${finalCompiledBrainInputPrompt}".`;
      appendChatBubbleDOM(currentResponse, "ai-message", "AI");
      history.push({ q: currentQuery, r: currentResponse, mood: detectedUserMood });
    } else {
      currentResponse = "I'm sorry but this is a work in progress at the time I do not know how to respond";
      appendChatBubbleDOM(currentResponse, "ai-message", "AI");
    }
  }, 750);
}

function appendChatBubbleDOM(text, styleClass, identityLabel) {
  const messagesScrollFrame = safeGetElement("messages-container");
  const scrollAreaFrame = safeGetElement("messages-scroll-area");
  if (!messagesScrollFrame || !scrollAreaFrame) return;

  const bubbleElement = document.createElement("div");
  bubbleElement.className = `message ${styleClass}`;

  bubbleElement.innerHTML = `
    <div class="message-avatar">${identityLabel === "AI" ? "AI" : "User"}</div>
    <div class="message-text">
      <p>${String(text || "")}</p>
    </div>
  `;

  messagesScrollFrame.appendChild(bubbleElement);
  scrollAreaFrame.scrollTop = scrollAreaFrame.scrollHeight;
}
//ai brain:
// 🚀 The background processing engine function
async function executeLocalGrapeEngine(assembledPromptString) {
  // 🛡️ Your internal error tracking message code
  const Grape_Engine_Error_Msg = "We Ran Into A Error Processing [4568]";

  // ⚙️ Production Flag (0 = Development/Testing, 1 = Live AI Active)
  const Prod_Ready = 0; 

  try {
    // =========================================================================
    // 🧠 AI LOGIC SECTION
    // Put your upcoming text processing, array scoring, or AI engine stuff here!
    // =========================================================================

    // 🔒 Safety Switch: If not production ready, immediately return the error message
    if (Prod_Ready === 0) {
      return Grape_Engine_Error_Msg;
    }

    // (Your live AI execution scripts will overwrite this placeholder later)
    let processedResult = "yo, this is your live AI generated response text!";
    return processedResult;

    // =========================================================================

  } catch (error) {
    console.error("Internal engine calculation error:", error);
    return Grape_Engine_Error_Msg; 
  }
}
// ==========================================================================
// 12. SEARCH HELPERS
// ==========================================================================
const wikiWordStorage = {};
const searchEngineStorage = {};

async function fetchWikiWord(word) {
  const cleanWord = String(word || "").trim();
  if (!cleanWord) return;

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanWord)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Word not found or API error");

    const data = await response.json();
    wikiWordStorage[cleanWord] = {
      title: data.title,
      description: data.description || "No short description available",
      snippet: data.extract || "No summary available",
      url: data.content_urls?.desktop?.page || ""
    };

    console.log(`Successfully fetched from Wiki: ${cleanWord}`);
  } catch (error) {
    console.error(`Failed to fetch wiki entry for "${cleanWord}":`, error);
    wikiWordStorage[cleanWord] = { error: "Could not retrieve definition" };
  }
}

async function searchMultiEngines(commaSeparatedInput) {
  const searchTerms = String(commaSeparatedInput || "")
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  for (const term of searchTerms) {
    console.log(`Searching across engines for: "${term}"...`);

    let ddgResult = "No direct answer found";
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&origin=*`;
      const res = await fetch(ddgUrl);
      const data = await res.json();
      ddgResult = data.AbstractText || data.RelatedTopics?.[0]?.Text || "No abstract available";
    } catch (e) {
      ddgResult = "Error connecting to DuckDuckGo";
    }

    let wikiResult = "No page found";
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;
      const res = await fetch(wikiUrl);
      const data = await res.json();
      if (data.query?.search?.[0]) {
        wikiResult = `${data.query.search[0].title}: ${data.query.search[0].snippet.replace(/<[^>]*>/g, "")}`;
      }
    } catch (e) {
      wikiResult = "Error connecting to Wikipedia";
    }

    let indexedResult = "Not found in your indexed database";
    try {
      const siteIndex = {};
      const lowerTerm = term.toLowerCase();
      if (siteIndex[lowerTerm]) {
        indexedResult = siteIndex[lowerTerm];
      }
    } catch (e) {
      indexedResult = "Error searching local index";
    }

    searchEngineStorage[term] = {
      duckduckgo: ddgResult,
      wikipedia: wikiResult,
      indexed_sites: indexedResult
    };
  }

  console.log("Multi-engine scan finished!", searchEngineStorage);
}

// ==========================================================================
// 13. INITIAL EVENT LISTENER EVENT ATTACHMENTS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const showLoginButton = safeGetElement("show-login-btn");
  const showSignupButton = safeGetElement("show-signup-btn");
  const loginForm = safeGetElement("login-form");
  const signupForm = safeGetElement("signup-form");
  const newChatButton = safeGetElement("new-chat-btn");
  const messageForm = safeGetElement("message-form");
  const userProfileTrigger = safeGetElement("user-profile-trigger");
  const closeModalButton = safeGetElement("close-modal-btn");
  const settingsModalOverlay = safeGetElement("settings-modal-overlay");
      const plansTabButton = safeGetElement("plans-tab");
  const accountTabButton = safeGetElement("account-tab");
  const plansPanel = safeGetElement("plans-panel");
  const accountPanel = safeGetElement("account-panel");
  
  const setSettingsTab = (tab) => {
    const showAccount = tab === "account";
  
    if (plansPanel) plansPanel.classList.toggle("hidden", showAccount);
    if (accountPanel) accountPanel.classList.toggle("hidden", !showAccount);
  
    if (plansTabButton) {
      plansTabButton.classList.toggle("active", !showAccount);
      plansTabButton.setAttribute("aria-selected", String(!showAccount));
    }
  
    if (accountTabButton) {
      accountTabButton.classList.toggle("active", showAccount);
      accountTabButton.setAttribute("aria-selected", String(showAccount));
    }
  
    const username = safeGetElement("settings-username");
    const plan = safeGetElement("settings-plan");
  
    if (username) username.textContent = currentUsername || "Guest User";
    if (plan) plan.textContent = `${String(activeUserPlan || "free").toUpperCase()} Plan`;
  };
  
  if (plansTabButton) {
    plansTabButton.addEventListener("click", () => setSettingsTab("plans"));
  }
  
  if (accountTabButton) {
    accountTabButton.addEventListener("click", () => setSettingsTab("account"));
  }
  const guestModeButton = safeGetElement("guest-mode-btn");

  if (!showLoginButton || !showSignupButton || !loginForm || !signupForm) {
    console.warn("Auth form elements were not found. Skipping auth bindings.");
    return;
  }

  showLoginButton.addEventListener("click", () => setActiveForm("login"));
  showSignupButton.addEventListener("click", () => setActiveForm("signup"));
  setActiveForm("login");

  if (guestModeButton) {
    guestModeButton.addEventListener("click", () => {
      activateGuestMode();
    });
  }

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = safeGetElement("su-username");
    const mailVal = safeGetElement("su-gmail");
    const dobVal = safeGetElement("su-dob");
    const passVal = safeGetElement("su-password");
    if (!userVal || !mailVal || !dobVal || !passVal) return;
    triggerSecureSignup(userVal.value.trim(), mailVal.value.trim(), dobVal.value, passVal.value);
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = safeGetElement("li-username");
    const passVal = safeGetElement("li-password");
    if (!userVal || !passVal) return;
    processSecureLogin(userVal.value.trim(), passVal.value);
  });

  const changePasswordForm = safeGetElement("change-password-form");

  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const currentInput = safeGetElement("current-ai-password");
      const newInput = safeGetElement("new-ai-password");
      const confirmInput = safeGetElement("confirm-ai-password");
      const status = safeGetElement("change-password-status");
      const button = safeGetElement("change-password-submit");
  
      if (!currentInput || !newInput || !confirmInput || !status || !button) return;
  
      const currentPassword = currentInput.value;
      const newPassword = newInput.value;
      const confirmPassword = confirmInput.value;
  
      if (!activeUserSession || isGuestSession(activeUserSession)) {
        status.textContent = "Sign in to a Grape AI account before changing its password.";
        return;
      }
  
      if (newPassword.length < 8) {
        status.textContent = "Your new password must contain at least 8 characters.";
        return;
      }
  
      if (newPassword === currentPassword) {
        status.textContent = "Choose a different password from your current one.";
        return;
      }
  
      if (newPassword !== confirmPassword) {
        status.textContent = "The new passwords do not match.";
        return;
      }
  
      button.disabled = true;
      status.textContent = "Verifying your account...";
  
      try {
        const accountRef = doc(db, "Ai-Users", activeUserSession);
        const accountSnapshot = await getDoc(accountRef);
  
        if (!accountSnapshot.exists()) {
          status.textContent = "The account record could not be found.";
          return;
        }
  
        const accountData = accountSnapshot.data();
        const storedPassword = decodeSecurePipeline(accountData.password);
  
        if (storedPassword !== currentPassword) {
          status.textContent = "Your current password is incorrect.";
          return;
        }
  
        await setDoc(
          accountRef,
          { password: encodeSecurePipeline(newPassword) },
          { merge: true }
        );
  
        changePasswordForm.reset();
        status.textContent = "Password updated successfully.";
      } catch (error) {
        console.error("Grape AI password update failed:", error);
  
        status.textContent = error.code === "permission-denied"
          ? "The database blocked this update. Contact the site maintainer."
          : "The password could not be updated. Please try again.";
      } finally {
        button.disabled = false;
      }
    });
  }
  if (newChatButton) {
    newChatButton.addEventListener("click", createNewChatWorkspaceNode);
  }

  if (messageForm) {
    messageForm.addEventListener("submit", (e) => {
      e.preventDefault();
      transmitChatMessagePayload();
    });
  }

  if (userProfileTrigger) {
    userProfileTrigger.addEventListener("click", () => {
      setSettingsTab("plans");
      const overlay = safeGetElement("settings-modal-overlay");
      if (overlay) overlay.classList.remove("hidden");
    });
  }

  if (closeModalButton && settingsModalOverlay) {
    closeModalButton.addEventListener("click", () => {
      settingsModalOverlay.classList.add("hidden");
    });

    settingsModalOverlay.addEventListener("click", (e) => {
      if (e.target === settingsModalOverlay) {
        settingsModalOverlay.classList.add("hidden");
      }
    });

    settingsModalOverlay.classList.add("hidden");
  }

  const activeChatTitle = safeGetElement("active-chat-title");
  if (activeChatTitle) activeChatTitle.innerText = "New Chat";

  updateUIUsernameDisplay(currentUsername);
  updateUITierDisplay();
  updateActivePlanUIMarkers(activeUserPlan);
});

// ==========================================================================
// 14. PRESERVATION BLOCKS, COMPATIBILITY HELPERS, AND LEGACY NOTES
// ==========================================================================
const stateMeta = {
  version: "2026.10.22",
  mode: "dashboard-ui",
  agent: "grape-ai-core",
  assistantName: "Grape AI",
  memory: "browser-session"
};

const UIStatusLegend = {
  idle: "Waiting for input",
  thinking: "Processing",
  ready: "Ready",
  error: "Error",
  blocked: "Blocked by policy"
};

const localProcessingFlags = {
  safeMode: true,
  allowFallbackMessages: true,
  debugMode: false,
  featureOverride: READY
};

const systemMessageBlocks = [
  "Secure chat channel active.",
  "UI state initialized.",
  "Local processing layer ready.",
  "Background memory stack stable.",
  "Dashboard controls loaded.",
  "Firebase integration initialized.",
  "Safe fallback text enabled."
];

function gatherSystemMessageSummary() {
  return systemMessageBlocks.join(" ");
}

function logSystemHealth() {
  console.log("System health summary:", gatherSystemMessageSummary());
}

logSystemHealth();

const memoryCacheBucket = {
  lastQuery: "",
  lastResponse: "",
  recentMoods: [],
  recentQueries: [],
  recentResponses: []
};

function snapshotMemoryState() {
  memoryCacheBucket.lastQuery = currentQuery;
  memoryCacheBucket.lastResponse = currentResponse;
  memoryCacheBucket.recentMoods.push(currentMood);
  memoryCacheBucket.recentQueries.push(currentQuery);
  memoryCacheBucket.recentResponses.push(currentResponse);

  if (memoryCacheBucket.recentMoods.length > 12) memoryCacheBucket.recentMoods.shift();
  if (memoryCacheBucket.recentQueries.length > 12) memoryCacheBucket.recentQueries.shift();
  if (memoryCacheBucket.recentResponses.length > 12) memoryCacheBucket.recentResponses.shift();
}

function clearMemorySnapshot() {
  memoryCacheBucket.lastQuery = "";
  memoryCacheBucket.lastResponse = "";
  memoryCacheBucket.recentMoods = [];
  memoryCacheBucket.recentQueries = [];
  memoryCacheBucket.recentResponses = [];
}

function ensureDashboardReady() {
  return Boolean(document && document.readyState !== "loading");
}

function safeRenderMessage(text, sender = "AI") {
  const safeText = String(text || "");
  appendChatBubbleDOM(safeText, sender === "AI" ? "ai-message" : "user-message", sender);
}

const noiseReductionMap = {
  "\n": " ",
  "\r": " ",
  "\t": " "
};

function normalizeInputText(value) {
  let result = String(value || "");
  Object.entries(noiseReductionMap).forEach(([key, replacement]) => {
    result = result.split(key).join(replacement);
  });
  return result.replace(/\s+/g, " ").trim();
}

const trackingChannels = {
  userSession: activeUserSession,
  plan: activeUserPlan,
  currentUsername,
  currentMood,
  query: currentQuery,
  response: currentResponse
};

function refreshTrackingChannels() {
  trackingChannels.userSession = activeUserSession;
  trackingChannels.plan = activeUserPlan;
  trackingChannels.currentUsername = currentUsername;
  trackingChannels.currentMood = currentMood;
  trackingChannels.query = currentQuery;
  trackingChannels.response = currentResponse;
}

function initializeRuntimeState() {
  refreshTrackingChannels();
  if (typeof window !== "undefined") {
    window.GrapeAIState = trackingChannels;
  }
}

initializeRuntimeState();

// ---------------------------------------------------------------------
// END OF FILE
// ---------------------------------------------------------------------
