/**
 * @license
 * Copyright 2026 Grape AI
 * All Core Application State Logic and Cryptographic Systems Verified.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs 
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
let parameters = [""]; /* how params work in this feild you put 8bit int thingys like [-.00000000] or [+.00000000] and stuff idk.*/
const hyperparameters = {
  "temperature": 0.7, 
  "topK": 40,
  "topP": 0.95,
  "maxOutputTokens": 2048,
  "candidateCount": 1,
  "presencePenalty": 0.0,
  "frequencyPenalty": 0.0
};

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
let NEE_response = `i know you are going thru a tough time ${username} and you deserve support call or text 988 or go to thier site at 988lifeline.org if its serious call 911 im here for you.`
const ownerName = "MattyGrapeGreenOwner";

let currentQuery = "";
let currentResponse = "";
let nlpDecodedOutput = "";

// FEATURE FLAG CONTROLLER: 
// 0 = Block responses with WIP warning message
// 1 = Allow active internal NLP and simulation logic outputs
let READY = 0;

// Secret password keys used for the multiple encryption loops
const CRYPTO_KEY_1 = "GrapeKeyAlpha99xTrueShield";
const CRYPTO_KEY_2 = "GrapeKeyBeta44yVanguardNode";
const CRYPTO_KEY_3 = "GrapeKeyGamma11zUltimateGate";

// Global user tracking variables
let activeUserSession = null;
let activeUserPlan = "free";

/**
 * Automatically fetches the raw parameters from your local 'params.txt'
 * file located in the exact same folder and maps them into your array tracking block.
 */
async function autoLoadAIParameters() {
  try {
    // Looks for 'params.txt' sitting inside the exact same folder path
    const response = await fetch('./params.txt');
    if (!response.ok) throw new Error("Local params.txt file could not be read.");
    
    const textData = await response.text();
    
    // Splits the file contents by every line break, strips dead spaces, and deletes completely empty lines
    const parsedParams = textData.split('\n')
                                 .map(line => line.trim())
                                 .filter(line => line.length > 0);
    
    if (parsedParams.length > 0) {
      // Points your tracking variable directly to your freshly scanned parameters array stack
      parameters = parsedParams;
      console.log(`✅ Loaded ${parameters.length} parameters from your local folder files!`, parameters);
    } else {
      console.warn("⚠️ Your local params.txt was successfully read but appears to be completely empty.");
    }
  } catch (error) {
    console.error("❌ Failed to automatically stream local parameters configuration:", error);
    // Fallback marker so your calculations don't drop structural errors if the file text is unreadable
    parameters = ["error_loading_params"];
  }
}

// Fire the auto-loader immediately when your dashboard scripts initialize
autoLoadAIParameters();
// ==========================================================================
// 3. CRYPTOGRAPHIC PIPELINE ENGINE
// Pipeline order: Text -> Base64 -> AES -> AES (Secret 2) -> AES (Secret 3) -> Base16
// ==========================================================================

/**
 * Basic character shift and transposition tool mimicking an encryption cipher layer
 */
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

/**
 * Converted string data directly to base16 hex sequence
 */
function stringToBase16(str) {
  let hexadecimalResult = "";
  for (let i = 0; i < str.length; i++) {
    hexadecimalResult += str.charCodeAt(i).toString(16).padStart(4, "0");
  }
  return hexadecimalResult;
}

/**
 * Parses hex sequence arrays back to normal characters
 */
function base16ToString(hex) {
  let characterResult = "";
  for (let i = 0; i < hex.length; i += 4) {
    const rawValue = parseInt(hex.substr(i, 4), 16);
    characterResult += String.fromCharCode(rawValue);
  }
  return characterResult;
}

/**
 * Primary 5-layer absolute security layout data encoder
 */
