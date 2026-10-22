// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
//start of ai
const history = [];
const paramaters = [""];
const hyparparams = ["tempature": 0.7, 
  "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 2048,
    "candidateCount": 1,
    "presencePenalty": 0.0,
    "frequencyPenalty": 0.0,];
const paramater_settings = ["mood", "intent", "context", "target", "empathy", "persona"];
const moods = ["happy", "sad", "angry", "scared", "flirty", "neutral",  "diguised", "anxious"];
const tiers = ["free", "plus", "pro", "max", "owner"];
let ownername = "MattyGrapeGreenOwner";
let query = "";
let response = "";
let NLP_decoded = "";
