const $ = id => document.getElementById(id);

const CFG = {
  projectId: "YOUR_PROJECT_ID",
  apiKey: "YOUR_FIREBASE_API_KEY"
};

const DB = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/users`;
const ROOT = DB.replace(/\/users$/, "");
const KEY = `?key=${CFG.apiKey}`;

function safeJsonParse(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseDoc(doc) {
  const out = { id: decodeURIComponent((doc?.name || "").split("/").pop() || "") };
  const f = doc?.fields || {};

  for (const key of Object.keys(f)) {
    const v = f[key];

    if (v?.stringValue !== undefined) out[key] = v.stringValue;
    else if (v?.integerValue !== undefined) out[key] = Number(v.integerValue);
    else if (v?.booleanValue !== undefined) out[key] = v.booleanValue;
    else if (v?.arrayValue !== undefined) {
      out[key] = (v.arrayValue.values || []).map(item => {
        if (item?.stringValue !== undefined) return item.stringValue;
        if (item?.integerValue !== undefined) return Number(item.integerValue);
        if (item?.booleanValue !== undefined) return item.booleanValue;
        return item;
      });
    } else if (v?.mapValue !== undefined) {
      out[key] = v.mapValue;
    }
  }

  out.hash = out.passwordHash;
  return out;
}

const hash = (pw, salt) => CryptoJS.PBKDF2(pw, salt, { keySize: 8, iterations: 10000 }).toString();

async function getUser(u) {
  if (!u) return null;
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("read " + r.status);

  const o = parseDoc(await r.json());
  const purgeAt = Number(o.purgeAt || 0);

  if (o.deletedAt && purgeAt > 0 && purgeAt < Date.now()) {
    fetch(`${DB}/${encodeURIComponent(u)}${KEY}`, { method: "DELETE" }).catch(() => {});
    return null;
  }

  return o;
}

async function saveUser(u, p) {
  const fields = {
    username: { stringValue: u },
    age: { stringValue: String(p.age) },
    salt: { stringValue: p.salt },
    passwordHash: { stringValue: p.hash },
    role: { stringValue: p.role }
  };

  if (p.googleUid) fields.googleUid = { stringValue: p.googleUid };
  if (p.age !== "1") {
    fields.gmail = { stringValue: p.gmail || "" };
    fields.dob = { stringValue: p.dob || "" };
  }

  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });

  if (!r.ok) throw new Error("write " + r.status);
}

function parseDob(input) {
  if (!input || typeof input !== "string") return null;
  const value = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
    return null;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [m, d, y] = value.split("/").map(Number);
    const date = new Date(y, m - 1, d);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
    return null;
  }

  return null;
}

function tier(dob) {
  if (!dob) return null;
  const date = parseDob(dob);
  if (!date) return null;
  const today = new Date();
  if (date > today) return null;

  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;

  if (age < 13) return "1";
  if (age <= 17) return "2";
  if (age <= 20) return "3";
  return "4";
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const cleanText = t => String(t ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\bon[a-z]{3,}\s*=/gi, "").replace(/javascript\s*:/gi, "").trim();

const W = CryptoJS.lib.WordArray;
const deriveKey = (pw, salt) => CryptoJS.PBKDF2(pw, salt + ":details", { keySize: 8, iterations: 10000 });

function wrap(text, key) {
  const base64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(String(text ?? "")));
  const iv = W.random(16);
  const ct = CryptoJS.AES.encrypt(base64, key, { iv }).ciphertext;
  return iv.concat(ct).toString(CryptoJS.enc.Hex);
}

function unwrap(hex, key) {
  try {
    const all = CryptoJS.enc.Hex.parse(hex || "");
    const iv = W.create(all.words.slice(0, 4), 16);
    const ct = W.create(all.words.slice(4), all.sigBytes - 16);
    const b64 = CryptoJS.AES.decrypt({ ciphertext: ct }, key, { iv }).toString(CryptoJS.enc.Utf8);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
    return CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
}

const CHAT_KEY = CryptoJS.SHA256("GrapeGreen chat key v1");
const dec = x => unwrap(x || "", CHAT_KEY) ?? x;

const OWNER = "MattyGrapeGreenOwner";
const RANK = { guest: 0, user: 1, mod: 2, admin: 3, headadmin: 4, legal: 5, dev: 6, owner: 7 };
const RNAME = { guest: "Guest", user: "Member", mod: "Mod", admin: "Admin", headadmin: "Head Admin", legal: "Legal", dev: "Dev", owner: "Owner" };
const rk = r => RANK[r] ?? 1;
const isMod = () => rk(me.role) >= 2;
const isAdmin = () => rk(me.role) >= 3;
const isHeadAdmin = () => rk(me.role) >= 4;
const canBot = () => ["dev", "owner", "headadmin"].includes(me.role);
const isLegal = () => me.role === "legal" || me.role === "owner";
const isDev = () => rk(me.role) >= 6;
const banLeft = d => d?.banUntil === -1 ? Infinity : Math.max(0, (d?.banUntil || 0) - Date.now());
const banText = d => banLeft(d) === Infinity ? "permanently banned" : `banned for ${Math.ceil(banLeft(d) / 36e5)} more hour(s)`;

let me = { name: "", role: "guest", age: "" };
let sessionKey = null;
let lastAct = Date.now();
let began = Date.now();

function notifyError(message) {
  const el = $("err");
  if (el) el.textContent = message || "";
}

function enter(u, d) {
  me = {
    name: u,
    role: d ? d.role || "user" : "guest",
    age: d ? d.age || "" : "",
    avatar: d ? d.avatar || "" : ""
  };

  lastAct = began = Date.now();
  const gate = $("gate");
  if (gate) gate.classList.add("hide");

  const who = $("who");
  if (who) who.textContent = u;
  const av = $("av");
  if (av) av.textContent = me.avatar || (u && u[0] ? u[0].toUpperCase() : "");

  if (typeof markAv === "function") markAv();

  const g = me.role === "guest";
  const ctMail = $("ct-mail");
  const ctAge = $("ct-age");
  const ctShotRow = $("ct-shotrow");
  if (ctMail) ctMail.classList.toggle("hide", !g);
  if (ctAge) ctAge.classList.toggle("hide", !g);
  if (ctShotRow) ctShotRow.classList.toggle("hide", g);

  const upform = $("upform");
  if (upform) upform.classList.toggle("hide", !isDev());

  const roleBadge = $("rolebadge");
  if (roleBadge) {
    roleBadge.textContent = RNAME[me.role] || "Member";
    if (me.role === "mod") {
      if (!roleBadge.nextElementSibling || !roleBadge.nextElementSibling.classList.contains("chk")) {
        roleBadge.insertAdjacentHTML("afterend", ' <span class="chk" title="Verified moderator">&check;</span>');
      }
    }
  }

  const navAdmin = $("nav-admin");
  const navLegal = $("nav-legal");
  if (navAdmin) navAdmin.classList.toggle("hide", !isMod() || me.role === "legal");
  if (navLegal) navLegal.classList.toggle("hide", !isLegal());

  const del = $("del");
  if (del) del.classList.toggle("hide", me.role === "guest");

  const cmdIn = $("cmd-in");
  if (cmdIn) cmdIn.classList.toggle("hide", !isDev());

  const accCard = $("acc-card");
  if (accCard) accCard.classList.toggle("hide", !isDev());

  const pwCard = $("pw-card");
  if (pwCard) pwCard.classList.toggle("hide", !isAdmin());

  const botCard = $("bot-card");
  if (botCard) botCard.classList.toggle("hide", !canBot());

  const navStaff = $("nav-staff");
  if (navStaff) navStaff.classList.toggle("hide", !isMod());

  const profileCard = $("profile-card");
  if (profileCard) profileCard.classList.toggle("hide", !(me.age === "3" || me.age === "4"));

  const myTicketsCard = $("mytickets-card");
  if (myTicketsCard) myTicketsCard.classList.toggle("hide", me.role === "guest");

  if (typeof updateCreditAdminVisibility === "function") updateCreditAdminVisibility();
  if (typeof renderCreditsOverview === "function") renderCreditsOverview();
  if (typeof listenMine === "function") listenMine();
  if (typeof loadMotd === "function") loadMotd();
  if (typeof loadAbout === "function") loadAbout();
  if (me.role !== "guest" && (me.age === "3" || me.age === "4") && typeof loadMyProfile === "function") loadMyProfile();
  if (me.role !== "guest" && typeof loadMyTickets === "function") loadMyTickets();
  if (typeof listenStaffChat === "function") listenStaffChat();

  const em = d && sessionKey && d.gmail ? unwrap(d.gmail, sessionKey) : null;
  const bd = d && sessionKey && d.dob ? unwrap(d.dob, sessionKey) : null;
  const mine = $("mine");
  if (mine) mine.textContent = em ? `Email: ${em}${bd ? " · Born: " + bd : ""} (stored encrypted)` : "";

  if (typeof heartbeat === "function") heartbeat(u);
  if (typeof startChat === "function") startChat();
}

function showTab(login) {
  const tabLogin = $("t-login");
  const tabSignup = $("t-signup");
  const loginForm = $("login-form");
  const signupForm = $("signup-form");
  if (tabLogin) tabLogin.classList.toggle("on", login);
  if (tabSignup) tabSignup.classList.toggle("on", !login);
  if (loginForm) loginForm.classList.toggle("hide", !login);
  if (signupForm) signupForm.classList.toggle("hide", login);
  notifyError("");
}

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg || "";
  t.classList.remove("hide");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.add("hide"), 3500);
}

async function patch(u, set, unset = []) {
  const mask = [...Object.keys(set), ...unset].map(k => `&updateMask.fieldPaths=${k}`).join("");
  const fields = {};
  for (const key of Object.keys(set)) {
    const value = set[key];
    if (typeof value === "number") fields[key] = { integerValue: String(value) };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else fields[key] = { stringValue: String(value ?? "") };
  }

  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}${mask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });

  if (!r.ok) throw new Error("patch " + r.status);
}

const fv = v => typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v ?? "") };
const post = (path, set, method) => fetch(`${ROOT}/${path}${KEY}`, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, fv(v)])) })
}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const add = (col, set) => post(col, set, "POST");
const put = (path, set) => post(path, set, "PATCH");

async function sendWelcomeEmail(username, recipientEmail) {
  const mailCollectionUrl = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/mail${KEY}`;
  const likeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/like.html";
  const dislikeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/dislike.html";

  const htmlTemplate = `
    <div style="background-color:#120024;color:#fff;padding:30px;font-family:sans-serif;border-radius:12px;max-width:500px;margin:auto;border:2px solid #4b0082;text-align:center;">
      <h1 style="color:#a992fa;margin-top:0;">🍇 Welcome to GrapeGreen!</h1>
      <p style="font-size:16px;line-height:1.5;color:#fff;text-align:left;">Hey <strong>${esc(username)}</strong>,</p>
      <p style="font-size:14px;line-height:1.6;color:#dcd0ff;text-align:left;margin-bottom:25px;">
        Welcome to GrapeGreen — your personal dashboard with all the memes you want and chat to other people.
      </p>
      <hr style="border:0;border-top:1px solid #4b0082;margin:25px 0;">
      <p style="font-size:13px;color:#a992fa;margin-bottom:15px;">What do you think of your dashboard layout?</p>
      <div style="margin:20px 0;">
        <a href="${likeUrl}" target="_blank" style="background-color:#4c1c9c;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:6px;margin-right:10px;display:inline-block;">👍 Like</a>
        <a href="${dislikeUrl}" target="_blank" style="background-color:#240046;color:#a992fa;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:6px;display:inline-block;">👎 Dislike</a>
      </div>
      <p style="font-size:11px;color:#6a5acd;margin-top:25px;margin-bottom:0;">Your dashboard · Your tabs · Your memes</p>
    </div>
  `;

  const payload = {
    fields: {
      to: { stringValue: recipientEmail },
      message: {
        mapValue: {
          fields: {
            subject: { stringValue: "Welcome to GrapeGreen!" },
            html: { stringValue: htmlTemplate }
          }
        }
      }
    }
  };

  try {
    const r = await fetch(mailCollectionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      console.error("Welcome email failed:", r.status, await r.text());
    }
  } catch (err) {
    console.error("sendWelcomeEmail:", err);
  }
}