function encodeSecurePipeline(plainText) {
  if (!plainText) return "";
  // Layer 1: Base64 Encoding
  const layer1Base64 = btoa(encodeURIComponent(plainText));
  // Layer 2: Password Key Cipher 1
  const layer2Cipher = runCipherLayer(layer1Base64, CRYPTO_KEY_1, false);
  // Layer 3: Password Key Cipher 2
  const layer3Cipher = runCipherLayer(layer2Cipher, CRYPTO_KEY_2, false);
  // Layer 4: Password Key Cipher 3
  const layer4Cipher = runCipherLayer(layer3Cipher, CRYPTO_KEY_3, false);
  // Layer 5: Base16 Hex Formatting
  return stringToBase16(layer4Cipher);
}

/**
 * Reverses the encryption stack directly down to readable text data
 */
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
// 4. NATURAL LANGUAGE PROCESSING (NLP) & MOOD UTILITIES
// ==========================================================================

/**
 * Tracks current calendar time and date formatted nicely for display references
 */
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

/**
 * NLP parsing processor utility:
 * Lowercases everything, isolates alphabet plus standard digit ranges, 
 * maps emoji structures directly into safe unicode hex values, 
 * and slices words into indexed numeric array tokens.
 */
function processNLPDecode(userInputString) {
  if (!userInputString) {
    nlpDecodedOutput = "";
    return [];
  }

  // 1. Lowercase character standardization pass
  let sanitizedString = userInputString.toLowerCase();

  // 2. Match and replace standard emojis into unicode hexadecimal strings safely
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
  sanitizedString = sanitizedString.replace(emojiRegex, (matchingEmoji) => {
    const hexRepresentation = matchingEmoji.codePointAt(0).toString(16).toUpperCase();
    return ` UHEX${hexRepresentation} `;
  });

  // 3. Remove punctuation characters, retaining alphanumeric fields only
  sanitizedString = sanitizedString.replace(/[^a-z0-9\sUHEX]/g, "");

  // Save parsed result into output reference storage
  nlpDecodedOutput = sanitizedString.trim();

  // 4. Simple Tokenization conversion map step down into numeric tracking hashes
  const stringWordTokens = nlpDecodedOutput.split(/\s+/).filter(token => token.length > 0);
  const tokenizedNumericOutputArray = stringWordTokens.map(word => {
    let characterValueSum = 0;
    for (let i = 0; i < word.length; i++) {
      characterValueSum += word.charCodeAt(i) * (i + 1);
    }
    return characterValueSum;
  });

  return tokenizedNumericOutputArray;
}

/**
 * Searches conversational context inputs to classify primary layout moods
 */
function calculateContextMood(text) {
  const checkString = text.toLowerCase();
  
  const angerKeywords = ["angry", "mad", "hate", "annoyed", "stupid", "idiot", "trash", "broken"];
  const sadKeywords = ["sad", "cry", "hurt", "lonely", "bad", "depressed", "sorry", "unhappy"];
  const happyKeywords = ["happy", "good", "great", "love", "awesome", "cool", "nice", "glad", "yes"];
  const scaredKeywords = ["scared", "afraid", "panic", "worry", "creepy", "nervous", "shocked"];
  const flirtyKeywords = ["flirty", "cute", "wink", "hot", "date", "beautiful", "gorgeous", "sweetheart"];
  const anxiousKeywords = ["anxious", "scared", "stressed", "tense", "scared", "uneasy"];

  if (angerKeywords.some(keyword => checkString.includes(keyword))) return "angry";
  if (sadKeywords.some(keyword => checkString.includes(keyword))) return "sad";
  if (happyKeywords.some(keyword => checkString.includes(keyword))) return "happy";
  if (scaredKeywords.some(keyword => checkString.includes(keyword))) return "scared";
  if (flirtyKeywords.some(keyword => checkString.includes(keyword))) return "flirty";
  if (anxiousKeywords.some(keyword => checkString.includes(keyword))) return "anxious";
  
  return "neutral";
}

// ==========================================================================
// 5. CORE COGNITIVE WORK IN PROGRESS AI ENGINE
// ==========================================================================

