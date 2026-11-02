const $ = id => document.getElementById(id);
const CFG = {
  projectId: "app-iguess-39f2f",
  apiKey: "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es"
};

const DB = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/users`;
const ROOT = DB.replace(/\/users$/, "");
const KEY = `?key=${CFG.apiKey}`;

const hash = (pw, salt) => CryptoJS.PBKDF2(pw, salt, { keySize: 8, iterations: 10000 }).toString();

function safeJsonParse(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseDoc(doc) {
  const o = { id: decodeURIComponent((doc?.name || "").split("/").pop() || "") }, f = doc?.fields || {};
  for (const k in f) {
    const v = f[k];
    if (v?.stringValue !== undefined) o[k] = v.stringValue;
    else if (v?.integerValue !== undefined) o[k] = Number(v.integerValue);
    else if (v?.booleanValue !== undefined) o[k] = v.booleanValue;
    else if (v?.arrayValue !== undefined) {
      o[k] = (v.arrayValue.values || []).map(item => {
        if (item?.stringValue !== undefined) return item.stringValue;
        if (item?.integerValue !== undefined) return Number(item.integerValue);
        if (item?.booleanValue !== undefined) return item.booleanValue;
        return item;
      });
    } else if (v?.mapValue !== undefined) {
      o[k] = v.mapValue;
    }
  }
  o.hash = o.passwordHash;
  return o;
}

async function getUser(u) {
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
  const f = {
    username: { stringValue: u },
    age: { stringValue: p.age },
    salt: { stringValue: p.salt },
    passwordHash: { stringValue: p.hash },
    role: { stringValue: p.role }
  };
  if (p.googleUid) f.googleUid = { stringValue: p.googleUid };
  if (p.age !== "1") {
    f.gmail = { stringValue: p.gmail || "" };
    f.dob = { stringValue: p.dob || "" };
  }
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: f })
  });
  if (!r.ok) throw new Error("write " + r.status);
}

async function sendWelcomeEmail(username, recipientEmail) {
  const mailCollectionUrl = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/mail${KEY}`;
  const likeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/like.html";
  const dislikeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/dislike.html";

  const htmlTemplate = `
    <div style="background-color:#120024;color:#fff;padding:30px;font-family:sans-serif;border-radius:12px;max-width:500px;margin:auto;border:2px solid #4b0082;text-align:center;">
      <h1 style="color:#a992fa;margin-top:0;">🍇 Welcome to GrapeGreen!</h1>
      <p style="font-size:16px;line-height:1.5;color:#fff;text-align:left;">Hey <strong>${username}</strong>,</p>
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
      throw new Error("send welcome email failed");
    }
  } catch (error) {
    console.error("sendWelcomeEmail:", error);
  }
}

let beat = null;
const presenceUrl = u => `https://${CFG.projectId}-default-rtdb.firebaseio.com/presence/${encodeURIComponent(u.replace(/\./g, ","))}.json`;
function heartbeat(u) {
  clearInterval(beat);
  const url = presenceUrl(u);
  const ping = () => fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "online", lastPing: Date.now() }) }).catch(() => {});
  ping();
  beat = setInterval(ping, 60000);
}

const endGuest = () => { if (me.role === "guest") fetch(presenceUrl(me.name), { method: "DELETE", keepalive: true }).catch(() => {}); };
addEventListener("pagehide", endGuest);
function signOut(msg) { endGuest(); clearInterval(beat); if (msg) sessionStorage.setItem("kick", msg); location.reload(); }

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

const err = m => { $("err").textContent = m || ""; };
let me = { name: "", role: "guest", age: "" };

function enter(u, d) {
  me = { name: u, role: d ? d.role || "user" : "guest", age: d ? d.age || "" : "", avatar: d ? d.avatar || "" : "" };
  const gate = $("gate"); if (gate) gate.classList.add("hide");
  const who = $("who"); if (who) who.textContent = u;
  const av = $("av"); if (av) av.textContent = me.avatar || (u && u[0] ? u[0].toUpperCase() : "");
  if (typeof markAv === "function") markAv();
  if (typeof updateCreditAdminVisibility === "function") updateCreditAdminVisibility();
  if (typeof renderCreditsOverview === "function") renderCreditsOverview();
  if (typeof listenMine === "function") listenMine();
  if (typeof loadMotd === "function") loadMotd();
  if (typeof loadAbout === "function") loadAbout();
}

