(function () {
  const getEl = id => document.getElementById(id);
  const PROJECT_ID = typeof CFG !== "undefined" ? CFG.projectId : "app-iguess-39f2f";
  const API_KEY = typeof CFG !== "undefined" ? CFG.apiKey : "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es";
  const BASE_DB = `https://googleapis.com{PROJECT_ID}/databases/(default)/documents`;
  const USERS_DB = typeof DB !== "undefined" ? DB : `${BASE_DB}/users`;
  const CODES_DB = typeof GIFT_CODES_DB !== "undefined" ? GIFT_CODES_DB : `${BASE_DB}/giftcards`;
  const QUERY_KEY = typeof KEY !== "undefined" ? KEY : `?key=${API_KEY}`;
  const AES_SECRET = `GrapeGreen_AES256_${PROJECT_ID}_VaultKey`;
  const STAFF_RANKS = ["mod", "admin", "headadmin", "legal"];
  const INFINITE_RANKS = ["dev", "owner"];
  const TEN_MINS_MS = 600000;

  let cvvVisible = false,
      userCvv = "",
      currentTokens = 5,
      creditBalance = 5,
      cardNumber = "USER-0000-0000-0000",
      earnInterval = null,
      loadedUser = "",
      selPrice = 1.99,
      selTokens = 100,
      isMicro = false,
      userRole = "guest";

  const encryptAES256 = t => CryptoJS.AES.encrypt(String(t), AES_SECRET).toString();

  function decryptAES256(c) {
    if (!c || typeof c !== "string" || typeof CryptoJS === "undefined") return "";
    try {
      return CryptoJS.AES.decrypt(c, AES_SECRET).toString(CryptoJS.enc.Utf8);
    } catch {
      return "";
    }
  }

  function parseFirestoreDoc(d) {
    if (typeof parseDoc === "function") return parseDoc(d);
    const o = {}, f = d.fields || {};
    for (const [k, v] of Object.entries(f)) {
      o[k] = "stringValue" in v ? v.stringValue
           : "integerValue" in v ? Number(v.integerValue)
           : "doubleValue" in v ? Number(v.doubleValue)
           : "booleanValue" in v ? Boolean(v.booleanValue)
           : null;
    }
    return o;
  }

  async function fetchUser(u) {
    if (typeof getUser === "function") return await getUser(u);
    const r = await fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("read " + r.status);
    const o = parseFirestoreDoc(await r.json());
    if (o.deletedAt && o.purgeAt < Date.now()) {
      fetch(`${USERS_DB}/${encodeURIComponent(u)}${QUERY_KEY}`, { method: "DELETE" });
      return null;
    }
    return o;
  }

  async function patchDoc(db, id, fieldsObj) {
    const m = Object.keys(fieldsObj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    const sep = QUERY_KEY.includes("?") ? "&" : "?";
    const r = await fetch(`${db}/${encodeURIComponent(id)}${QUERY_KEY}${sep}${m}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsObj })
    });
    if (!r.ok) throw new Error("write " + r.status);
  }

  const updateUserFields = (u, f) => patchDoc(USERS_DB, u, f);

  async function getAllUsedCardNumbers() {
    const used = new Set();
    try {
      const sep = QUERY_KEY.includes("?") ? "&" : "?";
      const r = await fetch(`${USERS_DB}${QUERY_KEY}${sep}pageSize=1000`);
      if (!r.ok) return used;
      for (const doc of ((await r.json()).documents || [])) {
        const p = parseFirestoreDoc(doc);
        const dec = p.Card_Num ? decryptAES256(p.Card_Num) : "";
        if (dec) used.add(dec.toUpperCase());
      }
    } catch {}
    return used;
  }

  async function generateUniqueCardNumber(u) {
    const prefix = ((u || "USER").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() + "USER").slice(0, 4);
    const r4 = () => String(Math.floor(1000 + Math.random() * 9000));
    const used = await getAllUsedCardNumbers();
    let c = "", a = 0;
    do {
      c = `${prefix}-${r4()}-${r4()}-${r4()}`;
      a++;
    } while (used.has(c) && a < 50);
    return c;
  }

  const normalizeRole = r => (r || "guest").toLowerCase().replace(/[\s_-]+/g, "").trim();
  const isInfiniteRank = r => INFINITE_RANKS.includes(normalizeRole(r));
  const isStaffRank = r => STAFF_RANKS.includes(normalizeRole(r));

  // dev/owner -> Infinity | mod/admin/headadmin/legal -> 500 | guest/users -> 5
  function getStartingAmount(r) {
    if (isInfiniteRank(r)) return Infinity;
    if (isStaffRank(r)) return 500;
    return 5;
  }

  const detectUsername = () => ((typeof window.currentUser === "string" ? window.currentUser : window.currentUser?.username) || localStorage.getItem("lastUser") || "").trim();

  function renderWalletUI() {
    const inf = isInfiniteRank(userRole);
    const balText = inf ? "∞" : `$${Number(creditBalance ?? 5).toFixed(2)}`;
    const tokText = inf ? "∞" : String(currentTokens ?? 5);

    ["card-balance", "credit-balance", "wallet-balance"].forEach(id => {
      if (getEl(id)) getEl(id).textContent = balText;
    });
    ["token-balance", "tokens-count", "user-tokens"].forEach(id => {
      if (getEl(id)) getEl(id).textContent = tokText;
    });
    ["card-number", "user-card-number"].forEach(id => {
      if (getEl(id)) getEl(id).textContent = cardNumber;
    });
    ["card-cvv", "user-card-cvv"].forEach(id => {
      if (getEl(id)) getEl(id).textContent = cvvVisible ? userCvv : "•••";
    });
  }

  async function initWallet() {
    const username = detectUsername();

    // Guest fallback: starts with 5
    if (!username || username.toLowerCase() === "guest") {
      userRole = "guest";
      currentTokens = getStartingAmount("guest");
      creditBalance = getStartingAmount("guest");
      renderWalletUI();
      return;
    }

    loadedUser = username;

    try {
      const userData = await fetchUser(username);
      if (!userData) return;

      userRole = userData.role || userData.rank || "user";
      const startAmt = getStartingAmount(userRole);

      let needsSave = false;
      const updates = {};

      if (userData.Card_Num) {
        cardNumber = decryptAES256(userData.Card_Num) || userData.Card_Num;
      } else {
        cardNumber = await generateUniqueCardNumber(username);
        updates.Card_Num = { stringValue: encryptAES256(cardNumber) };
        needsSave = true;
      }

      if (userData.Card_CVV) {
        userCvv = decryptAES256(userData.Card_CVV) || userData.Card_CVV;
      } else {
        userCvv = String(Math.floor(100 + Math.random() * 900));
        updates.Card_CVV = { stringValue: encryptAES256(userCvv) };
        needsSave = true;
      }

      if (isInfiniteRank(userRole)) {
        currentTokens = Infinity;
        creditBalance = Infinity;
      } else {
        // Use saved balance/tokens if they exist, otherwise initialize to 500 (staff) or 5 (users)
        if (userData.tokens != null) {
          currentTokens = Number(userData.tokens);
        } else {
          currentTokens = startAmt;
          updates.tokens = { integerValue: String(startAmt) };
          needsSave = true;
        }

        if (userData.creditBalance != null) {
          creditBalance = Number(userData.creditBalance);
        } else {
          creditBalance = startAmt;
          updates.creditBalance = { doubleValue: startAmt };
          needsSave = true;
        }
      }

      if (needsSave) {
        await updateUserFields(username, updates);
      }

      renderWalletUI();
    } catch (err) {
      console.error("Wallet init error:", err);
    }
  }

  window.GGWallet = {
    refresh: initWallet,
    isInfinite: () => isInfiniteRank(userRole),
    getBalance: () => creditBalance,
    getTokens: () => currentTokens
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWallet);
  } else {
    initWallet();
  }
})();