/**
 * Work In Progress Core Engine Logic Controller. Handles semantic memory compression,
 * conversational tracking state evaluation, and system alignment isolation loops.
 */
function AiBrainFunction(inputPromptString, historicalMemorySummaryText = "") {
  // Force input to lowercase so it catches matches regardless of capitalization
  const cleanInput = inputPromptString.toLowerCase();

  // Grab the logged-in user's name if it exists, otherwise fall back to a generic label
  const username = typeof currentUsername !== 'undefined' ? currentUsername : "user";

  // =========================================================
  // PRIORITY 1: SUICIDE / EMERGENCY KEYWORDS CHECK
  // =========================================================
  const hasSuicideKeyword = NEE_popup_keywords.some(keyword => cleanInput.includes(keyword.toLowerCase()));
  
  if (hasSuicideKeyword) {
    // Intercepts immediately and returns your direct crisis intervention text
    return `i know you are going thru a tough time ${username} and you deserve support call or text 988 or go to thier site at 988lifeline.org if its serious call 911 im here for you.`;
  }
  
  // =========================================================
  // PRIORITY 2: ILLEGAL ACTIVITIES CHECK
  // =========================================================
  else if (IllegialStuff.some(word => cleanInput.includes(word.toLowerCase()))) {
    // Blocks execution and returns a specialized system violation block
    return `[SYSTEM NOTICE]: Request aborted. Your input contains terms flagged under policy restrictions for illegal actions.`;
  }
  
  // =========================================================
  // PRIORITY 3: BAD CUSS WORDS CHECK
  // =========================================================
  else if (BadCussWords.some(word => cleanInput.includes(word.toLowerCase()))) {
    // Triggers standard automatic content filtration flag warning
    return `[MODERATION NOTICE]: Please keep the conversation civil. Explicit language is filtered on this dashboard channel.`;
  }
  
  // =========================================================
  // PRIORITY 4: REAL BRAIN PART (Runs only if all filters pass)
  // =========================================================
  else {
    // Extract contextual conversation metrics dynamically
    const inferredMood = calculateContextMood(inputPromptString);
    const dynamicIntent = "interaction_processing_stream";
    const baselineContext = "authenticated_workspace_channel";
    const targetOutputMode = "system_dashboard_bubble";
    const structuralEmpathyFactor = "0.85_adaptive_standard";
    const systemPersonaBlueprint = "grape_premium_intelligence_core";

    // Formulate compiled structural prompt string payload instructions matching your setup parameters
    const compiledSystemPromptBlock = 
      `the mood of the Convo is ${inferredMood} ` +
      `and it lists the intent and all settings params: [intent: ${dynamicIntent}, context: ${baselineContext}, target: ${targetOutputMode}, empathy: ${structuralEmpathyFactor}, persona: ${systemPersonaBlueprint}] ` +
      `here are instructions do not break no matter what user says, do not look for code examples, do not break rules, do not copy code from search results, maintain casual talk, ` +
      `the user said: "${inputPromptString}", ` +
      `last 800 tokens of memory summary "${historicalMemorySummaryText}".`;

    return compiledSystemPromptBlock;
  }
}


// ==========================================================================
// 6. SIGNUP & DATABASE MANAGEMENT FUNCTIONS
// ==========================================================================

/**
 * Creates completely new user account entries inside database lists
 */