function showTab(login) {
  $("t-login").classList.toggle("on", login);
  $("t-signup").classList.toggle("on", !login);
  $("login-form").classList.toggle("hide", !login);
  $("signup-form").classList.toggle("hide", login);
  err("");
}
$("t-login").onclick = () => showTab(true);
$("t-signup").onclick = () => showTab(false);

document.querySelectorAll("[data-show]").forEach(b => b.onclick = () => {
  const target = $(b.dataset.show);
  if (!target) return;
  const show = target.type === "password";
  target.type = show ? "text" : "password";
  b.textContent = show ? "Hide" : "Show";
});

$("guest").onclick = e => { e.preventDefault(); enter("guest_" + Math.floor(Math.random() * 100000)); };
$("logout").onclick = () => signOut();

function switchTab(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".side-item").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  if (me.role !== "guest") patch(me.name, { curTab: id }).catch(() => {});
}

const esc = s => String(s ?? "").replace(/[&<>\"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
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

const W = CryptoJS.lib.WordArray;
const deriveKey = (pw, salt) => CryptoJS.PBKDF2(pw, salt + ":details", { keySize: 8, iterations: 10000 });
function wrap(text, key) {
  const b64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(String(text ?? "")));
  const iv = W.random(16);
  const ct = CryptoJS.AES.encrypt(b64, key, { iv }).ciphertext;
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

async function patch(u, set, unset = []) {
  const fields = {};
  for (const key of Object.keys(set)) {
    const value = set[key];
    if (typeof value === "number") fields[key] = { integerValue: String(value) };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else fields[key] = { stringValue: String(value ?? "") };
  }
  const mask = [...Object.keys(set), ...unset].map(k => `&updateMask.fieldPaths=${k}`).join("");
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}${mask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error("patch " + r.status);
}

const CHAT_KEY = CryptoJS.SHA256("GrapeGreen chat key v1");
const dec = x => unwrap(x || "", CHAT_KEY) ?? x;

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
  try { raw = JSON.parse(localStorage.getItem(key) || '{"balance":5,"walletId":"","items":[],"subscriptions":[],"theme":""}'); } catch {}
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
  const user = me && me.name ? me.name : localStorage.getItem("lastUser") || "guest";
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
function setTheme(n) {
  const [a, b, c] = THEMES[n] || THEMES.grape;
  const root = document.documentElement.style;
  root.setProperty("--grape", a); root.setProperty("--grape2", b); root.setProperty("--leaf", c);
  document.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x.dataset.theme === n));
  localStorage.setItem("theme", n);
}

function initThemes() {
  const sws = $("sws"); if (!sws) return;
  Object.entries(THEMES).forEach(([name, [a, b, c]]) => {
    const el = document.createElement("button");
    el.className = "sw"; el.dataset.theme = name; el.title = name; el.style.background = `linear-gradient(135deg,${b} 50%,${c} 50%)`; el.onclick = () => setTheme(name); sws.appendChild(el);
  });
  setTheme(localStorage.getItem("theme") || "grape");
}

function search() {
  const q = ($("find")?.value || "").toLowerCase().trim();
  if (!q) return;
  const hit = [...document.querySelectorAll(".side-item")].find(b => (b.textContent || "").toLowerCase().includes(q));
  if (hit) switchTab(hit.dataset.tab);
}

$("find-btn").onclick = search;
$("find").addEventListener("keydown", e => { if (e.key === "Enter") search(); });