function buildWalletId(username) {
  const base = String(username || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toLowerCase() || "user";
  const a = String(Math.floor(Math.random() * 9000) + 1000);
  const b = String(Math.floor(Math.random() * 9000) + 1000);
  const c = String(Math.floor(Math.random() * 9000) + 1000);
  return `${base}-${a}-${b}-${c}`;
}

function getCreditsState(username) {
  const key = "credits_" + username;
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(key) || '{"balance":5,"walletId":"","items":[],"subscriptions":[],"theme":""}');
  } catch {}

  if (!raw.walletId) raw.walletId = buildWalletId(username);
  if (!Number.isFinite(Number(raw.balance))) raw.balance = 5;
  raw.items = Array.isArray(raw.items) ? raw.items : [];
  raw.subscriptions = Array.isArray(raw.subscriptions) ? raw.subscriptions : [];
  return raw;
}

function saveCreditsState(username, data) {
  localStorage.setItem("credits_" + username, JSON.stringify(data));
}

function syncCreditsToFirestore(username, data) {
  if (!window.F12Db || !username || username === "guest") return Promise.resolve();
  const fields = {
    credits: { integerValue: String(Number(data.balance || 0)) },
    walletId: { stringValue: data.walletId || buildWalletId(username) },
    theme: { stringValue: data.theme || "" },
    purchased: { arrayValue: { values: (data.items || []).map(v => ({ stringValue: JSON.stringify(v) })) } },
    subscriptions: { arrayValue: { values: (data.subscriptions || []).map(v => ({ stringValue: String(v) })) } }
  };

  return fetch(`${DB}/${encodeURIComponent(username)}${KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  }).catch(() => {});
}

function renderCreditsOverview() {
  const user = me && me.name ? me.name : (localStorage.getItem("lastUser") || "guest");
  const bal = $("credits-balance");
  const wallet = $("credit-wallet-id");
  const list = $("credits-item-list");

  if (user === "guest") {
    if (bal) bal.textContent = "0 credits";
    if (wallet) wallet.textContent = "Wallet ID: guest";
    return;
  }

  const state = getCreditsState(user);
  if (bal) bal.textContent = `${Number(state.balance || 0)} credits`;
  if (wallet) wallet.textContent = `Wallet ID: ${state.walletId || buildWalletId(user)}`;

  if (list) {
    if (!state.items.length) list.innerHTML = "<li>No items purchased yet.</li>";
    else list.innerHTML = state.items.map(item => `<li>${esc(String(item.name || "Item"))} (${esc(String(item.type || "item"))})</li>`).join("");
  }
}

function updateCreditAdminVisibility() {
  const panel = $("credit-manager-card");
  if (!panel) return;
  const canUse = !!me && !!me.role && ["mod", "admin", "headadmin", "legal", "dev", "owner"].includes(me.role);
  panel.classList.toggle("hide", !canUse);
}

const THEMES = { grape: ["#3b1a63", "#7a4bb8", "#a3d95c"], ocean: ["#0b3c5d", "#1d7fb8", "#7be0d1"], sunset: ["#5a1a2e", "#d0553a", "#ffc857"], mint: ["#0f4a3c", "#2f9e7a", "#e9f77a"], rose: ["#4b1d3f", "#d8578a", "#f9c76b"] };

function setTheme(name) {
  const theme = THEMES[name] || THEMES.grape;
  const root = document.documentElement.style;
  root.setProperty("--grape", theme[0]);
  root.setProperty("--grape2", theme[1]);
  root.setProperty("--leaf", theme[2]);
  document.querySelectorAll(".sw").forEach(node => node.classList.toggle("on", node.dataset.theme === name));
  localStorage.setItem("theme", name);
}

function initThemes() {
  const sws = $("sws");
  if (!sws) return;
  Object.entries(THEMES).forEach(([name, [a, b, c]]) => {
    const el = document.createElement("button");
    el.className = "sw";
    el.dataset.theme = name;
    el.title = name;
    el.setAttribute("aria-label", `${name} theme`);
    el.style.background = `linear-gradient(135deg,${b} 50%,${c} 50%)`;
    el.onclick = () => setTheme(name);
    sws.appendChild(el);
  });
  setTheme(localStorage.getItem("theme") || "grape");
}

function switchTab(id) {
  if (typeof id !== "string") return;
  if (id === "admin" && (!isMod() || me.role === "legal")) return;
  if (id === "legal" && !isLegal()) return;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".side-item").forEach(b => b.classList.toggle("active", b.dataset.tab === id));

  if (me.role !== "guest") patch(me.name, { curTab: id }).catch(() => {});
  if (id === "admin" && typeof loadAdmin === "function") loadAdmin();
  if (id === "legal" && typeof loadLegal === "function") loadLegal();
  if (id === "tos" && typeof loadTos === "function") loadTos();
  if (id === "users" && typeof loadUsers === "function") loadUsers();
  if (id === "updates" && typeof loadUpdates === "function") loadUpdates();
}

function searchTabs() {
  const q = ($("find")?.value || "").toLowerCase().trim();
  if (!q) return;
  const hit = [...document.querySelectorAll(".side-item")].find(b => (b.textContent || "").toLowerCase().includes(q));
  if (hit) switchTab(hit.dataset.tab);
}

function bindUI() {
  const tabLogin = $("t-login");
  const tabSignup = $("t-signup");
  if (tabLogin) tabLogin.onclick = () => showTab(true);
  if (tabSignup) tabSignup.onclick = () => showTab(false);

  document.querySelectorAll("[data-show]").forEach(button => {
    button.onclick = () => {
      const target = $(button.dataset.show);
      if (!target) return;
      const show = target.type === "password";
      target.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
    };
  });

  const suDob = $("su-dob");
  if (suDob) {
    suDob.addEventListener("input", () => {
      const kid = tier(suDob.value) === "1";
      const mailRow = $("mailrow");
      const kidNote = $("kidnote");
      const suMail = $("su-mail");
      if (mailRow) mailRow.classList.toggle("hide", kid);
      if (kidNote) kidNote.classList.toggle("hide", !kid);
      if (suMail) suMail.required = !kid;
      if (kid && suMail) suMail.value = "";
    });
  }

  const signupForm = $("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      notifyError("");
      const u = ($("su-user")?.value || "").trim();
      const dob = $("su-dob")?.value || "";
      const pw = $("su-pass")?.value || "";
      const age = tier(dob);
      if (!age) return notifyError("Enter a valid birth date that isn't in the future.");
      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)) return notifyError("Usernames can use letters, numbers, _ . - (3 to 24 characters).");
      if (pw.length < 6) return notifyError("Use a password with at least 6 characters.");

      const btn = e.submitter;
      if (btn) btn.disabled = true;

      try {
        if (await getUser(u)) return notifyError("That username is taken. Try another one.");
        const salt = CryptoJS.lib.WordArray.random(16).toString();
        const role = u === OWNER ? "owner" : "user";
        sessionKey = deriveKey(pw, salt);
        const em = $("su-mail")?.value || "";
        const box = age === "1" ? {} : { gmail: wrap(em, sessionKey), dob: wrap(dob, sessionKey) };
        if (age !== "1" && (unwrap(box.gmail, sessionKey) !== em || unwrap(box.dob, sessionKey) !== dob)) throw new Error("encryption check failed");
        await saveUser(u, { age, salt, hash: hash(pw, salt), ...box, role });
        localStorage.setItem("lastUser", u);
        if (age !== "1" && em) sendWelcomeEmail(u, em);
        if ($("su-dob")) $("su-dob").value = "";
        if ($("su-mail")) $("su-mail").value = "";
        enter(u, { role, age, ...box });
      } catch (x) {
        console.error(x);
        notifyError("Couldn't create the account. Check your connection and try again.");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  const loginForm = $("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      notifyError("");
      const u = ($("li-user")?.value || "").trim();
      const pw = $("li-pass")?.value || "";
      const btn = e.submitter;
      if (btn) btn.disabled = true;

      try {
        const user = await getUser(u);
        if (!user || hash(pw, user.salt) !== user.hash) return notifyError("Wrong username or password.");
        if (user.deletedAt) return notifyError("This account was deleted. Ask an admin to restore it.");
        if (banLeft(user)) return notifyError("This account is " + banText(user) + ".");
        sessionKey = deriveKey(pw, user.salt);
        localStorage.setItem("lastUser", u);
        enter(u, user);
      } catch (x) {
        console.error(x);
        notifyError("Couldn't log in. Check your connection and try again.");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  const guestBtn = $("guest");
  if (guestBtn) guestBtn.onclick = e => {
    e.preventDefault();
    enter("guest_" + Math.floor(Math.random() * 100000));
  };

  const logoutBtn = $("logout");
  if (logoutBtn) logoutBtn.onclick = () => signOut();

  if ($("li-user")) $("li-user").value = localStorage.getItem("lastUser") || "";

  const findBtn = $("find-btn");
  if (findBtn) findBtn.onclick = searchTabs;
  const finder = $("find");
  if (finder) finder.addEventListener("keydown", e => { if (e.key === "Enter") searchTabs(); });

  const bright = $("bright");
  if (bright) bright.oninput = e => {
    const brightValue = $("bright-v");
    if (brightValue) brightValue.textContent = e.target.value + "%";
    const dim = $("dim");
    if (dim) dim.style.opacity = (100 - Number(e.target.value)) / 100 * 0.85;
  };

  const sound = $("sound");
  if (sound) sound.oninput = e => {
    const soundValue = $("sound-v");
    if (soundValue) soundValue.textContent = e.target.value + "%";
  };

  const fSize = $("fsize");
  if (fSize) fSize.oninput = e => {
    const val = e.target.value;
    const fSizeText = $("fsize-v");
    if (fSizeText) fSizeText.textContent = val + "px";
    const msgs = $("msgs");
    if (msgs) msgs.style.fontSize = val + "px";
    localStorage.setItem("fsize", val);
  };

  const ts = $("ts");
  if (ts) ts.onchange = () => {
    if (typeof render === "function") render();
  };

  const fs0 = localStorage.getItem("fsize");
  if (fs0 && fSize) {
    fSize.value = fs0;
    fSize.oninput({ target: fSize });
  }

  const themeBuyBtn = $("theme-buy-btn");
  const themeBuySelect = $("theme-buy-select");
  if (themeBuyBtn && themeBuySelect) themeBuyBtn.onclick = () => buyTheme(themeBuySelect.value);

  const subBuyBtn = $("subscription-buy-btn");
  const subBuySelect = $("subscription-buy-select");
  if (subBuyBtn && subBuySelect) subBuyBtn.onclick = () => buySubscription(subBuySelect.value);

  const creditEarnBtn = $("credit-earn-btn");
  if (creditEarnBtn) creditEarnBtn.onclick = () => awardFreeCreditIfActive();

  const myPwSave = $("mypw-save");
  if (myPwSave) myPwSave.onclick = async () => {
    const msgBox = $("mypw-msg");
    const msg = t => { if (msgBox) msgBox.textContent = t; };
    if (me.role === "guest") return;

    const cur = ($("mypw-cur")?.value || "");
    const next = ($("mypw-new")?.value || "");
    const minLen = rk(me.role) >= 6 ? 20 : 6;
    if (next.length < minLen) return msg(`Devs and the owner need ${minLen}+ characters.`.replace("6+", "6+"));

    try {
      const d = await getUser(me.name);
      if (!d || hash(cur, d.salt) !== d.hash) return msg("Current password is wrong.");
      const hist = safeJsonParse(d.pwHistory || "[]", []);
      if (hist.some(h => hash(next, h.salt) === h.hash) || hash(next, d.salt) === d.hash) return msg("Don't reuse a recent password.");
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      const newHist = [{ salt: d.salt, hash: d.hash }, ...hist].slice(0, 5);
      await patch(me.name, { salt, passwordHash: hash(next, salt), pwHistory: JSON.stringify(newHist) });
      sessionKey = deriveKey(next, salt);
      if ($("mypw-cur")) $("mypw-cur").value = "";
      if ($("mypw-new")) $("mypw-new").value = "";
      msg("Password changed.");
    } catch {
      msg("Couldn't change the password.");
    }
  };

  const delBtn = $("del");
  if (delBtn) delBtn.onclick = () => {
    if (me.role === "guest") return;
    if (me.role === "owner") return toast("The owner account can't be deleted.");
    const delPw = $("del-pw");
    const delBox = $("delbox");
    if (delPw) delPw.value = "";
    const delErr = $("del-err");
    if (delErr) delErr.textContent = "";
    if (delBox) delBox.classList.remove("hide");
    if (delPw) delPw.focus();
  };

  const delCancel = $("del-cancel");
  if (delCancel) delCancel.onclick = () => {
    const delBox = $("delbox");
    if (delBox) delBox.classList.add("hide");
  };

  const delPw = $("del-pw");
  if (delPw) delPw.addEventListener("keydown", e => { if (e.key === "Enter") $("del-ok")?.click(); });

  const delOk = $("del-ok");
  if (delOk) delOk.onclick = async () => {
    try {
      const d = await getUser(me.name);
      if (!d || hash(($("del-pw")?.value || ""), d.salt) !== d.hash) {
        const errEl = $("del-err");
        if (errEl) errEl.textContent = "Wrong password.";
        return;
      }
      await patch(me.name, { deletedAt: Date.now(), purgeAt: Date.now() + 90 * 864e5 });
      location.reload();
    } catch {
      const errEl = $("del-err");
      if (errEl) errEl.textContent = "Couldn't delete the account. Try again.";
    }
  };

  const nuSave = $("nu-save");
  if (nuSave) nuSave.onclick = async () => {
    const msgBox = $("nu-msg");
    const msg = t => { if (msgBox) msgBox.textContent = t; };
    if (!isDev()) return;
    const u = ($("nu-user")?.value || "").trim();
    const dob = $("nu-dob")?.value || "";
    const pw = $("nu-pass")?.value || "";
    const em = $("nu-mail")?.value || "";
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)) return msg("Usernames can use letters, numbers, _ . - (3 to 24 characters).");
    const age = tier(dob);
    if (!age) return msg("Enter a valid birth date.");
    if (pw.length < 6) return msg("Password needs 6+ characters.");
    try {
      if (await getUser(u)) return msg("That username is taken.");
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      const k = deriveKey(pw, salt);
      const box = age === "1" ? {} : { gmail: wrap(em, k), dob: wrap(dob, k) };
      await saveUser(u, { age, salt, hash: hash(pw, salt), ...box, role: "user" });
      msg("Account created — share the username and temporary password with them. They'll know the password, so suggest they change it.");
      if ($("nu-user")) $("nu-user").value = "";
      if ($("nu-dob")) $("nu-dob").value = "";
      if ($("nu-mail")) $("nu-mail").value = "";
      if ($("nu-pass")) $("nu-pass").value = "";
    } catch {
      msg("Couldn't create the account.");
    }
  };

  const idField = $("pw-user");
  const pwReqBtn = $("pw-req");
  if (pwReqBtn) pwReqBtn.onclick = async () => {
    const msgBox = $("pw-msg");
    const msg = t => { if (msgBox) msgBox.textContent = t; };
    if (!isAdmin()) return msg("Only admins and above can start a request.");
    const u = (idField?.value || "").trim();
    const pw = ($("pw-new")?.value || "");
    try {
      const target = await getUser(u);
      if (!target) return msg("No account with that username.");
      const minLen = rk(target.role || "user") >= 6 ? 20 : 6;
      if (pw.length < minLen) return msg(`That account needs a ${minLen}+ character password.`);
      const hist = safeJsonParse(target.pwHistory || "[]", []);
      if (hist.some(h => hash(pw, h.salt) === h.hash) || hash(pw, target.salt) === target.hash) return msg("That matches one of their recent passwords.");
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      const payload = { target: u, salt, hash: hash(pw, salt) };
      if (me.role === "owner") {
        const newHist = target ? [{ salt: target.salt, hash: target.hash }, ...hist].slice(0, 5) : hist;
        await patch(u, { salt: payload.salt, passwordHash: payload.hash, pwHistory: JSON.stringify(newHist) });
        msg("Done - no approval needed for the owner.");
      } else {
        await add("pwreq", { target: u, salt: payload.salt, hash: payload.hash, by: me.name, approvals: "" });
        msg("Requested. Needs 2 admins/head admins, or 1 dev/owner, to approve.");
      }
      if (idField) idField.value = "";
      if ($("pw-new")) $("pw-new").value = "";
      if (typeof loadPwReqs === "function") loadPwReqs();
    } catch {
      msg("Couldn't submit the request.");
    }
  };

  if ($("copy")) {
    $("copy").onclick = async () => {
      const text = ($("skeleton")?.textContent || "");
      try { await navigator.clipboard.writeText(text); $("copy").textContent = "Copied"; }
      catch { $("copy").textContent = "Press Ctrl+C"; }
      setTimeout(() => { if ($("copy")) $("copy").textContent = "Copy"; }, 1500);
    };
  }
}

function signOut(msg) {
  const endGuest = () => {
    if (me.role === "guest") {
      if (typeof fetch !== "undefined") {
        fetch(`${DB}/${encodeURIComponent(me.name)}${KEY}`, { method: "DELETE" }).catch(() => {});
      }
    }
  };

  endGuest();
  clearInterval(window.beat);
  if (msg) sessionStorage.setItem("kick", msg);
  location.reload();
}

function heartbeat(u) {
  clearInterval(window.beat);
  const url = `https://${CFG.projectId}-default-rtdb.firebaseio.com/presence/${encodeURIComponent((u || me.name).replace(/\./g, ","))}.json`;
  const ping = () => fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "online", lastPing: Date.now() })
  }).catch(() => {});
  ping();
  window.beat = setInterval(ping, 60000);
}