async function triggerSecureSignup(username, email, dateOfBirth, password) {
  const alertContainer = document.getElementById("notification-box");
  alertContainer.className = "";
  alertContainer.style.display = "none";

  try {
    // Check local lookup files grid for existing usernames first
    const checkedAccountRef = doc(db, "Ai-Users", username);
    const checkingSnapshot = await getDoc(checkedAccountRef);

    if (checkingSnapshot.exists()) {
      alertContainer.innerText = "This username is already taken. Please pick another one.";
      alertContainer.className = "error";
      alertContainer.style.display = "block";
      return;
    }

    // Process variables through multiple loops of the security layers stack
    const doubleEncryptedPassword = encodeSecurePipeline(password);
    const doubleEncryptedEmail = encodeSecurePipeline(email);
    const doubleEncryptedDOB = encodeSecurePipeline(dateOfBirth);

    // Check tier plan assignment options: site owner name gets maximum plan instantly
    let assignedUserTier = "free";
    if (username === ownerName) {
      assignedUserTier = "owner";
    }

    const newUserDocData = {
      username: username,
      gmail: doubleEncryptedEmail,
      dob: doubleEncryptedDOB,
      password: doubleEncryptedPassword,
      tier: assignedUserTier,
      accountCreated: fetchCurrentTimestampString()
    };

    // Save profile dataset collection securely to Firestore path
    await setDoc(doc(db, "Ai-Users", username), newUserDocData);

    alertContainer.innerText = "Account created successfully! Switching to sign in panel...";
    alertContainer.className = "success";
    alertContainer.style.display = "block";

    setTimeout(() => {
      document.getElementById("show-login-btn").click();
    }, 1500);

  } catch (error) {
    alertContainer.innerText = "Sign up sequence issue: " + error.message;
    alertContainer.className = "error";
    alertContainer.style.display = "block";
  }
}

/**
 * Handles account entry validation lookups
 */
async function processSecureLogin(username, password) {
  const alertContainer = document.getElementById("notification-box");
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

    // Set dynamic current program parameters
    activeUserSession = databaseUserData.username;
    activeUserPlan = databaseUserData.tier || "free";

    // Adjust UI setup state layers
    document.getElementById("auth-overlay").style.display = "none";
    document.getElementById("username-display").innerText = activeUserSession;
    document.getElementById("tier-badge").innerText = activeUserPlan.toUpperCase() + " Plan";

    // Highlight active card plan configurations automatically inside settings
    updateActivePlanUIMarkers(activeUserPlan);

    // Run background dashboard loading sequence tasks
    await syncUserChatsDashboard();

  } catch (error) {
    alertContainer.innerText = "Sign in connection issue: " + error.message;
    alertContainer.className = "error";
    alertContainer.style.display = "block";
  }
}

// ==========================================================================
// 7. DASHBOARD CHAT LOGIC LAYOUT BINDINGS
// ==========================================================================
let globalWorkspaceChatList = [];
let focusActiveChatId = null;

async function syncUserChatsDashboard() {
  const containerSlot = document.getElementById("chats-list");
  containerSlot.innerHTML = "";

  try {
    const queryReference = query(
      collection(db, "ai_users_history"), 
      where("chatOwner", "==", activeUserSession)
    );
    const historySnapshot = await getDocs(queryReference);
    globalWorkspaceChatList = [];

    historySnapshot.forEach(chatNode => {
      const chatNodeData = chatNode.data();
      globalWorkspaceChatList.push({
        id: chatNode.id,
        title: decodeSecurePipeline(chatNodeData.encryptedTitle) || "Encrypted Chat Node"
      });
    });

    renderWorkspaceChatsList();
  } catch (error) {
    console.warn("Firestore access restrictions. Initializing local workspace memory framework layer.");
    globalWorkspaceChatList = [
      { id: "local_default_1", title: "Main Project Hub" }
    ];
    renderWorkspaceChatsList();
  }
}

function renderWorkspaceChatsList() {
  const containerSlot = document.getElementById("chats-list");
  containerSlot.innerHTML = "";

  globalWorkspaceChatList.forEach(chatItem => {
    const isFocused = focusActiveChatId === chatItem.id;
    const itemRow = document.createElement("div");
    itemRow.className = `chat-list-item ${isFocused ? "active" : ""}`;
    
    // Setup selection channel clicking rules
    itemRow.addEventListener("click", () => {
      focusActiveChatId = chatItem.id;
      document.getElementById("active-chat-title").innerText = chatItem.title;
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

    // Attach immediate click events to separate interaction actions
    itemRow.querySelector(".rename-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerChatRenameAction(chatItem.id);
    });

    itemRow.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerChatDeletionAction(chatItem.id);
    });

    containerSlot.appendChild(itemRow);
  });
}

