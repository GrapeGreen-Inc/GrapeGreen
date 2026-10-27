// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
// Importing Realtime Database tools to handle live syncing
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es",
  authDomain: "app-iguess-39f2f.firebaseapp.com",
  databaseURL: "https://app-iguess-39f2f-default-rtdb.firebaseio.com",
  projectId: "app-iguess-39f2f",
  storageBucket: "app-iguess-39f2f.firebasestorage.app",
  messagingSenderId: "1056619953768",
  appId: "1:1056619953768:web:6ac154660c07c48a5005dd",
  measurementId: "G-J4736J0D8J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

// Reference your exact metadata path for the meme
const memeRef = ref(database, 'meta/Meme_Of_The_Day');
const memeImageElement = document.getElementById("memeOfTheDay");

// Live sync listener: Updates the dashboard instantly when database value changes
onValue(memeRef, (snapshot) => {
  const memePath = snapshot.val();
  if (memePath && memeImageElement) {
    memeImageElement.src = memePath;
  }
});

// Accurate calculation of milliseconds remaining until midnight Pacific Time
function msUntilMidnightPacific() {
  const now = new Date();

  // Create a formatter to extract the exact current elements according to Pacific rules
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hour12: false
  });

  const parts = formatter.formatToParts(now);
  const partValues = {};
  parts.forEach(p => { if (p.type !== 'literal') partValues[p.type] = parseInt(p.value, 10); });

  // Reconstruct the exact current Pacific timestamp natively
  const currentPacificTime = Date.UTC(
    partValues.year, partValues.month - 1, partValues.day,
    partValues.hour, partValues.minute, partValues.second, now.getMilliseconds()
  );

  // Set the target timestamp to the upcoming midnight Pacific
  const targetPacificMidnight = Date.UTC(
    partValues.year, partValues.month - 1, partValues.day + 1,
    0, 0, 0, 0
  );

  return targetPacificMidnight - currentPacificTime;
}

// Triggers a snapshot fetch at exactly 12:00 AM Pacific
function scheduleNextPacificRotation() {
  const delay = msUntilMidnightPacific();
  
  console.log(`Meme rotation scheduled. Next rotation in ${(delay / 1000 / 60).toFixed(2)} minutes.`);

  setTimeout(async () => {
    try {
      // Force pull the latest path value at midnight from the reference node
      const snapshot = await get(memeRef);
      const memePath = snapshot.val();
      if (memePath && memeImageElement) {
        memeImageElement.src = memePath;
      }
    } catch (error) {
      console.error("Failed to rotate meme at midnight Pacific:", error);
    }
    // Setup loop scheduling for successive midnights
    scheduleNextPacificRotation();
  }, delay);
}

// Kick off the scheduling thread tracker
scheduleNextPacificRotation();