function render() {
  const box = $("msgs");
  if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const tsChecked = $("ts")?.checked;
  const kidViewer = me.age === "1";
  const html = (window.__lastMsgs || []).map(m => {
    const kidMsg = m.k === "1";
    if (kidViewer && !kidMsg) return "";
    const acts = m.local ? "" : (isMod() ? ` <a href="#" data-del="${esc(m.id)}" class="mute">delete</a>` : "") + (me.role !== "guest" && m.u !== me.name ? ` <a href="#" data-rep="${esc(m.id)}" class="mute">report</a>` : "");
    const time = tsChecked && !m.local ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
    const tag = m.r === "bot" ? '<span class="tag">bot</span>' : rk(m.r) >= 3 ? `<span class="tag">${m.r}</span>` : kidMsg ? '<span class="tag">kid</span>' : "";
    const av = AVATARS.includes(m.a) ? m.a + " " : "";
    return `<p class="msg">${time}${av}<b>${esc(m.u)}</b>${tag}: ${esc(m.x || "")}${acts}</p>`;
  }).join("");

  box.innerHTML = html || '<p class="mute">No messages yet. Say hi!</p>';
  if (near) box.scrollTop = box.scrollHeight;
}

let lastMsgs = [];
window.__lastMsgs = lastMsgs;