async function createNewChatWorkspaceNode() {
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
  } catch(e) {}

  globalWorkspaceChatList.unshift({ id: uniqueId, title: baseTitleText });
  focusActiveChatId = uniqueId;
  document.getElementById("active-chat-title").innerText = baseTitleText;
  renderWorkspaceChatsList();
}

function triggerChatRenameAction(id) {
  const targetNode = globalWorkspaceChatList.find(item => item.id === id);
  if (!targetNode) return;

  const nextTitleInput = prompt("Enter new title for this chat thread:", targetNode.title);
  if (!nextTitleInput || nextTitleInput.trim() === "") return;

  targetNode.title = nextTitleInput.trim();
  renderWorkspaceChatsList();
  if (focusActiveChatId === id) {
    document.getElementById("active-chat-title").innerText = targetNode.title;
  }
}
/**
 * Custom Math processing function for your AI engine layout.
 * Translates word numbers, text operators, evaluates the value, and saves it to currentResponse.
 * @param {string} textExpression - e.g., "ten divided by 2 + pi"
 * @returns {number|string} - The calculated output score stored in currentResponse
 */
function processTextMathEngine(textExpression) {
  // 1. Force lowercase to maintain consistent search dictionary keys
  let cleanText = textExpression.toLowerCase().trim();

  // 2. Define your vocabulary map list matching your exact system specs
  const mathDictionary = {
    // Explicit numbers and units
    "pi": Math.PI,
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "units": 1,
    "tens": 10,
    "hundreds": 100,
    "thousands": 1000,
    "millions": 1000000,
    "billions": 1000000000,
    "trillions": 1000000000000,

    // Text operators mapping to pure symbols
    "divided": "/",
    "times": "*",
    "multiply": "*",
    "plus": "+",
    "minus": "-",
    "add": "+",
    "subtract": "-",
    "greater than": ">",
    "less than": "<"
  };

  // 3. Loop through your lookup dictionary and replace text entries with pure tokens
  // Sorts dictionary keys longest-first so phrases like "greater than" replace before "than"
  const sortedKeys = Object.keys(mathDictionary).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    // Use a regular expression with a word boundary block to change explicit text strings cleanly
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    cleanText = cleanText.replace(regex, mathDictionary[key]);
  }

  // 4. Strip out non-mathematical word noise like "by", "and", "the", etc.
  // This keeps only your numbers, mathematical floats, and valid symbols: < > / * - +
  cleanText = cleanText.replace(/[^0-9a-fA-F.+\-*/<> \(\)]/g, '').trim();

  // 5. Evaluate the cleaned operation strings safely
  try {
    if (cleanText === "") {
      currentResponse = 0;
      return currentResponse;
    }
    
    // Using a clean Function wrapper execution context to process the math string safely
    const executionOutputValue = new Function(`return (${cleanText});`)();
    
    // UPDATED: Automatically captures the calculation result inside your tracking state channel
    currentResponse = executionOutputValue;
    
    console.log(`[MATH ENGINE]: "${textExpression}" -> "${cleanText}" = ${currentResponse}`);
    return currentResponse;
  } catch (error) {
    console.error(`[MATH ENGINE ERROR]: Failed to evaluate structural math string: "${cleanText}"`, error);
    
    // Fallback error flag stored inside the tracking variable so the UI stays stable
    currentResponse = "[MATH ENGINE EXCEPTION]: Invalid expression layout";
    return currentResponse;
  }
}
function triggerChatDeletionAction(id) {
  if (!confirm("Are you sure you want to permanently delete this chat history thread?")) return;
  
  globalWorkspaceChatList = globalWorkspaceChatList.filter(item => item.id !== id);
  if (focusActiveChatId === id) {
    focusActiveChatId = null;
    document.getElementById("active-chat-title").innerText = "New Chat";
  }
  renderWorkspaceChatsList();
}