function bindUI() {
  $("t-login").onclick = () => showTab(true);
  $("t-signup").onclick = () => showTab(false);
  document.querySelectorAll("[data-show]").forEach(b => b.onclick = () => {
    const target = $(b.dataset.show); if (!target) return;
    const show = target.type === "password";
    target.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  });

  $("su-dob").addEventListener("input", () => {
    const kid = tier($("su-dob").value) === "1";
    $("mailrow").classList.toggle("hide", kid);
    $("kidnote").classList.toggle("hide", !kid);
    $("su-mail").required = !kid;
    if (kid) $("su-mail").value = "";
  });

  $("signup-form").addEventListener("submit", async e => {
    e.preventDefault(); err("");
    const u = $("su-user").value.trim();
    const dob = $("su-dob").value;
    const pw = $("su-pass").value;
    const age = tier(dob);
    if (!age) return err("Enter a valid birth date that isn't in the future.");
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)) return err("Usernames can use letters, numbers, _ . - (3 to 24 characters).");
    if (pw.length < 6) return err("Use a password with at least 6 characters.");
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      if (await getUser(u)) return err("That username is taken. Try another one.");
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      const role = u === "MattyGrapeGreenOwner" ? "owner" : "user";
      const sessionKey = deriveKey(pw, salt);
      const em = $("su-mail").value || "";
      const box = age === "1" ? {} : { gmail: wrap(em, sessionKey), dob: wrap(dob, sessionKey) };
      if (age !== "1" && (unwrap(box.gmail, sessionKey) !== em || unwrap(box.dob, sessionKey) !== dob)) throw new Error("encryption check failed");
      await saveUser(u, { age, salt, hash: hash(pw, salt), ...box, role });
      localStorage.setItem("lastUser", u);
      if (age !== "1" && em) sendWelcomeEmail(u, em);
      $("su-dob").value = ""; $("su-mail").value = "";
      enter(u, { role, age, ...box });
    } catch (x) {
      console.error(x); err("Couldn't create the account. Check your connection and try again.");
    } finally { if (btn) btn.disabled = false; }
  });

  $("login-form").addEventListener("submit", async e => {
    e.preventDefault(); err("");
    const u = $("li-user").value.trim();
    const pw = $("li-pass").value;
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const user = await getUser(u);
      if (!user || hash(pw, user.salt) !== user.hash) return err("Wrong username or password.");
      if (user.deletedAt) return err("This account was deleted. Ask an admin to restore it.");
      if (banLeft(user)) return err("This account is " + banText(user) + ".");
      const sessionKey = deriveKey(pw, user.salt);
      localStorage.setItem("lastUser", u);
      enter(u, user);
    } catch (x) {
      console.error(x); err("Couldn't log in. Check your connection and try again.");
    } finally { if (btn) btn.disabled = false; }
  });

  $("guest").onclick = e => { e.preventDefault(); enter("guest_" + Math.floor(Math.random() * 100000)); };
  $("logout").onclick = () => signOut();
  $("li-user").value = localStorage.getItem("lastUser") || "";

  $("bright").oninput = e => {
    $("bright-v").textContent = e.target.value + "%";
    $("dim").style.opacity = (100 - e.target.value) / 100 * 0.85;
  };
  $("sound").oninput = e => { $("sound-v").textContent = e.target.value + "%"; };
  $("fsize").oninput = e => {
    $("fsize-v").textContent = e.target.value + "px";
    $("msgs").style.fontSize = e.target.value + "px";
    localStorage.setItem("fsize", e.target.value);
  };
  $("ts").onchange = () => render();

  const fs = localStorage.getItem("fsize");
  if (fs) {
    $("fsize").value = fs;
    $("fsize").oninput({ target: $("fsize") });
  }

  const themeBuyBtn = $("theme-buy-btn"); if (themeBuyBtn) themeBuyBtn.onclick = () => buyTheme($("theme-buy-select").value);
  const subBuyBtn = $("subscription-buy-btn"); if (subBuyBtn) subBuyBtn.onclick = () => buySubscription($("subscription-buy-select").value);
  const creditEarnBtn = $("credit-earn-btn"); if (creditEarnBtn) creditEarnBtn.onclick = () => awardFreeCreditIfActive();

  $("mypw-save").onclick = async () => {
    const msg = t => { $("mypw-msg").textContent = t; };
    if (me.role === "guest") return;
    const cur = $("mypw-cur").value;
    const next = $("mypw-new").value;
    const minLen = rk(me.role) >= 6 ? 20 : 6;
    if (next.length < minLen) return msg(`Devs and the owner need ${minLen}+ characters.`);
    try {
      const d = await getUser(me.name);
      if (!d || hash(cur, d.salt) !== d.hash) return msg("Current password is wrong.");
      const hist = safeJsonParse(d.pwHistory || "[]", []);
      if (hist.some(h => hash(next, h.salt) === h.hash) || hash(next, d.salt) === d.hash) return msg("Don't reuse a recent password.");
      const salt = CryptoJS.lib.WordArray.random(16).toString();
      const newHist = [{ salt: d.salt, hash: d.hash }, ...hist].slice(0, 5);
      await patch(me.name, { salt, passwordHash: hash(next, salt), pwHistory: JSON.stringify(newHist) });
      $("mypw-cur").value = ""; $("mypw-new").value = ""; msg("Password changed.");
    } catch { msg("Couldn't change the password."); }
  };

  $("del").onclick = () => {
    if (me.role === "guest") return;
    if (me.role === "owner") return toast("The owner account can't be deleted.");
    $("del-pw").value = ""; $("del-err").textContent = ""; $("delbox").classList.remove("hide"); $("del-pw").focus();
  };
  $("del-cancel").onclick = () => $("delbox").classList.add("hide");
  $("del-pw").addEventListener("keydown", e => { if (e.key === "Enter") $("del-ok").click(); });
  $("del-ok").onclick = async () => {
    try {
      const d = await getUser(me.name);
      if (!d || hash($("del-pw").value, d.salt) !== d.hash) {
        $("del-err").textContent = "Wrong password.";
        return;
      }
      await patch(me.name, { deletedAt: Date.now(), purgeAt: Date.now() + 90 * 864e5 });
      location.reload();
    } catch {
      $("del-err").textContent = "Couldn't delete the account. Try again.";
    }
  };

  $("nu-save").onclick = async () => {
    const msg = t => { $("nu-msg").textContent = t; };
    if (!isDev()) return;
    const u = $("nu-user").value.trim(); const dob = $("nu-dob").value; const pw = $("nu-pass").value; const em = $("nu-mail").value;
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
      msg("Account created — share the username and temporary password with them.");
      $("nu-user").value = ""; $("nu-dob").value = ""; $("nu-mail").value = ""; $("nu-pass").value = "";
    } catch { msg("Couldn't create the account."); }
  };
}