function pollChat() {
  if (!$("chat")) return;
  const box = $("msgs");
  if (!box) return;
  const old = window.__lastMsgs || [];
  if (!old.length) {
    window.__lastMsgs = [{ id: "local-1", u: "System", x: "Chat ready.", r: "system", t: Date.now(), local: true }];
  }
  render();
}

function startChat() {
  const guest = me.role === "guest";
  const input = $("chat-in");
  if (input) {
    input.disabled = guest;
    input.placeholder = guest ? "Log in to send messages (guests are read-only)" : "Say something...";
  }
  pollChat();
}

const AVATARS = Array.from("🐶🐱🦊🐼🐸🦁🐯🐵🐧🦉🐙🦄🐢🐳🦋🐝🐲🦖🤖👽👻🎃🍇🍉🍕🍩⚽🎮🚀🌈");

function markAv() {
  document.querySelectorAll(".av-b").forEach(b => b.classList.toggle("on", b.textContent === me.avatar));
}

function initAvatars() {
  const avs = $("avs");
  if (!avs) return;
  AVATARS.forEach(icon => {
    const b = document.createElement("button");
    b.className = "av-b";
    b.textContent = icon;
    b.setAttribute("aria-label", "Avatar " + icon);
    b.onclick = async () => {
      if (me.role === "guest") return toast("Log in to pick an avatar.");
      try {
        await patch(me.name, { avatar: icon });
        me.avatar = icon;
        const av = $("av");
        if (av) av.textContent = icon;
        markAv();
      } catch {
        toast("Couldn't save your avatar.");
      }
    };
    avs.appendChild(b);
  });
}

