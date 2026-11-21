import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";
import { getDatabase, ref, set, get } from "https://gstatic.com";

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

// Safely initialize Firebase (prevents duplicate-app error if app.js already initialized it)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Generates "GGgC" + 12 random characters = 16 characters total
function generateGiftCardCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "GGgC";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hook up buttons once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const randomBtn = document.getElementById("gc-random-btn");
  const createBtn = document.getElementById("gc-create-btn");

  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      document.getElementById("gc-code").value = generateGiftCardCode();
    });
  }

  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      const codeInput = document.getElementById("gc-code").value.trim();
      const amountInput = Number(document.getElementById("gc-amount").value);
      const statusEl = document.getElementById("gc-status");

      // 1. Check prefix & 16-char length
      if (!codeInput.startsWith("GGgC") || codeInput.length !== 16) {
        statusEl.style.color = "#e53e3e";
        statusEl.textContent = "Error: Code must start with 'GGgC' and be exactly 16 characters.";
        return;
      }

      // 2. Check valid Firebase key characters
      if (!/^[a-zA-Z0-9_-]+$/.test(codeInput)) {
        statusEl.style.color = "#e53e3e";
        statusEl.textContent = "Error: Only letters, numbers, - and _ are allowed.";
        return;
      }

      // 3. Check amount is a number between 5 and 250
      if (isNaN(amountInput) || amountInput < 5 || amountInput > 250) {
        statusEl.style.color = "#e53e3e";
        statusEl.textContent = "Error: Amount must be a number between 5 and 250.";
        return;
      }

      try {
        const cardRef = ref(db, `giftcards/${codeInput}`);

        // Prevent overwriting an existing gift card
        const snapshot = await get(cardRef);
        if (snapshot.exists()) {
          statusEl.style.color = "#e53e3e";
          statusEl.textContent = "Error: That gift card code already exists!";
          return;
        }

        // Write to giftcards/<codeInput>
        await set(cardRef, {
          amount: amountInput,
          used: false
        });

        statusEl.style.color = "#38a169";
        statusEl.textContent = `Created gift card ${codeInput} for ${amountInput}!`;
        document.getElementById("gc-code").value = "";
        document.getElementById("gc-amount").value = "";
      } catch (err) {
        statusEl.style.color = "#e53e3e";
        statusEl.textContent = `Firebase Error: ${err.message}`;
      }
    });
  }
});