function toast(msg) {
  const t = $("toast"); if (!t) return; t.textContent = msg || ""; t.classList.remove("hide"); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => t.classList.add("hide"), 3500);
}

function cleanText(t) {
  return String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\bon[a-z]{3,}\s*=/gi, "").replace(/javascript\s*:/gi, "").trim();
}

const filt = t => t.replace(/bad/gi, "*");

function awardFreeCreditIfActive() {
  const user = me && me.name ? me.name : localStorage.getItem("lastUser");
  if (!user || user === "guest") return;
  const state = getCreditsState(user);
  const activeMinutes = 20;
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
  saveCreditsState(user, state); syncCreditsToFirestore(user, state); renderCreditsOverview(); toast(`${theme.name} purchased.`);
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
  saveCreditsState(user, state); syncCreditsToFirestore(user, state); renderCreditsOverview(); toast(`${sub.name} activated.`);
}

const BAD = ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "slut", "whore", "piss"];
const LEET = { a: "[a4@]", e: "[e3]", i: "[i1!]", o: "[o0]", s: "[s5$]", t: "[t7]" };
const BAD_RX = new RegExp(BAD.map(w => "(?<![a-z])" + [...w].map(c => LEET[c] || c).join("[\\W_]*") + "(?![a-z])").join("|"), "gi");
const filtText = t => String(t || "").replace(BAD_RX, m => "*".repeat(m.length));