async function loadPwReqs() {
  if (!isAdmin()) {
    const list = $("pw-list");
    if (list) list.innerHTML = "";
    return;
  }
  const list = $("pw-list");
  if (!list) return;
  try {
    const r = await fetch(`${ROOT}/pwreq${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    list.innerHTML = rows.length ? rows.map(o => `<div>${esc(o.target || "")}</div>`).join("") : '<p class="mute">No pending requests.</p>';
  } catch {
    list.textContent = "Couldn't load requests.";
  }
}

async function loadAdmin() {
  if (!isMod()) return;
  if (typeof loadPwReqs === "function") loadPwReqs();
  if (typeof loadBots === "function") loadBots();
  if (typeof loadReports === "function") loadReports("a-reports");
}

async function loadReports(target) {
  const box = $(target);
  if (!box) return;
  try {
    const r = await fetch(`${ROOT}/reports${KEY}&orderBy=t%20desc&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    box.innerHTML = rows.length ? rows.map(o => `<div class="card">${esc(o.type || "report")} — ${esc(o.by || "guest")}</div>`).join("") : '<p class="mute">Nothing yet.</p>';
  } catch {
    box.textContent = "Couldn't load reports.";
  }
}

async function loadBots() {
  if (!canBot()) {
    const list = $("bot-list");
    if (list) list.innerHTML = "";
    return;
  }
  const list = $("bot-list");
  if (!list) return;
  try {
    const r = await fetch(`${ROOT}/bots${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    list.innerHTML = rows.length ? rows.map(b => `<div class="card">${esc(b.name || "Bot")} — ${esc(b.words || "")}</div>`).join("") : '<p class="mute">No bots configured.</p>';
  } catch {
    list.textContent = "Couldn't load bots.";
  }
}

async function loadUpdates() {
  const list = $("upl");
  if (!list) return;
  const data = [
    { v: "v1.0", title: "Fresh start", notes: "+ New login screen\n+ Firestore sign-up and login" },
    { v: "v1.1", title: "Chat & Admin", notes: "+ Global chat\n+ Admin panel" },
    { v: "v1.2", title: "Security+", notes: "+ Email encrypted\n+ Age gating" }
  ];
  list.innerHTML = data.map(item => `<div class="card"><h3>${esc(item.v)}</h3><b>${esc(item.title)}</b><p>${esc(item.notes)}</p></div>`).join("");
}

async function loadTos() {
  const textEl = $("tos-text");
  const area = $("tos-area");
  if (!textEl) return;
  try {
    const r = await fetch(`${ROOT}/meta/tos${KEY}`);
    const text = r.ok ? (parseDoc(await r.json()).text || "") : "";
    textEl.textContent = text || "No Terms of Service have been posted yet.";
    if (area) area.value = text;
  } catch {
    textEl.textContent = "Couldn't load the Terms of Service.";
  }
}

async function loadMotd() {
  const banner = $("motd-banner");
  const text = $("motd-text");
  if (!banner || !text) return;
  try {
    const r = await fetch(`${ROOT}/meta/motd${KEY}`);
    const content = r.ok ? (parseDoc(await r.json()).text || "") : "";
    text.textContent = content || "";
    banner.classList.toggle("hide", !content);
  } catch {}
}

async function loadAbout() {
  const el = $("about-text");
  const area = $("about-area");
  if (!el) return;
  try {
    const r = await fetch(`${ROOT}/meta/about${KEY}`);
    const content = r.ok ? (parseDoc(await r.json()).text || "") : "";
    el.textContent = content || "";
    if (area) area.value = content || "";
  } catch {}
}

function awardFreeCreditIfActive() {
  const user = me && me.name ? me.name : localStorage.getItem("lastUser");
  if (!user || user === "guest") return;
  const state = getCreditsState(user);
  const activeMinutes = (window.GrapeGreenTokens && window.GrapeGreenTokens.creditConfig && window.GrapeGreenTokens.creditConfig.activeMinutesToEarnOne) || 20;
  const now = Date.now();
  const awardEvery = activeMinutes * 60 * 1000;
  if (now - Number(state.activeAwardAt || 0) >= awardEvery) {
    state.balance = Number(state.balance || 0) + 1;
    state.activeAwardAt = now;
    state.items.unshift({ name: "20-minute active reward", type: "reward", amount: 1, createdAt: now });
    state.items = state.items.slice(0, 40);
    saveCreditsState(user, state);
    syncCreditsToFirestore(user, state);
    renderCreditsOverview();
    toast("You earned 1 free credit for being active.");
  }
}

function buyTheme(themeId) {
  const user = me && me.name ? me.name : localStorage.getItem("lastUser");
  if (!user || user === "guest") return toast("Log in to buy a theme.");
  const state = getCreditsState(user);
  const theme = (window.GrapeGreenTokens && window.GrapeGreenTokens.creditConfig && window.GrapeGreenTokens.creditConfig.themes || []).find(t => t.id === themeId);
  if (!theme) return toast("Theme not found.");
  if (state.balance < theme.price) return toast(`You need ${theme.price} credits for ${theme.name}.`);
  state.balance -= theme.price;
  state.theme = themeId;
  state.items.unshift({ name: theme.name, type: "theme", price: theme.price, createdAt: Date.now() });
  state.items = state.items.slice(0, 40);
  saveCreditsState(user, state);
  syncCreditsToFirestore(user, state);
  renderCreditsOverview();
  toast(`${theme.name} purchased.`);
}

function buySubscription(subId) {
  const user = me && me.name ? me.name : localStorage.getItem("lastUser");
  if (!user || user === "guest") return toast("Log in to buy a subscription.");
  const state = getCreditsState(user);
  const sub = (window.GrapeGreenTokens && window.GrapeGreenTokens.creditConfig && window.GrapeGreenTokens.creditConfig.subscriptions || []).find(s => s.id === subId);
  if (!sub) return toast("Subscription not found.");
  if (state.balance < sub.price) return toast(`You need ${sub.price} credits for ${sub.name}.`);
  state.balance -= sub.price;
  state.subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
  state.subscriptions.push(sub.id);
  state.items.unshift({ name: `${sub.name} (${sub.interval})`, type: "subscription", price: sub.price, createdAt: Date.now() });
  state.items = state.items.slice(0, 40);
  saveCreditsState(user, state);
  syncCreditsToFirestore(user, state);
  renderCreditsOverview();
  toast(`${sub.name} activated.`);
}

(async function bootstrap() {
  initThemes();
  initAvatars();
  bindUI();
  if (typeof loadMotd === "function") loadMotd();
  if (typeof loadAbout === "function") loadAbout();
  if (typeof loadTos === "function") loadTos();
  if (typeof loadUpdates === "function") loadUpdates();
  if (me && me.role !== "guest") {
    const state = getCreditsState(me.name);
    if (!state.walletId) state.walletId = buildWalletId(me.name);
    if (!Number.isFinite(Number(state.balance))) state.balance = 5;
    saveCreditsState(me.name, state);
    renderCreditsOverview();
  }

  const kick = sessionStorage.getItem("kick");
  if (kick) {
    notifyError(kick);
    sessionStorage.removeItem("kick");
  }

  if ($("skeleton")) {
    const skeleton = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <style>
    body { background:#f5f5f5; font-family:sans-serif; padding:20px; }
    .btn { background:#00ff00; height:50px; width:150px; cursor:pointer; font-weight:bold; }
    .counter { font-size:24px; margin-top:150px; font-weight:bold; }
  </style>
</head>
<body>
  <button class="btn" onclick="addPoop()">poopysa buttcheek</button>
  <p>search HELLO_its_me</p>
  <p class="counter">Total: <span id="score">0</span></p>
  <script>
    let poop = 0;
    function addPoop() {
      poop += 7;
      document.getElementById('score').innerText = poop;
    }
  <\/script>
</body>
</html>`;
    $("skeleton").textContent = skeleton;
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (typeof updateOwnerSpan === "function") updateOwnerSpan();
  });

  setInterval(() => {
    if (!$("gate") || !$("gate").classList.contains("hide")) return;
    if (Date.now() - lastAct > 36e5) signOut("You were signed out after 60 idle minutes.");
    else if (me.role === "guest" && Date.now() - began > 36e5) signOut("Guest sessions end after 1 hour.");
  }, 30000);

  setInterval(() => {
    if (!me || me.role === "guest") return;
    awardFreeCreditIfActive();
  }, 60000);

  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
})();

