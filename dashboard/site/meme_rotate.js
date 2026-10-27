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

// Function to calculate time remaining until 12:00 AM Pacific Time
function msUntilMidnightPacific() {
  const now = new Date();
  
  // Convert current time to a Pacific Time string structure
  const pacificString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const pacificDate = new Date(pacificString);
  
  // Create a target date set to tomorrow at 00:00:00 Pacific
  const midnightPacific = new Date(pacificString);
  midnightPacific.setDate(midnightPacific.getDate() + 1);
  midnightPacific.setHours(0, 0, 0, 0);
  
  // The variance between local runtime tracking and Pacific target tracking
  const differenceInPacific = midnightPacific.getTime() - pacificDate.getTime();
  return differenceInPacific;
}

// Triggers a snapshot fetch at exactly 12:00 AM Pacific
function scheduleNextPacificRotation() {
  const delay = msUntilMidnightPacific();
  
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