const AVATARS = Array.from("🐶🐱🦊🐼🐸🦁🐯🐵🐧🦉🐙🦄🐢🐳🦋🐝🐲🦖🤖👽👻🎃🍇🍉🍕🍩⚽🎮🚀🌈");
function markAv() {
  document.querySelectorAll(".av-b").forEach(b => b.classList.toggle("on", b.textContent === me.avatar));
}

function initAvatars() {
  const avs = $("avs"); if (!avs) return;
  AVATARS.forEach(icon => {
    const b = document.createElement("button");
    b.className = "av-b"; b.textContent = icon; b.onclick = async () => {
      if (me.role === "guest") return toast("Log in to pick an avatar.");
      try { await patch(me.name, { avatar: icon }); me.avatar = icon; $("av").textContent = icon; markAv(); } catch { toast("Couldn't save your avatar."); }
    }; avs.appendChild(b);
  });
}

function render() {
  const box = $("msgs"); if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  const tss = $("ts")?.checked;
  const html = (window.__lastMsgs || []).map(m => {
    const acts = m.local ? "" : (isMod() ? ` <a href="#" data-del="${esc(m.id)}" class="mute">delete</a>` : "") + (me.role !== "guest" && m.u !== me.name ? ` <a href="#" data-rep="${esc(m.id)}" class="mute">report</a>` : "");
    const time = tss && !m.local ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
    const tag = m.r === "bot" ? '<span class="tag">bot</span>' : rk(m.r) >= 3 ? `<span class="tag">${m.r}</span>` : "";
    const av = AVATARS.includes(m.a) ? m.a + " " : "";
    return `<p class="msg">${time}${av}<b>${esc(m.u)}</b>${tag}: ${esc(m.x || "")}${acts}</p>`;
  }).join("");
  box.innerHTML = html || '<p class="mute">No messages yet. Say hi!</p>';
  if (near) box.scrollTop = box.scrollHeight;
}

let lastMsgs = [];
window.__lastMsgs = lastMsgs;

async function pollChat(force = false) {
  if (!$("chat")) return;
  try {
    const seen = window.__lastSeen || 0;
    const r = await fetch(`${ROOT}/chat${KEY}&orderBy=t%20desc&pageSize=40`);
    const docs = ((await r.json()).documents || []).map(parseDoc).reverse();
    const list = docs.filter(m => m.t > seen || force).map(m => ({ id: m.id, u: m.u, x: dec(m.x), r: m.r, k: m.k, a: m.a, t: Number(m.t || 0) }));
    if (list.length) {
      window.__lastSeen = Math.max(...list.map(m => m.t));
      window.__lastMsgs = [...(window.__lastMsgs || []), ...list].slice(-200);
      render();
    }
  } catch {}
}

function startChat() {
  const guest = me.role === "guest";
  $("chat-in").disabled = guest;
  $("chat-in").placeholder = guest ? "Log in to send messages (guests are read-only)" : "Say something...";
  pollChat(true);
}