const SKELETON = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <style>
    body { background:#f5f5f5; font-family:sans-serif; padding:20px; }
    .btn { background:#00ff00; height:50px; width:150px; cursor:pointer; font-weight:bold; }
    .counter { font-size:24px; margin-top:150px; font-weight:bold; }
  </style>
</head>
<body>
  <button class="btn" onclick="addPoop()">poopysa buttcheek</button>
  <p>search HELLO_its_me</p>
  <p class="counter">Total: <span id="score">0</span></p>
  <script>
    let poop = 0;
    function addPoop() {
      poop += 7;
      document.getElementById('score').innerText = poop;
    }
  <\/script>
</body>
</html>`;

if ($("skeleton")) $("skeleton").textContent = SKELETON;

function updateOwnerSpan() {
  const el = document.getElementById("OwnerName");
  if (!el) return;
  const name = (typeof me !== "undefined" && me.role === "owner" && me.name)
    ? me.name
    : (typeof OwnerName !== "undefined" ? OwnerName : el.getAttribute("var") || el.textContent);
  el.textContent = name;
}

window.updateOwnerSpan = updateOwnerSpan;
window.addEventListener("DOMContentLoaded", updateOwnerSpan);

(function initGoogleButtons() {
  const loginTarget = document.getElementById("google-login-container");
  const signupTarget = document.getElementById("google-signup-container");
  if (!loginTarget && !signupTarget) return;
  if (!window.F12Methods || !window.F12Auth) {
    setTimeout(initGoogleButtons, 50);
    return;
  }

  const { signInWithPopup, getDocs, collection, query, where } = window.F12Methods;
  const auth = window.F12Auth;
  const db = window.F12Db;
  const provider = window.F12Provider;

  const btnStyle = "display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:10px;background:white;color:#444;border:1px solid #dadce0;border-radius:8px;font-weight:600;cursor:pointer;";
  const gLogo = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:18px;height:18px;">';

  if (loginTarget && !document.getElementById("google-login-btn")) {
    const loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.id = "google-login-btn";
    loginBtn.style = btnStyle;
    loginBtn.innerHTML = `${gLogo} Sign in with Google`;
    loginBtn.onclick = async e => {
      e.preventDefault();
      notifyError("");
      loginBtn.disabled = true;
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const snapshot = await getDocs(query(collection(db, "users"), where("googleUid", "==", user.uid)));
        if (snapshot.empty) return notifyError("No GrapeGreen profile found for this Google account. Please use Sign Up first!");
        const userDoc = snapshot.docs[0];
        const dbUser = userDoc.data();
        const username = userDoc.id;
        if (dbUser.deletedAt) return notifyError("This account was deleted. Ask an admin to restore it.");
        if (typeof banLeft !== "undefined" && banLeft(dbUser)) return notifyError("This account is " + banText(dbUser) + ".");
        sessionKey = deriveKey(user.uid, dbUser.salt);
        localStorage.setItem("lastUser", username);
        enter(username, dbUser);
      } catch (x) {
        console.error(x);
        notifyError("Google login failed. Please try again.");
      } finally {
        loginBtn.disabled = false;
      }
    };
    loginTarget.appendChild(loginBtn);
  }

  if (signupTarget && !document.getElementById("google-signup-btn")) {
    const signupBtn = document.createElement("button");
    signupBtn.type = "button";
    signupBtn.id = "google-signup-btn";
    signupBtn.style = btnStyle;
    signupBtn.innerHTML = `${gLogo} Sign up with Google`;
    signupBtn.onclick = async e => {
      e.preventDefault();
      notifyError("");
      signupBtn.disabled = true;
      try {
        const result = await signInWithPopup(auth, provider);
        const googleUser = result.user;
        const em = googleUser.email;
        const dob = prompt("Confirm your Date of Birth (YYYY-MM-DD or MM/DD/YYYY):", "2010-01-01");
        if (!dob) return notifyError("Sign up canceled. Date of Birth is required.");
        const age = tier(dob);
        if (!age) return notifyError("Enter a valid birth date that isn't in the future.");
        const rawName = googleUser.displayName || "User";
        let u = rawName.replace(/[^A-Za-z0-9_.-]/g, "");
        if (u.length < 3) u = "User_" + Math.floor(Math.random() * 1000);
        if (await getUser(u)) u = u + Math.floor(Math.random() * 10000);
        const salt = CryptoJS.lib.WordArray.random(16).toString();
        const ownerBackup = typeof OWNER !== "undefined" ? OWNER : "MattyGrapeGreenOwner";
        const role = u === ownerBackup ? "owner" : "user";
        sessionKey = deriveKey(googleUser.uid, salt);
        const box = age === "1" ? {} : { gmail: wrap(em, sessionKey), dob: wrap(dob, sessionKey) };
        if (age !== "1" && (unwrap(box.gmail, sessionKey) !== em || unwrap(box.dob, sessionKey) !== dob)) {
          throw new Error("encryption check failed");
        }
        await saveUser(u, { age, salt, hash: hash(googleUser.uid, salt), ...box, role, googleUid: googleUser.uid });
        localStorage.setItem("lastUser", u);
        if (age !== "1" && em && typeof sendWelcomeEmail !== "undefined") sendWelcomeEmail(u, em);
        enter(u, { role, age, ...box });
      } catch (x) {
        console.error(x);
        notifyError("Google registration failed. Ensure your console configuration is active.");
      } finally {
        signupBtn.disabled = false;
      }
    };
    signupTarget.appendChild(signupBtn);
  }
})();

(function initAdRotation() {
  const boxes = document.querySelectorAll(".grape-ad-box");
  if (!boxes.length) return;
  const ADSENSE_PUB_ID = "ca-pub-XXXXXXXXXXXXXXXX";
  const ROTATION_TIME = 45000;

  function refreshAdContainer(box) {
    const slotId = box.getAttribute("data-slot");
    if (!slotId) return;
    box.classList.add("rotating-now");
    setTimeout(() => box.classList.remove("rotating-now"), 1500);
    box.innerHTML = "";

    const newIns = document.createElement("ins");
    newIns.className = "adsbygoogle";
    newIns.style.display = "block";
    newIns.setAttribute("data-ad-client", ADSENSE_PUB_ID);
    newIns.setAttribute("data-ad-slot", slotId);
    newIns.setAttribute("data-ad-format", "auto");
    newIns.setAttribute("data-full-width-responsive", "true");

    const newScript = document.createElement("script");
    newScript.innerText = "(adsbygoogle = window.adsbygoogle || []).push({});";

    box.appendChild(newIns);
    box.appendChild(newScript);
  }

  boxes.forEach((adBox, index) => {
    refreshAdContainer(adBox);
    const offset = (index * 400) + (Math.random() * 3000);
    setTimeout(() => {
      refreshAdContainer(adBox);
      setInterval(() => refreshAdContainer(adBox), ROTATION_TIME);
    }, offset);
  });
})();

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    if (typeof initGoogleButtons === "function") initGoogleButtons();
  });
}

window.__lastMsgs = lastMsgs;
if (typeof showTab === "function") showTab(true);
if (typeof setTheme === "function") setTheme(localStorage.getItem("theme") || "grape");

const BAD = ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "slut", "whore", "piss"];
const LEET = { a: "[a4@]", e: "[e3]", i: "[i1!]", o: "[o0]", s: "[s5$]", t: "[t7]" };
const BAD_RX = new RegExp(BAD.map(w => "(?<![a-z])" + [...w].map(c => LEET[c] || c).join("[\\W_]*") + "(?![a-z])").join("|"), "gi");
const filt = t => String(t || "").replace(BAD_RX, m => "*".repeat(m.length));

const LEGAL_WORDS = ["court", "sue", "sued", "suing", "lawsuit", "attorney", "lawyer", "legal action", "subpoena"];
const HUMAN_WORDS = ["human", "representative", "real person", "talk to someone", "speak to someone", "speak with someone", "agent"];

// alias for old code paths
window.F12Db = window.F12Db || null;
window.GrapeGreenTokens = window.GrapeGreenTokens || { creditConfig: { themes: [], subscriptions: [], activeMinutesToEarnOne: 20 } };

// Ensure the site does not crash if DOM ids are missing
window.addEventListener("error", e => {
  if (window.__devNoise) console.error(e.error || e.message || e);
});

if (typeof console !== "undefined") console.info("GrapeGreen app.js repaired.");

if (typeof window !== "undefined") {
  window.safeJsonParse = safeJsonParse;
  window.parseDoc = parseDoc;
  window.CFG = CFG;
}

// end of file