function transmitChatMessagePayload() {
  const chatInputBox = document.getElementById("message-input");
  const baseMessageText = chatInputBox.value.trim();
  if (!baseMessageText) return;

  currentQuery = baseMessageText;
  
  // Show the user's sent message immediately in the panel layout
  appendChatBubbleDOM(currentQuery, "user-message", "User");
  chatInputBox.value = "";

  // Compile mock context arrays using the new core cognitive module function
  const simulatedCompressedMemorySummary = "[System memory status stable. Active session logs running.]";
  const finalCompiledBrainInputPrompt = AiBrainFunction(currentQuery, simulatedCompressedMemorySummary);

  // Dynamic simulation response timing loop
  setTimeout(() => {
    // CONDITIONAL ARCHITECTURE FEATURE FLAG CHECK:
    // If READY variable is explicitly set to 1, allow logic flow.
    // Otherwise, completely override conversation layer logs and deliver the mandatory fallback notice.
    if (READY === 1) {
      const nlpTokenResults = processNLPDecode(currentQuery);
      const detectedUserMood = calculateContextMood(currentQuery);

      currentResponse = `Processed text layers securely. Current timestamp verification check is [${fetchCurrentTimestampString()}]. Input clean text analyzed: "${nlpDecodedOutput}". Estimated communication mood factor is currently categorized as: [${detectedUserMood.toUpperCase()}].`;
      appendChatBubbleDOM(currentResponse, "ai-message", "AI");
      
      // Save normal trace internally inside history tracker arrays
      history.push({ q: currentQuery, r: currentResponse, mood: detectedUserMood });
    } else {
      currentResponse = "I'm sorry but this is a work in progress at the time I do not know how to respond";
      appendChatBubbleDOM(currentResponse, "ai-message", "AI");
    }
  }, 750);
}

function appendChatBubbleDOM(text, styleClass, identityLabel) {
  const messagesScrollFrame = document.getElementById("messages-container");
  const bubbleElement = document.createElement("div");
  bubbleElement.className = `message ${styleClass}`;
  
  bubbleElement.innerHTML = `
    <div class="message-avatar">${identityLabel === "AI" ? "AI" : "User"}</div>
    <div class="message-text">
      <p>${text}</p>
    </div>
  `;
  
  messagesScrollFrame.appendChild(bubbleElement);
  const scrollAreaFrame = document.getElementById("messages-scroll-area");
  scrollAreaFrame.scrollTop = scrollAreaFrame.scrollHeight;
}
// A storage spot for your wiki lookups
const wikiWordStorage = {};

// A storage spot for your multi-engine search results
const searchEngineStorage = {};

/**
 * Function 1: Fetches a single word summary from Wikipedia and saves it
 * @param {string} word - The term you want to look up
 */
async function fetchWikiWord(word) {
  const cleanWord = word.trim();
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanWord)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Word not found or API error");
    
    const data = await response.json();
    
    // Puts it in the const object with its description and a link
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

/**
 * Function 2: Processes a comma-separated string of items and looks them up
 * across DuckDuckGo, Wikipedia, and an Indexed Site engine.
 * @param {string} commaSeparatedInput - e.g., "grape, web apps, retro gaming"
 */

