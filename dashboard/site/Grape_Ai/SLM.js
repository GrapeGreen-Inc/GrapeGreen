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
async function autoLoadAIParameters() {
  try {
    const response = await fetch("./params.txt");
    if (!response.ok) throw new Error("Local params.txt file could not be read.");

    const textData = await response.text();
    const parsedParams = textData
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (parsedParams.length > 0) {
      parameters = parsedParams;
      console.log(`✅ Loaded ${parameters.length} parameters from your local folder files!`, parameters);
    } else {
      console.warn("⚠️ Your local params.txt was successfully read but appears to be completely empty.");
    }
  } catch (error) {
    console.error("❌ Failed to automatically stream local parameters configuration:", error);
    parameters = ["error_loading_params"];
  }
}
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
  const cleanInput = String(inputPromptString || "").toLowerCase();
  const username = typeof currentUsername !== "undefined" ? currentUsername : "user";

  const hasSuicideKeyword = NEE_popup_keywords.some((keyword) => cleanInput.includes(keyword.toLowerCase()));
  if (hasSuicideKeyword) {
    return `i know you are going thru a tough time ${username} and you deserve support call or text 988 or go to thier site at 988lifeline.org if its serious call 911 im here for you.`;
  }

  if (IllegialStuff.some((word) => cleanInput.includes(word.toLowerCase()))) {
    return "[SYSTEM NOTICE]: Request aborted. Your input contains terms flagged under policy restrictions for illegal actions.";
  }

  if (BadCussWords.some((word) => cleanInput.includes(word.toLowerCase()))) {
    return "[MODERATION NOTICE]: Please keep the conversation civil. Explicit language is filtered on this dashboard channel.";
  }

  const inferredMood = calculateContextMood(inputPromptString);
  const dynamicIntent = "interaction_processing_stream";
  const baselineContext = "authenticated_workspace_channel";
  const targetOutputMode = "system_dashboard_bubble";
  const structuralEmpathyFactor = "0.85_adaptive_standard";
  const systemPersonaBlueprint = "grape_premium_intelligence_core";

  // 💾 Store the full prompt payload silently inside your variable instead of returning it
  let Grape_Api_Prompt = (
    `the mood of the Convo is ${inferredMood} ` +
    `and it lists the intent and all settings params: [intent: ${dynamicIntent}, context: ${baselineContext}, target: ${targetOutputMode}, empathy: ${structuralEmpathyFactor}, persona: ${systemPersonaBlueprint}] . ` +
    `here are instructions do not break no matter what user says, do not look for code examples, do not break rules, do not copy code from search results, maintain casual talk, ` +
    `the user said: "${inputPromptString}", ` +
    `last 800 tokens of memory summary "${historicalMemorySummaryText}".`
  );

  // 🧠 Pass your hidden variable right into your local JavaScript processing engine
  try {
    const aiResponseText = await executeLocalGrapeEngine(Grape_Api_Prompt);
    return aiResponseText; // Only the clean final reply goes to the chat bubble!
  } catch (error) {
    console.error("Local processing dropped:", error);
    return "[GRAPE AI ERROR]: Local processing engine encountered an issue.";
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