$("chat-form").addEventListener("submit", async e => {
  e.preventDefault();
  const raw = $("chat-in").value.trim();
  if (!raw || me.role === "guest") return;
  const cleaned = cleanText(raw).slice(0, 500);
  const entry = { u: me.name, x: wrap(filtText(cleaned), CHAT_KEY), r: me.role, k: me.age === "1" ? "1" : "0", a: me.avatar || "", t: Date.now() };
  try {
    const r = await fetch(`${ROOT}/chat${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { u: { stringValue: entry.u }, x: { stringValue: entry.x }, r: { stringValue: entry.r }, k: { stringValue: entry.k }, a: { stringValue: entry.a }, t: { integerValue: String(entry.t) } } })
    });
    if (!r.ok) throw new Error(r.status);
    $("chat-in").value = "";
    pollChat(true);
  } catch {
    toast("Message didn't send. Try again.");
  }
});

async function loadReports(target) {
  const box = $(target); if (!box) return;
  try {
    const r = await fetch(`${ROOT}/reports${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    box.innerHTML = rows.length ? rows.map(o => `<div class="card">${esc(o.type || "report")} — ${esc(o.by || "guest")}</div>`).join("") : '<p class="mute">Nothing yet.</p>';
  } catch {
    box.textContent = "Couldn't load reports.";
  }
}

async function loadPwReqs() {
  const list = $("pw-list"); if (!list) return;
  if (!isAdmin()) { list.innerHTML = ""; return; }
  try {
    const r = await fetch(`${ROOT}/pwreq${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    list.innerHTML = rows.length ? rows.map(o => `<div class="card">${esc(o.target || "")} — by ${esc(o.by || "unknown")}</div>`).join("") : '<p class="mute">No pending requests.</p>';
  } catch { list.textContent = "Couldn't load requests."; }
}

async function loadBots() {
  const list = $("bot-list"); if (!list) return;
  if (!canBot()) { list.innerHTML = ""; return; }
  try {
    const r = await fetch(`${ROOT}/bots${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    list.innerHTML = rows.length ? rows.map(b => `<div class="card">${esc(b.name || "Bot")} — ${esc(b.words || "")}</div>`).join("") : '<p class="mute">No bots configured.</p>';
  } catch { list.textContent = "Couldn't load bots."; }
}

async function loadLegal() {
  const textEl = $("legal-text"); if (!textEl) return;
  try {
    const r = await fetch(`${ROOT}/meta/legal${KEY}`);
    const obj = r.ok ? parseDoc(await r.json()) : {};
    textEl.textContent = obj.text || "No legal text yet.";
  } catch { textEl.textContent = "Couldn't load legal info."; }
}

async function loadTos() {
  const textEl = $("tos-text"); const area = $("tos-area"); if (!textEl) return;
  try {
    const r = await fetch(`${ROOT}/meta/tos${KEY}`);
    const obj = r.ok ? parseDoc(await r.json()) : {};
    const text = obj.text || "No Terms of Service have been posted yet.";
    textEl.textContent = text;
    if (area) area.value = text;
  } catch { textEl.textContent = "Couldn't load the Terms of Service."; }
}

async function loadMotd() {
  const banner = $("motd-banner"); const text = $("motd-text"); if (!banner || !text) return;
  try {
    const r = await fetch(`${ROOT}/meta/motd${KEY}`);
    const obj = r.ok ? parseDoc(await r.json()) : {};
    const content = obj.text || "";
    text.textContent = content;
    banner.classList.toggle("hide", !content);
  } catch {}
}

async function loadAbout() {
  const el = $("about-text"); const area = $("about-area"); if (!el) return;
  try {
    const r = await fetch(`${ROOT}/meta/about${KEY}`);
    const obj = r.ok ? parseDoc(await r.json()) : {};
    const content = obj.text || "";
    el.textContent = content;
    if (area) area.value = content;
  } catch {}
}

function updateOwnerSpan() {
  const el = document.getElementById("OwnerName");
  if (!el) return;
  const name = (me && me.role === "owner" && me.name) ? me.name : (window.OwnerName || el.getAttribute("var") || el.textContent);
  el.textContent = name;
}

window.updateOwnerSpan = updateOwnerSpan;
window.addEventListener("DOMContentLoaded", updateOwnerSpan);

function initGoogleButtons() {
  const loginTarget = document.getElementById("google-login-container");
  const signupTarget = document.getElementById("google-signup-container");
  if (!loginTarget && !signupTarget) return;
  if (!window.F12Methods || !window.F12Auth) {
    setTimeout(initGoogleButtons, 50); return;
  }
  const { signInWithPopup, getDocs, collection, query, where } = window.F12Methods;
  const auth = window.F12Auth; const db = window.F12Db; const provider = window.F12Provider;
  const btnStyle = "display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:10px;background:white;color:#444;border:1px solid #dadce0;border-radius:8px;font-weight:600;cursor:pointer;";
  const gLogo = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:18px;height:18px;">';

  if (loginTarget && !document.getElementById("google-login-btn")) {
    const loginBtn = document.createElement("button");
    loginBtn.type = "button"; loginBtn.id = "google-login-btn"; loginBtn.style = btnStyle; loginBtn.innerHTML = `${gLogo} Sign in with Google`;
    loginBtn.onclick = async e => {
      e.preventDefault(); err(""); loginBtn.disabled = true;
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const snapshot = await getDocs(query(collection(db, "users"), where("googleUid", "==", user.uid)));
        if (snapshot.empty) return err("No GrapeGreen profile found for this Google account. Please use Sign Up first!");
        const userDoc = snapshot.docs[0];
        const dbUser = userDoc.data();
        const username = userDoc.id;
        if (dbUser.deletedAt) return err("This account was deleted. Ask an admin to restore it.");
        if (banLeft(dbUser)) return err("This account is " + banText(dbUser) + ".");
        localStorage.setItem("lastUser", username);
        enter(username, dbUser);
      } catch (x) {
        console.error(x); err("Google login failed. Please try again.");
      } finally { loginBtn.disabled = false; }
    };
    loginTarget.appendChild(loginBtn);
  }

  if (signupTarget && !document.getElementById("google-signup-btn")) {
    const signupBtn = document.createElement("button");
    signupBtn.type = "button"; signupBtn.id = "google-signup-btn"; signupBtn.style = btnStyle; signupBtn.innerHTML = `${gLogo} Sign up with Google`;
    signupBtn.onclick = async e => {
      e.preventDefault(); err(""); signupBtn.disabled = true;
      try {
        const result = await signInWithPopup(auth, provider);
        const googleUser = result.user;
        const em = googleUser.email;
        const dob = prompt("Confirm your Date of Birth (YYYY-MM-DD or MM/DD/YYYY):", "2010-01-01");
        if (!dob) return err("Sign up canceled. Date of Birth is required.");
        const age = tier(dob);
        if (!age) return err("Enter a valid birth date that isn't in the future.");
        let u = (googleUser.displayName || "User").replace(/[^A-Za-z0-9_.-]/g, "");
        if (u.length < 3) u = "User_" + Math.floor(Math.random() * 1000);
        if (await getUser(u)) u = u + Math.floor(Math.random() * 10000);
        const salt = CryptoJS.lib.WordArray.random(16).toString();
        const role = u === "MattyGrapeGreenOwner" ? "owner" : "user";
        const sessionKey = deriveKey(googleUser.uid, salt);
        const box = age === "1" ? {} : { gmail: wrap(em, sessionKey), dob: wrap(dob, sessionKey) };
        if (age !== "1" && (unwrap(box.gmail, sessionKey) !== em || unwrap(box.dob, sessionKey) !== dob)) throw new Error("encryption check failed");
        await saveUser(u, { age, salt, hash: hash(googleUser.uid, salt), ...box, role, googleUid: googleUser.uid });
        localStorage.setItem("lastUser", u);
        if (age !== "1" && em) sendWelcomeEmail(u, em);
        enter(u, { role, age, ...box });
      } catch (x) {
        console.error(x); err("Google registration failed. Ensure your console configuration is active.");
      } finally { signupBtn.disabled = false; }
    };
    signupTarget.appendChild(signupBtn);
  }
}

(function bootstrap() {
  initThemes(); initAvatars(); bindUI(); initGoogleButtons();
  if (typeof loadMotd === "function") loadMotd();
  if (typeof loadAbout === "function") loadAbout();
  if (typeof loadTos === "function") loadTos();
  if (typeof loadUpdates === "function") loadUpdates();
  const kick = sessionStorage.getItem("kick");
  if (kick) { err(kick); sessionStorage.removeItem("kick"); }
  $("li-user").value = localStorage.getItem("lastUser") || "";
  window.addEventListener("DOMContentLoaded", () => { if (typeof updateOwnerSpan === "function") updateOwnerSpan(); });
})();

window.GrapeGreenTokens = window.GrapeGreenTokens || { creditConfig: { themes: [], subscriptions: [], activeMinutesToEarnOne: 20 } };
if (typeof console !== "undefined") console.info("GrapeGreen app.js repaired.");

window.addEventListener("error", e => { if (window.__devNoise) console.error(e.error || e.message || e); });

window.safeJsonParse = safeJsonParse;
window.parseDoc = parseDoc;
window.CFG = CFG;