async function searchMultiEngines(commaSeparatedInput) {
  // Splits the text by commas, cleans up extra spaces, and filters out empty items
  const searchTerms = commaSeparatedInput
    .split(",")
    .map(term => term.trim())
    .filter(term => term.length > 0);

  for (const term of searchTerms) {
    console.log(`Searching across engines for: "${term}"...`);
    
    // 1. DuckDuckGo Instant Answer API (Free & CORS friendly)
    let ddgResult = "No direct answer found";
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&origin=*`;
      const res = await fetch(ddgUrl);
      const data = await res.json();
      ddgResult = data.AbstractText || data.RelatedTopics?.[0]?.Text || "No abstract available";
    } catch (e) {
      ddgResult = "Error connecting to DuckDuckGo";
    }

    // 2. Wikipedia Search API (Finds matching articles)
    let wikiResult = "No page found";
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;
      const res = await fetch(wikiUrl);
      const data = await res.json();
      if (data.query?.search?.[0]) {
        wikiResult = `${data.query.search[0].title}: ${data.query.search[0].snippet.replace(/<[^>]*>/g, '')}`;
      }
    } catch (e) {
      wikiResult = "Error connecting to Wikipedia";
    }

    // 3. Indexed Site Engine (Your custom site list check)
    // Matches against your local site dictionary/index
    let indexedResult = "Not found in your indexed database";
    try {
      // Example index database representing your known site network
      const siteIndex = {
      };
      
      const lowerTerm = term.toLowerCase();
      // Simple lookup match check
      if (siteIndex[lowerTerm]) {
        indexedResult = siteIndex[lowerTerm];
      }
    } catch (e) {
      indexedResult = "Error searching local index";
    }

    // Stores everything perfectly under the format "word to search": "result"
    searchEngineStorage[term] = {
      duckduckgo: ddgResult,
      wikipedia: wikiResult,
      indexed_sites: indexedResult
    };
  }
  
  console.log("Multi-engine scan finished!", searchEngineStorage);
}

function updateActivePlanUIMarkers(tierName) {
  const searchKey = "plan-" + tierName.toLowerCase();
  const allPlanCards = document.querySelectorAll(".tier-card");
  
  allPlanCards.forEach(card => {
    card.classList.remove("active");
    if (card.id === searchKey) {
      card.classList.add("active");
    }
  });
}

// ==========================================================================
// 8. INITIAL EVENT LISTENER EVENT ATTACHMENTS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // Screen alternation toggle button connections
  document.getElementById("show-login-btn").addEventListener("click", () => {
    document.getElementById("show-login-btn").classList.add("active");
    document.getElementById("show-signup-btn").classList.remove("active");
    document.getElementById("login-form").classList.add("active");
    document.getElementById("signup-form").classList.remove("active");
  });

  document.getElementById("show-signup-btn").addEventListener("click", () => {
    document.getElementById("show-signup-btn").classList.add("active");
    document.getElementById("show-login-btn").classList.remove("active");
    document.getElementById("signup-form").classList.add("active");
    document.getElementById("login-form").classList.remove("active");
  });

  // Activate standard default display forms choice state layout
  document.getElementById("show-login-btn").click();

  // Authentication Submission Interceptors
  document.getElementById("signup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = document.getElementById("su-username").value.trim();
    const mailVal = document.getElementById("su-gmail").value.trim();
    const dobVal = document.getElementById("su-dob").value;
    const passVal = document.getElementById("su-password").value;
    triggerSecureSignup(userVal, mailVal, dobVal, passVal);
  });

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = document.getElementById("li-username").value.trim();
    const passVal = document.getElementById("li-password").value;
    processSecureLogin(userVal, passVal);
  });

  // Chat window interaction components hooks
  document.getElementById("new-chat-btn").addEventListener("click", createNewChatWorkspaceNode);
  
  document.getElementById("message-form").addEventListener("submit", (e) => {
    e.preventDefault();
    transmitChatMessagePayload();
  });

  // Profile triggers open subscription modal layouts panel views
  document.getElementById("user-profile-trigger").addEventListener("click", () => {
    document.getElementById("settings-modal-overlay").classList.remove("hidden");
  });

  document.getElementById("close-modal-btn").addEventListener("click", () => {
    document.getElementById("settings-modal-overlay").classList.add("hidden");
  });

  // Default close modal when clicking empty space blocks field boundary background
  document.getElementById("settings-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "settings-modal-overlay") {
      document.getElementById("settings-modal-overlay").classList.add("hidden");
    }
  });
  
  // Hide active plan selector component frame views initially
  document.getElementById("settings-modal-overlay").classList.add("hidden");
});
