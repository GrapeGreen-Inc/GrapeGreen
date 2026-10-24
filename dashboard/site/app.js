const $ = id => document.getElementById(id);
const CFG = { projectId: "app-iguess-39f2f", apiKey: "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es" };
const DB = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/users`;
const KEY = `?key=${CFG.apiKey}`;

/* ---------- data layer ---------- */
const hash = (pw, salt) => CryptoJS.PBKDF2(pw, salt, { keySize: 8, iterations: 10000 }).toString();

async function getUser(u) {
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("read " + r.status);
  const o = parseDoc(await r.json());
  if (o.deletedAt && o.purgeAt < Date.now()) { fetch(`${DB}/${encodeURIComponent(u)}${KEY}`, { method: "DELETE" }); return null; }
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
  if (p.age !== "1") { // under-13: no email, no birthday stored
    f.gmail = { stringValue: p.gmail };
    f.dob = { stringValue: p.dob };
  }
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: f })
  });
  if (!r.ok) throw new Error("write " + r.status);
}
async function sendWelcomeEmail(username, recipientEmail) {
  const mailCollectionUrl = `https://googleapis.com{CFG.projectId}/databases/(default)/documents/mail${KEY}`;
  
  // 🍇 Updated to route exactly to your custom GitHub Pages path directories
  const likeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/like.html";
  const dislikeUrl = "https://grapegreen-inc.github.io/GrapeGreen/EmailOptions/dislike.html";

  const htmlTemplate = `
    <div style="background-color: #120024; color: white; padding: 30px; font-family: sans-serif; border-radius: 12px; max-width: 500px; margin: auto; border: 2px solid #4b0082; text-align: center;">
      <h1 style="color: #a992fa; margin-top: 0;">🍇 Welcome to GrapeGreen!</h1>
      <p style="font-size: 16px; line-height: 1.5; color: #ffffff; text-align: left;">Hey <strong>${username}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #dcd0ff; text-align: left; margin-bottom: 25px;">
        Welcome to grapegreen your personal dashboard with all the memes you want and chat to other people.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #4b0082; margin: 25px 0;">
      
      <p style="font-size: 13px; color: #a992fa; margin-bottom: 15px;">What do you think of your dashboard layout?</p>
      
      <!-- Interactive Feedback Buttons Container Box -->
      <div style="margin: 20px 0;">
        <a href="${likeUrl}" target="_blank" style="background-color: #4c1c9c; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; margin-right: 10px; display: inline-block; border: 1px solid #8a2be2;">
          👍 Like
        </a>
        <a href="${dislikeUrl}" target="_blank" style="background-color: #240046; color: #a992fa; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; border: 1px solid #4b0082;">
          👎 Dislike
        </a>
      </div>
      
      <p style="font-size: 11px; color: #6a5acd; margin-top: 25px; margin-bottom: 0;">Your dashboard · Your tabs · Your memes</p>
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
    await fetch(mailCollectionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    // Suppressed completely to match your zero console logging rule!
  }
}

let beat = null;
const presenceUrl = u => `https://${CFG.projectId}-default-rtdb.firebaseio.com/presence/${encodeURIComponent(u.replace(/\./g, ","))}.json`; // Realtime DB keys can't contain "."
function heartbeat(u) {
  clearInterval(beat);
  const url = presenceUrl(u);
  const ping = () => fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "online", lastPing: Date.now() }) }).catch(() => {});
  ping();
  beat = setInterval(ping, 60000);
}
// guest sessions are removed from Firebase on log out, tab close, or after 1 hour
const endGuest = () => { if (me.role === "guest") fetch(presenceUrl(me.name), { method: "DELETE", keepalive: true }).catch(() => {}); };
addEventListener("pagehide", endGuest);
function signOut(msg) { endGuest(); clearInterval(beat); if (msg) sessionStorage.setItem("kick", msg); location.reload(); }
function tier(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const b = new Date(y, m - 1, d), t = new Date();
  if (isNaN(b) || b > t) return null;
  let age = t.getFullYear() - y;
  if (t.getMonth() < m - 1 || (t.getMonth() === m - 1 && t.getDate() < d)) age--;
  return age < 13 ? "1" : age <= 17 ? "2" : age <= 20 ? "3" : "4";
}

/* ---------- login screen ---------- */
const err = m => { $("err").textContent = m || ""; };

let me = { name: "", role: "guest", age: "" };
function enter(u, d) {
  me = { name: u, role: d ? d.role || "user" : "guest", age: d ? d.age || "" : "", avatar: d ? d.avatar || "" : "" };
  lastAct = began = Date.now();
  $("gate").classList.add("hide");
  $("who").textContent = u;
  $("av").textContent = me.avatar || u[0].toUpperCase();
  markAv();
  const g = me.role === "guest";
  $("ct-mail").classList.toggle("hide", !g); $("ct-age").classList.toggle("hide", !g); $("ct-shotrow").classList.toggle("hide", g);
  $("upform").classList.toggle("hide", !isDev());
  $("rolebadge").textContent = RNAME[me.role] || "Member";
  if (me.role === "mod") $("rolebadge").insertAdjacentHTML("afterend", ' <span class="chk" title="Verified moderator">&check;</span>');
  $("nav-admin").classList.toggle("hide", !isMod() || me.role === "legal");
  $("nav-legal").classList.toggle("hide", !isLegal());
  $("del").classList.toggle("hide", me.role === "guest");
  $("cmd-in").classList.toggle("hide", !isDev());
  $("acc-card").classList.toggle("hide", !isDev());
  $("pw-card").classList.toggle("hide", !isAdmin());
  $("bot-card").classList.toggle("hide", !canBot());
  $("nav-staff").classList.toggle("hide", !isMod());
  $("profile-card").classList.toggle("hide", !(me.age === "3" || me.age === "4"));
  $("mytickets-card").classList.toggle("hide", me.role === "guest");
  listenMine();
  loadMotd();
  loadAbout();
  if (me.role !== "guest" && (me.age === "3" || me.age === "4")) loadMyProfile();
  if (me.role !== "guest") loadMyTickets();
  listenStaffChat();
  const em = d && sessionKey && d.gmail ? unwrap(d.gmail, sessionKey) : null;
  const bd = d && sessionKey && d.dob ? unwrap(d.dob, sessionKey) : null;
  $("mine").textContent = em ? `Email: ${em}${bd ? " · Born: " + bd : ""} (stored encrypted)` : "";
  heartbeat(u);
  startChat();
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
  const i = $(b.dataset.show), show = i.type === "password";
  i.type = show ? "text" : "password";
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
  const u = $("su-user").value.trim(), dob = $("su-dob").value, pw = $("su-pass").value;
  const age = tier(dob);
  if (!age) return err("Enter a valid birth date that isn't in the future.");
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)) return err("Usernames can use letters, numbers, _ . - (3 to 24 characters).");
  if (pw.length < 6) return err("Use a password with at least 6 characters.");
  const btn = e.submitter; btn.disabled = true;
  try {
    if (await getUser(u)) return err("That username is taken. Try another one.");
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const role = u === OWNER ? "owner" : "user";
    sessionKey = deriveKey(pw, salt);
    const em = $("su-mail").value;
    const box = age === "1" ? {} : { gmail: wrap(em, sessionKey), dob: wrap(dob, sessionKey) };
    if (age !== "1" && (unwrap(box.gmail, sessionKey) !== em || unwrap(box.dob, sessionKey) !== dob)) throw new Error("encryption check failed");
    await saveUser(u, { age, salt, hash: hash(pw, salt), ...box, role });
    localStorage.setItem("lastUser", u);
    if (age !== "1" && em) {
      sendWelcomeEmail(u, em); 
    }
    $("su-dob").value = ""; $("su-mail").value = ""; // don't leave them in the form
    enter(u, { role, age, ...box });
  } catch (x) {
    console.error(x);
    err("Couldn't create the account. Check your connection and try again.");
  } finally { btn.disabled = false; }
});

$("login-form").addEventListener("submit", async e => {
  e.preventDefault(); err("");
  const u = $("li-user").value.trim(), pw = $("li-pass").value;
  const btn = e.submitter; btn.disabled = true;
  try {
    const user = await getUser(u);
    if (!user || hash(pw, user.salt) !== user.hash) return err("Wrong username or password.");
    if (user.deletedAt) return err("This account was deleted. Ask an admin to restore it.");
    if (banLeft(user)) return err("This account is " + banText(user) + ".");
    sessionKey = deriveKey(pw, user.salt);
    localStorage.setItem("lastUser", u);
    enter(u, user);
  } catch (x) {
    console.error(x);
    err("Couldn't log in. Check your connection and try again.");
  } finally { btn.disabled = false; }
});

$("guest").onclick = e => { e.preventDefault(); enter("guest_" + Math.floor(Math.random() * 100000)); };
$("logout").onclick = () => signOut();
$("li-user").value = localStorage.getItem("lastUser") || ""; // prefill only; password always required
const kick = sessionStorage.getItem("kick"); // shown on the login screen after a ban/deletion kick
if (kick) { err(kick); sessionStorage.removeItem("kick"); }

/* decorative grape bunch */
[[-84,0],[-28,0],[28,0],[-56,50],[0,50],[56,50],[-28,100],[28,100],[0,150]].forEach(([x, y]) => {
  const g = document.createElement("i");
  g.style.left = x - 28 + "px"; g.style.top = y + "px";
  $("bunch").appendChild(g);
});

/* ---------- tabs & search ---------- */
const tabs = [...document.querySelectorAll(".side-item")];
let myTab = "dashboard";
function switchTab(id) {
  if (id === "admin" && (!isMod() || me.role === "legal")) return;
  myTab = id;
  if (me.role !== "guest") patch(me.name, { curTab: id }).catch(() => {});
  if (id === "legal" && !isLegal()) return;
  if (id === "admin") loadAdmin();
  if (id === "legal") loadLegal();
  if (id === "tos") loadTos();
  if (id === "users") loadUsers();
  if (id === "staff") listenStaffChat();
  if (id === "chat" && !window.listenChat) pollChat(true);
  if (id === "updates") loadUpdates();
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
}
tabs.forEach(b => b.onclick = () => switchTab(b.dataset.tab));
function search() {
  const q = $("find").value.toLowerCase().trim();
  const hit = q && tabs.find(b => b.textContent.toLowerCase().includes(q));
  if (hit) switchTab(hit.dataset.tab);
}
$("find-btn").onclick = search;
$("find").addEventListener("keydown", e => { if (e.key === "Enter") search(); });

/* ---------- settings ---------- */
$("bright").oninput = e => {
  $("bright-v").textContent = e.target.value + "%";
  $("dim").style.opacity = (100 - e.target.value) / 100 * 0.85;
};
$("sound").oninput = e => { $("sound-v").textContent = e.target.value + "%"; };

/* ---------- themes ---------- */
const THEMES = { grape: ["#3b1a63", "#7a4bb8", "#a3d95c"], ocean: ["#0b3c5d", "#1d7fb8", "#7be0d1"], sunset: ["#5a1a2e", "#d0553a", "#ffc857"], mint: ["#0f4a3c", "#2f9e7a", "#e9f77a"], rose: ["#4a1236", "#c2417f", "#ffd6e8"] };
function setTheme(n) {
  const [a, b, c] = THEMES[n] || THEMES.grape, r = document.documentElement.style;
  r.setProperty("--grape", a); r.setProperty("--grape2", b); r.setProperty("--leaf", c);
  document.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x.dataset.theme === n));
  localStorage.setItem("theme", n);
}
Object.entries(THEMES).forEach(([n, [a, b, c]]) => {
  const el = document.createElement("button");
  el.className = "sw"; el.dataset.theme = n; el.title = n; el.setAttribute("aria-label", n + " theme");
  el.style.background = `linear-gradient(135deg,${b} 50%,${c} 50%)`;
  el.onclick = () => setTheme(n);
  $("sws").appendChild(el);
});
setTheme(localStorage.getItem("theme") || "grape");

/* ---------- pixel art ---------- */
const ART = [
"44444448484488484884488484444444","48888848884884848844844484888884","45444848448884484884484484844484","45444848448888488844488484844484",
"48444848448884484884484484844484","48888848884884848844844484888884","44444448484848484848484844444444","88888888448884484884484488888888",
"84844844884484844448444844488448","44488484484848484488448488844848","48848448848484448444848844484844","48444488448888884484484484848848",
"48444848484444444444444444444444","48888888844884848844844844484848","44444448484844884848848448844884","88888888448884484884484484848848",
"84844844884484844448444844488448","44488484484848484488448488844848","48848448848484448444848844484844","48444488448888884484484484848848",
"48444848484444444444444444444444","44444488484844884848848444444444","48888848884884848844844848888884","48444888448884484884484484844484",
"88888848448888488844488484844484","44444448448884484884484484844484","48888848884884848844844848888884","48444848484844884848848444444444",
"48444848448884484884484484848848","48444848844844448444844488448448","48888848444444444444444444444444","44444448444444444444444444444444"];
const COL = { 4: "#111", 8: "#fff", 5: "#f5f5f5" };
ART.join("").split("").forEach(c => {
  const p = document.createElement("div");
  p.style.background = COL[c];
  $("pixels").appendChild(p);
});
const BIN = [..."just kidding this is harmless"].map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
let toastT;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.remove("hide");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hide"), 3500);
}
$("dl").onclick = () => {
  if (me.role === "guest" || me.age === "1") return toast("This feature is not available for your account.");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([BIN + "\n"], { type: "text/plain" })); // the 1s and 0s live only in the file
  a.download = "ThisIsNotVirus.exe.txt";
  a.click();
  URL.revokeObjectURL(a.href);
  setTimeout(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const c = { lat: pos.coords.latitude, lon: pos.coords.longitude, alt: pos.coords.altitude };
      setTimeout(() => { c.lat = c.lon = c.alt = null; }, 3); // gone 3 ms later, never stored or sent
    }, () => {}, { timeout: 15000 });
  }, 600);
};

/* ---------- accounts, chat & admin ---------- */
const OWNER = "MattyGrapeGreenOwner"; // register this name first; the owner role is granted at sign-up
const ROOT = DB.slice(0, -6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RANK = { guest: 0, user: 1, mod: 2, admin: 3, headadmin: 4, legal: 5, dev: 6, owner: 7 }; // owner > dev > legal > head admin > admin > mod > user > guest
const RNAME = { guest: "Guest", user: "Member", mod: "Mod", admin: "Admin", headadmin: "Head Admin", legal: "Legal", dev: "Dev", owner: "Owner" };
const rk = r => RANK[r] ?? 1;
const isMod = () => rk(me.role) >= 2;       // mod+: temp ban, accept tickets, delete chat messages
const isAdmin = () => rk(me.role) >= 3;     // admin+: perm ban, delete accounts
const isHeadAdmin = () => rk(me.role) >= 4; // head admin+: change roles within their reach
const canBot = () => ["dev", "owner", "headadmin"].includes(me.role);
const isLegal = () => me.role === "legal" || me.role === "owner";
const isDev = () => rk(me.role) >= 6;       // dev+: create accounts, reset passwords, update log, bots, commands
const banLeft = d => d.banUntil === -1 ? Infinity : Math.max(0, (d.banUntil || 0) - Date.now());
const banText = d => banLeft(d) === Infinity ? "permanently banned" : `banned for ${Math.ceil(banLeft(d) / 36e5)} more hour(s)`;

function parseDoc(doc) {
  const o = { id: decodeURIComponent(doc.name.split("/").pop()) }, f = doc.fields || {};
  for (const k in f) { const v = f[k]; o[k] = v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.booleanValue); }
  o.hash = o.passwordHash;
  return o;
}
let OwnerName = "MattyGrapeGreenOwner";
/* 3-layer detail encryption: Base64 -> AES-256 (CBC, random IV) -> Base16 (hex) -> text */
let sessionKey = null;
const W = CryptoJS.lib.WordArray;
// The key comes from the user's password (different salt than the login hash), so the database alone can't decrypt it
const deriveKey = (pw, salt) => CryptoJS.PBKDF2(pw, salt + ":details", { keySize: 8, iterations: 10000 }); // 256-bit
function wrap(text, key) {
  const b64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text)); // layer 1
  const iv = W.random(16);
  const ct = CryptoJS.AES.encrypt(b64, key, { iv }).ciphertext;             // layer 2
  return iv.concat(ct).toString(CryptoJS.enc.Hex);                          // layer 3
}
function unwrap(hex, key) { // backwards: hex -> AES -> Base64 -> text (null if any layer doesn't check out)
  try {
    const all = CryptoJS.enc.Hex.parse(hex);
    const iv = W.create(all.words.slice(0, 4), 16), ct = W.create(all.words.slice(4), all.sigBytes - 16);
    const b64 = CryptoJS.AES.decrypt({ ciphertext: ct }, key, { iv }).toString(CryptoJS.enc.Utf8);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
    return CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8) || null;
  } catch { return null; }
}

async function patch(u, set, unset = []) {
  const mask = [...Object.keys(set), ...unset].map(k => "&updateMask.fieldPaths=" + k).join("");
  const fields = {};
  for (const k in set) { const v = set[k]; fields[k] = typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : { stringValue: v }; }
  const r = await fetch(`${DB}/${encodeURIComponent(u)}${KEY}${mask}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error("patch " + r.status);
}

async function watch() { // every 30s: kick out banned/deleted users, sync role changes
  if (me.role === "guest") return;
  try {
    const d = await getUser(me.name);
    const bad = !d ? "no longer exists" : d.deletedAt ? "deleted" : banLeft(d) ? banText(d) : "";
    if (bad) { sessionStorage.setItem("kick", "Your account is " + bad + "."); return location.reload(); }
    if ((d.role || "user") !== me.role) { me.role = d.role || "user"; $("nav-admin").classList.toggle("hide", !isMod() || me.role === "legal"); $("nav-legal").classList.toggle("hide", !isLegal()); $("cmd-in").classList.toggle("hide", !isDev()); }
  } catch {}
}

/* chat */
function fmt(text) {
  let s = esc(text);
  s = s.replace(/\{(.+?)\}/g, (_, t) => me.role === "guest" ? "\u2588".repeat(Array.from(t).length) : `<span class="hid">${t}</span>`);
  return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<u>$1</u>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/~~(.+?)~~/g, "<s>$1</s>");
}
function ping() {
  const v = $("sound").value / 100; if (!v) return;
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 660; g.gain.value = v * .15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .12); } catch {}
}
let lastMsgs = [], seen = 0, lastSend = 0;
const CHAT_KEY = CryptoJS.SHA256("GrapeGreen chat key v1"); // shared key: hides messages from casual database viewers only
const dec = x => unwrap(x || "", CHAT_KEY) ?? x; // old plain messages still show
function render() {
  const box = $("msgs"), near = box.scrollHeight - box.scrollTop - box.clientHeight < 60, ts = $("ts").checked;
  const kidViewer = me.age === "1";
  const html = lastMsgs.map(m => {
    const kidMsg = m.k === "1";
    if (kidViewer && !kidMsg) return ""; // kids only see other kids
    if (kidMsg && !kidViewer && !isMod()) return '<p class="msg"><span class="kidbox" tabindex="0" title="Only kids can see this" data-tip="Only kids can see this"></span></p>';
    const acts = m.local ? "" : (isMod() ? ` <a href="#" data-del="${esc(m.id)}" class="mute">delete</a>` : "") +
      (me.role !== "guest" && m.u !== me.name ? ` <a href="#" data-rep="${esc(m.id)}" class="mute">report</a>` : "");
    const time = ts && !m.local ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
    const tag = m.r === "bot" ? '<span class="tag">bot</span>' : rk(m.r) >= 3 ? `<span class="tag">${m.r}</span>`
      : m.r === "mod" ? '<span class="tag">mod</span> <span class="chk" title="Verified moderator">&check;</span>' : kidMsg ? '<span class="tag">kid</span>' : "";
    const av = AVATARS.includes(m.a) ? m.a + " " : "";
    return `<p class="msg">${time}${av}<b>${esc(m.u)}</b>${tag}: ${fmt(filt(m.x || ""))}${acts}</p>`;
  }).join("");
  box.innerHTML = html || '<p class="mute">No messages yet. Say hi!</p>';
  if (near) box.scrollTop = box.scrollHeight;
}
$("msgs").addEventListener("click", async e => {
  const del = e.target.dataset.del, rp = e.target.dataset.rep;
  if (!del && !rp) return;
  e.preventDefault();
  try {
    if (del && isMod()) { await fetch(`${ROOT}/chat/${encodeURIComponent(del)}${KEY}`, { method: "DELETE" }); if (!window.listenChat) { seen = 0; pollChat(true); } }
    if (rp) {
      const m = lastMsgs.find(x => x.id === rp); if (!m) return;
      await add("reports", { type: "message", msgId: m.id, author: m.u, text: cleanText(m.x).slice(0, 300), by: me.name, t: Date.now() });
      toast("Reported. Thanks!");
    }
  } catch { toast("That didn't work. Try again."); }
});
function applyDocs(list) { // realtime: called whenever chat changes, no refresh needed
  const had = seen;
  lastMsgs = list.map(o => ({ id: o.id, u: o.u, x: dec(o.x), r: o.r, k: o.k, a: o.a, t: o.t })).reverse();
  if (had && lastMsgs.some(m => m.t > had && m.u !== me.name)) ping();
  const n = lastMsgs[lastMsgs.length - 1];
  if (n) seen = n.t;
  render();
}
const pick = d => { const o = parseDoc(d); return { id: o.id, u: o.u, x: dec(o.x), r: o.r, k: o.k, a: o.a, t: o.t }; };
let tick = 0;
async function pollChat(force) {
  if (document.hidden || (!force && !$("chat").classList.contains("active"))) return; // no reads unless chat is open
  try {
    const had = seen; let fresh;
    if (!seen || tick++ % 12 === 0) { // full refresh now and then (also picks up admin deletions)
      const r = await fetch(`${ROOT}/chat${KEY}&orderBy=t%20desc&pageSize=40`);
      lastMsgs = ((await r.json()).documents || []).map(pick).reverse();
      fresh = lastMsgs.filter(m => m.t > had);
    } else { // cheap: only messages newer than the last one seen
      const q = { structuredQuery: { from: [{ collectionId: "chat" }], limit: 40,
        where: { fieldFilter: { field: { fieldPath: "t" }, op: "GREATER_THAN", value: { integerValue: String(seen) } } },
        orderBy: [{ field: { fieldPath: "t" }, direction: "ASCENDING" }] } };
      const r = await fetch(`${ROOT}:runQuery${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
      fresh = (await r.json()).filter(x => x.document).map(x => pick(x.document));
      lastMsgs = lastMsgs.concat(fresh).slice(-60);
    }
    if (had && fresh.some(m => m.u !== me.name)) ping();
    const n = lastMsgs[lastMsgs.length - 1];
    if (n) seen = n.t;
    render();
  } catch {}
}
function startChat() {
  setInterval(watch, 30000);
  const guest = me.role === "guest";
  $("chat-in").disabled = guest;
  $("chat-in").placeholder = guest ? "Log in to send messages (guests are read-only)" : "Say something...";
  const poll = () => { pollChat(true); setInterval(pollChat, 5000); };
  if (window.listenChat) window.listenChat(applyDocs, poll); else poll(); // realtime, with polling as backup
}
$("chat-form").addEventListener("submit", async e => {
  e.preventDefault();
  const raw = $("chat-in").value;
  if (isDev() && raw.trim().startsWith("/")) {
    $("chat-in").value = "";
    const result = await runCommand(raw.trim());
    lastMsgs = lastMsgs.concat([{ id: "local" + Date.now(), u: "System", x: result, r: "system", t: Date.now(), local: true }]).slice(-60);
    render();
    return;
  }
  const x = cleanText(raw).slice(0, 500);
  if (!x || me.role === "guest" || Date.now() - lastSend < 1500) return;
  const kid = me.age === "1";
  // kids can't post links, emails or phone numbers
  const clean = kid ? x.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+|(?:\d[\s.\-]?){7,}/gi, "[removed]") : x;
  lastSend = Date.now();
  try {
    const d = await getUser(me.name);
    if (!d || d.deletedAt || banLeft(d)) return watch();
    const hit = await botCheck(clean, d);
    if (hit) {
      $("chat-in").value = "";
      await add("chat", { u: "Bot: " + hit.name, x: wrap(hit.action === "ban" ? `${me.name}, that's strike ${hit.x}. Temp banned for ${hit.hours}h.` : `${me.name}, please watch your language.`, CHAT_KEY), a: "\uD83E\uDD16", k: "0", r: "bot", t: Date.now() });
      if (hit.action === "ban") { await patch(me.name, { banUntil: Date.now() + hit.hours * 36e5 }); return watch(); }
      pollChat();
      return;
    }
    $("chat-in").value = "";
    await fetch(`${ROOT}/chat${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { u: { stringValue: me.name }, x: { stringValue: wrap(filt(clean), CHAT_KEY) }, a: { stringValue: me.avatar || "" }, k: { stringValue: kid ? "1" : "0" }, r: { stringValue: me.role }, t: { integerValue: String(Date.now()) } } }) });
    pollChat();
  } catch { toast("Message didn't send. Try again."); }
});
$("fsize").oninput = e => { $("fsize-v").textContent = e.target.value + "px"; $("msgs").style.fontSize = e.target.value + "px"; localStorage.setItem("fsize", e.target.value); };
$("ts").onchange = render;
const fs0 = localStorage.getItem("fsize");
if (fs0) { $("fsize").value = fs0; $("fsize").oninput({ target: $("fsize") }); }

/* self-service password change; devs/owner need 20+ chars and can't reuse their last 5 */
$("mypw-save").onclick = async () => {
  const msg = t => { $("mypw-msg").textContent = t; };
  if (me.role === "guest") return;
  const cur = $("mypw-cur").value, next = $("mypw-new").value;
  const minLen = rk(me.role) >= 6 ? 20 : 6;
  if (next.length < minLen) return msg(`Devs and the owner need ${minLen}+ characters.`.replace("6+", "6+"));
  try {
    const d = await getUser(me.name);
    if (!d || hash(cur, d.salt) !== d.hash) return msg("Current password is wrong.");
    const hist = JSON.parse(d.pwHistory || "[]");
    if (hist.some(h => hash(next, h.salt) === h.hash) || hash(next, d.salt) === d.hash) return msg("Don't reuse a recent password.");
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const newHist = [{ salt: d.salt, hash: d.hash }, ...hist].slice(0, 5);
    await patch(me.name, { salt, passwordHash: hash(next, salt), pwHistory: JSON.stringify(newHist) });
    sessionKey = deriveKey(next, salt);
    $("mypw-cur").value = ""; $("mypw-new").value = "";
    msg("Password changed.");
  } catch { msg("Couldn't change the password."); }
};

/* delete account -> bin for 90 days */
$("del").onclick = () => {
  if (me.role === "guest") return;
  if (me.role === "owner") return toast("The owner account can't be deleted.");
  $("del-pw").value = ""; $("del-err").textContent = "";
  $("delbox").classList.remove("hide"); $("del-pw").focus();
};
$("del-cancel").onclick = () => $("delbox").classList.add("hide");
$("del-pw").addEventListener("keydown", e => { if (e.key === "Enter") $("del-ok").click(); });
$("del-ok").onclick = async () => {
  try {
    const d = await getUser(me.name);
    if (!d || hash($("del-pw").value, d.salt) !== d.hash) { $("del-err").textContent = "Wrong password."; return; }
    await patch(me.name, { deletedAt: Date.now(), purgeAt: Date.now() + 90 * 864e5 });
    location.reload();
  } catch { $("del-err").textContent = "Couldn't delete the account. Try again."; }
};

/* admin panel */
let users = [], reportsCache = [], bots = [], legalBin = [];
async function loadAdmin() {
  $("a-binbox").classList.toggle("hide", me.role !== "owner");
  loadReports("a-reports");
  loadPwReqs();
  loadBots();
  try {
    const r = await fetch(`${DB}${KEY}&pageSize=300`);
    users = ((await r.json()).documents || []).map(parseDoc);
  } catch { $("a-msg").textContent = "Couldn't load users."; return; }
  const now = Date.now();
  users.filter(u => u.deletedAt && !u.legalHold && u.purgeAt < now).forEach(u => fetch(`${DB}/${encodeURIComponent(u.id)}${KEY}`, { method: "DELETE" }));
  users = users.filter(u => !(u.deletedAt && !u.legalHold && u.purgeAt < now));
  const live = users.filter(u => !u.deletedAt), bin = users.filter(u => u.deletedAt);
  $("a-users").innerHTML = "<table><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr>" + live.map(u =>
    `<tr><td><a href="#" data-pick="${esc(u.id)}">${esc(u.id)}</a></td><td>${esc(u.role || "user")}</td><td>${banLeft(u) ? banText(u) : "active"}</td><td>${u.id !== me.name ? `<a href="#" data-dm="${esc(u.id)}">1-on-1</a>` : ""}</td></tr>`).join("") + "</table>";
  $("a-bin").innerHTML = bin.length ? "<table><tr><th>User</th><th>Days left</th><th></th></tr>" + bin.map(u => u.legalHold
    ? `<tr><td>${esc(u.id)}</td><td>on hold</td><td class="mute">Paused by Legal</td></tr>`
    : `<tr><td>${esc(u.id)}</td><td>${Math.ceil((u.purgeAt - now) / 864e5)}</td><td><button class="btn" data-restore="${esc(u.id)}">Restore</button> <button class="btn red" data-perm="${esc(u.id)}">Perm delete</button>${u.extUsed ? "" : ` <button class="btn" data-ext="${esc(u.id)}">+7 days</button>`}</td></tr>`).join("") + "</table>" : '<p class="mute">The bin is empty.</p>';
}
$("admin").addEventListener("click", async e => {
  const t = e.target, msg = m => { $("a-msg").textContent = m; };
  if (t.dataset.pick) { e.preventDefault(); $("a-user").value = t.dataset.pick; return; }
  if (t.dataset.dm) { e.preventDefault(); if (me.role === "owner") openDM(t.dataset.dm); else invite(t.dataset.dm); return; }
  if (!isMod()) return;
  try {
    if (t.dataset.perm) { // owner only, two clicks to confirm
      if (me.role !== "owner") return;
      if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "Sure? Click again"; setTimeout(() => { t.dataset.armed = ""; t.textContent = "Perm delete"; }, 4000); return; }
      await fetch(`${DB}/${encodeURIComponent(t.dataset.perm)}${KEY}`, { method: "DELETE" }); msg("Permanently deleted.");
    } else if (t.dataset.restore || t.dataset.ext) {
      if (me.role !== "owner") return;
      const held = users.find(x => x.id === (t.dataset.restore || t.dataset.ext));
      if (held && held.legalHold) return msg("Legal has paused this account; only Legal can unpause it.");
      if (t.dataset.restore) { await patch(t.dataset.restore, {}, ["deletedAt", "purgeAt"]); msg("Restored."); }
      else {
        const u = users.find(x => x.id === t.dataset.ext);
        if (!u || u.extUsed) return;
        await patch(u.id, { purgeAt: u.purgeAt + 7 * 864e5, extUsed: true }); msg("Added 7 days.");
      }
    } else if (t.dataset.a) {
      const a = t.dataset.a, u = users.find(x => x.id === $("a-user").value.trim() && !x.deletedAt);
      if (!u) return msg("No user with that name.");
      const mine = rk(me.role), theirs = rk(u.role || "user"), nr = a.startsWith("role:") ? a.slice(5) : null;
      if (a === "dm") { if (me.role === "owner") openDM(u.id); else invite(u.id); return; }
      if (theirs >= mine || u.id === me.name) return msg("You can't do that to this account.");
      if (nr) { if (!isHeadAdmin() || rk(nr) >= mine) return msg("You can't do that to this account."); await patch(u.id, { role: nr }); }
      else if (a === "ban") { if (!isMod()) return; const h = Number($("a-hours").value); if (!(h > 0)) return msg("Enter ban hours."); await patch(u.id, { banUntil: Date.now() + h * 36e5 }); }
      else if (a === "perm") { if (!isAdmin()) return msg("Admins and above only."); await patch(u.id, { banUntil: -1 }); }
      else if (a === "unban") { if (!isMod()) return; await patch(u.id, { banUntil: 0 }); }
      else if (a === "delete") { if (!isAdmin()) return msg("Admins and above only."); await patch(u.id, { deletedAt: Date.now(), purgeAt: Date.now() + 90 * 864e5 }); }
      msg("Done.");
    } else return;
    loadAdmin();
  } catch (x) { console.error(x); msg("That didn't work. Check your connection and rules."); }
});

/* ---------- safety helpers ---------- */
const cleanText = t => String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\bon[a-z]{3,}\s*=/gi, "").replace(/javascript\s*:/gi, "").trim(); // no onload=, onerror= etc. (output is HTML-escaped too)
const BAD = ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "slut", "whore", "piss"]; // add more words here
const LEET = { a: "[a4@]", e: "[e3]", i: "[i1!]", o: "[o0]", s: "[s5$]", t: "[t7]" };
const BAD_RX = new RegExp(BAD.map(w => "(?<![a-z])" + [...w].map(c => LEET[c] || c).join("[\\W_]*") + "(?![a-z])").join("|"), "gi");
const filt = t => t.replace(BAD_RX, m => "*".repeat(m.length));

const fv = v => typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) };
const post = (path, set, method) => fetch(`${ROOT}/${path}${KEY}`, { method, headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, fv(v)])) }) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const add = (col, set) => post(col, set, "POST");
const put = (path, set) => post(path, set, "PATCH");

/* ---------- idle sign-out (60 min) and guest expiry (1 hour) ---------- */
let lastAct = Date.now(), began = Date.now();
["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => {
  if (!$("gate").classList.contains("hide")) return;
  if (Date.now() - lastAct > 36e5) signOut("You were signed out after 60 idle minutes.");
  else if (me.role === "guest" && Date.now() - began > 36e5) signOut("Guest sessions end after 1 hour.");
}, 30000);

/* ---------- avatars ---------- */
const AVATARS = Array.from("🐶🐱🦊🐼🐸🦁🐯🐵🐧🦉🐙🦄🐢🐳🦋🐝🐲🦖🤖👽👻🎃🍇🍉🍕🍩⚽🎮🚀🌈");
const markAv = () => document.querySelectorAll(".av-b").forEach(b => b.classList.toggle("on", b.textContent === me.avatar));
AVATARS.forEach(e => {
  const b = document.createElement("button");
  b.className = "av-b"; b.textContent = e; b.setAttribute("aria-label", "Avatar " + e);
  b.onclick = async () => {
    if (me.role === "guest") return toast("Log in to pick an avatar.");
    try { await patch(me.name, { avatar: e }); me.avatar = e; $("av").textContent = e; markAv(); } catch { toast("Couldn't save your avatar."); }
  };
  $("avs").appendChild(b);
});

/* ---------- update log ---------- */
const UP0 = [
  { v: "v1.0", title: "Fresh start", notes: "+ New login screen\n+ Under-13 sign-ups keep only a username and password hash\n+ Firestore sign-up and login" },
  { v: "v1.1", title: "Chat & Admin", notes: "+ Global chat with bold, underline and hidden text\n+ Admin panel: ban, promote, demote\n+ Delete account with a 90-day bin" },
  { v: "v1.2", title: "Security+", notes: "+ Email and birthday encrypted (Base64, AES-256, Base16)\n+ Kids-only chat room\n~ Settings page redesigned with themes\n- Removed alert() pop-ups" }
];
const VOK = /^v\d+(\.\d+)*$/;
const vcmp = (a, b) => { const x = a.slice(1).split(".").map(Number), y = b.slice(1).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (y[i] || 0) - (x[i] || 0); if (d) return d; } return 0; };
const CH = { "+": ["add", "ADD"], "~": ["chg", "CHANGE"], "-": ["rem", "REMOVE"] };
const chLine = l => { const k = CH[l[0]], t = k ? l.slice(1).trim() : l; return `<li class="ch ${k ? k[0] : "pl"}">${k ? `<b>${k[1]}</b>` : ""}${esc(t)}</li>`; };
let ups = [];
async function loadUpdates() {
  const m = new Map(UP0.map(e => [e.v, e]));
  try { const r = await fetch(`${ROOT}/updates${KEY}&pageSize=100`);
    ((await r.json()).documents || []).map(parseDoc).forEach(o => { if (VOK.test(o.v || "")) m.set(o.v, { v: o.v, title: o.title || "", notes: o.notes || "" }); }); } catch {}
  ups = [...m.values()].sort((a, b) => vcmp(a.v, b.v));
  $("upl").innerHTML = ups.map(e => `<div class="card" style="max-width:560px;margin-bottom:12px"><h3>${esc(e.v)}${isDev() ? ` · <a href="#" data-up="${esc(e.v)}">edit</a>` : ""}</h3><b>${esc(e.title)}</b><ul>${e.notes.split("\n").filter(Boolean).map(chLine).join("")}</ul></div>`).join("");
}
$("upl").addEventListener("click", e => {
  const u = ups.find(x => x.v === e.target.dataset.up); if (!u) return;
  e.preventDefault(); $("up-v").value = u.v; $("up-t").value = u.title; $("up-n").value = u.notes;
});
$("up-save").onclick = async () => {
  const msg = t => { $("up-msg").textContent = t; }, v = $("up-v").value.trim();
  if (!isDev()) return;
  if (!VOK.test(v)) return msg("Version must look like v1.3 (only v, numbers and dots).");
  const title = cleanText($("up-t").value).slice(0, 60), notes = cleanText($("up-n").value).slice(0, 800);
  if (!title) return msg("Add a title.");
  try { await put("updates/" + encodeURIComponent(v), { v, title, notes }); msg("Saved."); loadUpdates(); } catch { msg("Couldn't save."); }
};

/* ---------- help / contact us ---------- */
const shrink = file => new Promise((ok, no) => { // screenshot -> 144p JPEG
  const img = new Image();
  img.onload = () => { const h = 144, w = Math.max(1, Math.round(img.width * h / img.height)), c = document.createElement("canvas");
    c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.6)); };
  img.onerror = no; img.src = URL.createObjectURL(file);
});
$("ct-form").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = t => { $("ct-msg").textContent = t; }, guest = me.role === "guest";
  const doc = { type: "contact", by: guest ? "guest" : me.name, title: cleanText($("ct-title").value).slice(0, 80), details: cleanText($("ct-det").value).slice(0, 1000), t: Date.now() };
  if (guest) {
    const g = $("ct-mail").value.trim();
    if (!/^[^\s@]+@gmail\.com$/i.test(g)) return msg("Enter a Gmail address so we can reply.");
    if (!$("ct-13").checked) return msg("You need to be 13 or older to give us an email.");
    doc.gmail = wrap(g, CHAT_KEY);
  } else if ($("ct-shot").files[0]) {
    const f = $("ct-shot").files[0];
    if (!f.type.startsWith("image/")) return msg("Screenshots must be images.");
    try { doc.shot = await shrink(f); } catch { return msg("Couldn't read that image."); }
  }
  try { await add("reports", doc); $("ct-form").reset(); msg("Sent. Thanks!"); } catch { msg("Couldn't send. Try again."); }
});
const okImg = x => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x || "");
async function loadReports(target) {
  try {
    const r = await fetch(`${ROOT}/reports${KEY}&orderBy=t%20desc&pageSize=50`);
    reportsCache = ((await r.json()).documents || []).map(parseDoc);
    const visible = reportsCache.filter(o => o.status !== "transferred" || isLegal());
    $(target).innerHTML = visible.length ? "<table><tr><th>Type</th><th>From</th><th>Status</th><th>When</th><th></th></tr>" + visible.map(o => {
      const from = o.gmail ? "guest" : esc(o.by || "?");
      const status = o.status === "accepted" ? `with ${esc(o.assignedTo || "?")}` : o.status === "transferred" ? "with Legal" : "open";
      return `<tr><td>${esc(o.type)}</td><td>${from}</td><td>${status}</td><td>${esc(new Date(o.t).toLocaleString())}</td><td><button class="btn" data-ticket="${esc(o.id)}">Open</button></td></tr>`;
    }).join("") + "</table>" : '<p class="mute">Nothing yet.</p>';
  } catch { $(target).textContent = "Couldn't load reports."; }
}

/* ---------- generic partial doc update (reports, pwreq, bots live outside the users collection) ---------- */
async function patchDoc(path, set) {
  const mask = Object.keys(set).map(k => "&updateMask.fieldPaths=" + k).join("");
  const fields = {}; for (const k in set) fields[k] = fv(set[k]);
  const r = await fetch(`${ROOT}/${path}${KEY}${mask}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error("patch " + r.status);
}

/* ---------- tickets (chat reports & contact-us) ---------- */
function ticketHTML(o) {
  const canAct = isMod() && (o.status !== "transferred" || isLegal());
  let body;
  if (o.type === "message") {
    body = `<p class="mute">Chat report</p><p><b>${esc(o.author)}</b> said: ${esc(o.text)}</p><p class="mute">Reported by ${esc(o.by)}</p>`;
  } else {
    const from = o.gmail ? esc(unwrap(o.gmail, CHAT_KEY) || "?") + " (guest)" : esc(o.by || "?");
    body = `<p class="mute">Contact us, from ${from}</p><b>${esc(o.title)}</b><p>${esc(o.details)}</p>${okImg(o.shot) ? `<img src="${o.shot}" alt="screenshot">` : ""}<p class="mute" id="tk-viewer"></p><div id="tk-thread" style="max-height:200px;overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0"></div>`;
  }
  let acts;
  if (!canAct) acts = o.status === "transferred" ? '<p class="mute">Transferred to Legal. Only Legal and the owner can respond now.</p>' : "";
  else {
    const mine = o.status === "accepted" && o.assignedTo === me.name;
    acts = (!o.status || o.status === "open" ? `<button class="btn" data-tk="accept">Accept</button>` : "") +
      (mine && o.type === "message" ? `<button class="btn red" data-tk="delmsg">Delete message</button><button class="btn" data-tk="keep">Keep</button><button class="btn" data-tk="warn">Warn</button>` : "") +
      (mine && o.type === "contact" ? `<input class="fld" id="tk-reply" placeholder="Type a reply" style="width:auto;flex:1;margin:0"><button class="btn" data-tk="reply">Send</button>` : "") +
      (mine ? `<button class="btn" data-tk="queue">Return to queue</button>` : "") +
      (mine && me.role !== "legal" ? `<button class="btn" data-tk="legal">Transfer to Legal</button>` : "") +
      (isLegal() && o.status === "transferred" ? `<button class="btn" data-tk="accept">Accept</button><button class="btn" data-tk="queue">Decline</button>` : "") +
      `<button class="btn red" data-tk="del">Delete ticket</button>`;
  }
  return `<b>Ticket</b>${body}<div class="acts">${acts}<button class="btn" id="tk-close">Close</button></div>`;
}
let curTicket = null, viewerTimer = null;
function openTicket(id) {
  const o = reportsCache.find(x => x.id === id); if (!o) return;
  curTicket = o;
  $("ticket-body").innerHTML = ticketHTML(o);
  $("ticket").classList.remove("hide");
  $("ticket-body").querySelector("#tk-close").onclick = () => { clearInterval(viewerTimer); $("ticket").classList.add("hide"); };
  const log = $("ticket-body").querySelector("#tk-thread");
  if (o.type === "contact" && log && window.listenDM) window.listenDM("ticket:" + o.id, list => {
    log.innerHTML = list.map(m => `<p class="msg"><b>${esc(m.u)}</b>: ${esc(dec(m.x))}</p>`).join("") || '<p class="mute">No messages yet.</p>';
    log.scrollTop = log.scrollHeight;
  });
  const mine = isMod() && o.status === "accepted" && o.assignedTo === me.name && o.by && o.by !== "guest";
  if (mine) {
    const show = async () => { try { const d = await getUser(o.by); const el = $("ticket-body").querySelector("#tk-viewer"); if (el) el.textContent = d && d.curTab ? `Currently viewing: ${d.curTab}` : ""; } catch {} };
    show(); viewerTimer = setInterval(show, 15000);
  }
}
$("ticket-body").addEventListener("click", async e => {
  const act = e.target.dataset.tk; if (!act || !curTicket) return;
  const o = curTicket, close = () => { $("ticket").classList.add("hide"); loadReports(isLegal() ? "lg-reports" : "a-reports"); };
  try {
    if (act === "accept") { await patchDoc("reports/" + o.id, { status: "accepted", assignedTo: me.name }); if (o.by && o.by !== "guest") await add("notices", { to: o.by, type: "accepted", text: "Your ticket was accepted and is being worked on.", t: Date.now() }); close(); }
    else if (act === "queue") { await patchDoc("reports/" + o.id, { status: "open", assignedTo: "" }); close(); }
    else if (act === "legal") { await patchDoc("reports/" + o.id, { status: "transferred", assignedTo: "" }); close(); }
    else if (act === "del") { await fetch(`${ROOT}/reports/${encodeURIComponent(o.id)}${KEY}`, { method: "DELETE" }); close(); }
    else if (act === "delmsg") { await fetch(`${ROOT}/chat/${encodeURIComponent(o.msgId)}${KEY}`, { method: "DELETE" }); await patchDoc("reports/" + o.id, { resolution: "deleted" }); close(); }
    else if (act === "keep") { await patchDoc("reports/" + o.id, { resolution: "kept" }); close(); }
    else if (act === "warn") { await add("notices", { to: o.author, type: "warn", text: "A moderator warned you about a reported message.", t: Date.now() }); await patchDoc("reports/" + o.id, { resolution: "warned" }); close(); }
    else if (act === "reply") {
      const box = $("tk-reply"), raw = box.value.trim(); if (!raw) return;
      box.value = "";
      if (raw.startsWith("/") && isDev()) { toast(await runCommand(raw)); return; } // runs locally for you only, never on the user's side
      const txt = cleanText(raw).slice(0, 500);
      await add("dm", { room: "ticket:" + o.id, u: me.name, x: wrap(txt, CHAT_KEY), t: Date.now() });
      if (o.by && o.by !== "guest") await add("notices", { to: o.by, type: "ticket", text: "Support replied to your ticket.", t: Date.now() });
    }
  } catch { toast("That didn't work."); }
});
document.body.addEventListener("click", e => { if (e.target.dataset.ticket) { e.preventDefault(); openTicket(e.target.dataset.ticket); } });

/* ---------- notices: ticket updates, 1-on-1 invites, warnings ---------- */
function listenMine() {
  if (!window.listenNotices) return;
  window.listenNotices(me.name, list => list.forEach(showNotice));
}
const seenNotice = new Set();
let assistTimer = null;
function showAssist(mins) {
  clearTimeout(assistTimer);
  const until = Date.now() + mins * 60000;
  const tick = () => {
    const left = Math.ceil((until - Date.now()) / 60000);
    if (left <= 0) { $("notice").classList.add("hide"); return; }
    $("notice").innerHTML = `An admin is helping with your ticket (~${left} min left). <button id="nmore">Need more time?</button>`;
    $("notice").classList.remove("hide");
    $("notice").querySelector("#nmore").onclick = () => showAssist(10);
    assistTimer = setTimeout(tick, 15000);
  };
  tick();
}
function showNotice(n) {
  if (seenNotice.has(n.id)) return; seenNotice.add(n.id);
  fetch(`${ROOT}/notices/${encodeURIComponent(n.id)}${KEY}`, { method: "DELETE" }).catch(() => {});
  if (n.type === "invite") {
    if (Date.now() > n.t + 10000) return;
    const box = $("notice");
    box.innerHTML = `${esc(n.from)} wants to 1-on-1 chat. <button id="ninv-join">Join</button>`;
    box.classList.remove("hide");
    const timer = setTimeout(() => box.classList.add("hide"), Math.max(0, 10000 - (Date.now() - n.t)));
    box.querySelector("#ninv-join").onclick = () => { clearTimeout(timer); box.classList.add("hide"); openDM(n.from); };
  } else if (n.type === "accepted") { toast(n.text); showAssist(10); }
  else toast(n.text || "You have a new notice.");
}

/* ---------- 1-on-1 chat (admin-user DM; not end-to-end private under open rules, see Firestore rules) ---------- */
const dmRoom = (a, b) => [a, b].sort().join("~");
let curDM = null;
function openDM(other) {
  curDM = other;
  $("dm-title").textContent = "Chat with " + other;
  $("dmlog").innerHTML = "";
  $("dm").classList.remove("hide");
  if (window.listenDM) window.listenDM(dmRoom(me.name, other), list => {
    $("dmlog").innerHTML = list.map(m => `<p class="msg"><b>${esc(m.u)}</b>: ${esc(dec(m.x))}</p>`).join("") || '<p class="mute">Say hi!</p>';
    $("dmlog").scrollTop = $("dmlog").scrollHeight;
  });
}
$("dm-close").onclick = () => $("dm").classList.add("hide");
$("dm-form").addEventListener("submit", async e => {
  e.preventDefault();
  const x = cleanText($("dm-in").value).slice(0, 500); if (!x || !curDM) return;
  $("dm-in").value = "";
  try { await add("dm", { room: dmRoom(me.name, curDM), u: me.name, x: wrap(x, CHAT_KEY), t: Date.now() }); } catch { toast("Message didn't send."); }
});
function invite(other) {
  add("notices", { to: other, type: "invite", from: me.name, t: Date.now() })
    .then(() => toast("Invite sent — they have 10 seconds to join."))
    .catch(() => toast("Couldn't send the invite."));
}

/* ---------- account creation (dev+) ---------- */
$("nu-save").onclick = async () => {
  const msg = t => { $("nu-msg").textContent = t; };
  if (!isDev()) return;
  const u = $("nu-user").value.trim(), dob = $("nu-dob").value, pw = $("nu-pass").value, em = $("nu-mail").value;
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)) return msg("Usernames can use letters, numbers, _ . - (3 to 24 characters).");
  const age = tier(dob);
  if (!age) return msg("Enter a valid birth date.");
  if (pw.length < 6) return msg("Password needs 6+ characters.");
  try {
    if (await getUser(u)) return msg("That username is taken.");
    const salt = CryptoJS.lib.WordArray.random(16).toString(), k = deriveKey(pw, salt);
    const box = age === "1" ? {} : { gmail: wrap(em, k), dob: wrap(dob, k) };
    await saveUser(u, { age, salt, hash: hash(pw, salt), ...box, role: "user" });
    msg("Account created — share the username and temporary password with them. They'll know the password, so suggest they change it.");
    $("nu-user").value = ""; $("nu-dob").value = ""; $("nu-mail").value = ""; $("nu-pass").value = "";
  } catch { msg("Couldn't create the account."); }
};

/* ---------- password-change approval (owner/dev instantly, or 3 distinct admins) ---------- */
async function loadPwReqs() {
  if (!isAdmin()) { $("pw-list").innerHTML = ""; return; }
  try {
    const r = await fetch(`${ROOT}/pwreq${KEY}&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc);
    $("pw-list").innerHTML = rows.length ? "<table><tr><th>For</th><th>By</th><th>Approvals</th><th></th></tr>" + rows.map(o => {
      const approvals = (o.approvals || "").split(",").filter(Boolean);
      return `<tr><td>${esc(o.target)}</td><td>${esc(o.by)}</td><td>${isDev() ? "owner/dev approval" : approvals.length + "/3 admins"}</td><td>${o.by !== me.name ? `<button class="btn" data-appr="${esc(o.id)}">Approve</button>` : '<span class="mute">awaiting others</span>'} <button class="btn red" data-pwdel="${esc(o.id)}">Cancel</button></td></tr>`;
    }).join("") + "</table>" : '<p class="mute">No pending requests.</p>';
  } catch { $("pw-list").textContent = "Couldn't load requests."; }
}
async function applyPwChange(o, target, id) {
  const hist = JSON.parse((target && target.pwHistory) || "[]");
  const newHist = target ? [{ salt: target.salt, hash: target.hash }, ...hist].slice(0, 5) : hist;
  await patch(o.target, { salt: o.salt, passwordHash: o.hash, pwHistory: JSON.stringify(newHist) });
  if (id) await fetch(`${ROOT}/pwreq/${encodeURIComponent(id)}${KEY}`, { method: "DELETE" });
  toast("Password changed.");
}
$("pw-req").onclick = async () => {
  const msg = t => { $("pw-msg").textContent = t; };
  if (!isAdmin()) return msg("Only admins and above can start a request.");
  const u = $("pw-user").value.trim(), pw = $("pw-new").value;
  try {
    const target = await getUser(u);
    if (!target) return msg("No account with that username.");
    const minLen = rk(target.role || "user") >= 6 ? 20 : 6;
    if (pw.length < minLen) return msg(`That account needs a ${minLen}+ character password.`);
    const hist = JSON.parse(target.pwHistory || "[]");
    if (hist.some(h => hash(pw, h.salt) === h.hash) || hash(pw, target.salt) === target.hash) return msg("That matches one of their recent passwords.");
    const salt = CryptoJS.lib.WordArray.random(16).toString(), o = { target: u, salt, hash: hash(pw, salt) };
    if (me.role === "owner") { await applyPwChange(o, target, null); msg("Done - no approval needed for the owner."); }
    else { await add("pwreq", { target: u, salt, hash: hash(pw, salt), by: me.name, approvals: "" });
      msg("Requested. Needs 2 admins/head admins, or 1 dev/owner, to approve."); }
    $("pw-user").value = ""; $("pw-new").value = "";
    loadPwReqs();
  } catch { msg("Couldn't submit the request."); }
};
$("pw-list").addEventListener("click", async e => {
  const id = e.target.dataset.appr, del = e.target.dataset.pwdel;
  if (!id && !del) return;
  e.preventDefault();
  try {
    if (del) { if (isAdmin()) await fetch(`${ROOT}/pwreq/${encodeURIComponent(del)}${KEY}`, { method: "DELETE" }); loadPwReqs(); return; }
    const r = await fetch(`${ROOT}/pwreq/${encodeURIComponent(id)}${KEY}`);
    if (!r.ok) return loadPwReqs();
    const o = parseDoc(await r.json());
    if (o.by === me.name) return;
    const target = await getUser(o.target);
    if (rk(me.role) >= 6) await applyPwChange(o, target, id); // dev or owner: one approval is enough
    else if (isAdmin()) { // admin or head admin: need 2 distinct such approvals
      const approvals = (o.approvals || "").split(",").filter(Boolean);
      if (!approvals.includes(me.name)) approvals.push(me.name);
      if (approvals.length >= 2) await applyPwChange(o, target, id);
      else await patchDoc("pwreq/" + id, { approvals: approvals.join(",") });
    }
    loadPwReqs();
  } catch { toast("That didn't work."); }
});

/* ---------- chat bots ---------- */
async function loadBots() {
  if (!canBot()) { $("bot-list").innerHTML = ""; return; }
  try {
    const r = await fetch(`${ROOT}/bots${KEY}&pageSize=50`);
    bots = ((await r.json()).documents || []).map(parseDoc);
    $("bot-list").innerHTML = bots.length ? "<table><tr><th>Name</th><th>Keywords</th><th>Strikes</th><th>Action</th><th>On</th><th></th></tr>" + bots.map(b =>
      `<tr><td>${esc(b.name)}</td><td>${esc(b.words)}</td><td>${b.x}</td><td>${b.action === "ban" ? b.hours + "h ban" : "warn"}</td><td>${b.on ? "yes" : "no"}</td><td><button class="btn red" data-botdel="${esc(b.id)}">Delete</button></td></tr>`).join("") + "</table>" : '<p class="mute">No bots yet.</p>';
  } catch { $("bot-list").textContent = "Couldn't load bots."; }
}
$("bot-save").onclick = async () => {
  const msg = t => { $("bot-msg").textContent = t; };
  if (!canBot()) return;
  const name = cleanText($("bot-name").value).slice(0, 40), words = cleanText($("bot-words").value).slice(0, 300);
  const x = Number($("bot-x").value), action = $("bot-action").value, hours = Number($("bot-hours").value) || 1;
  if (!name || !words || !(x > 0)) return msg("Fill in a name, keywords and strike count.");
  try {
    await add("bots", { name, words, x, action, hours, on: $("bot-on").checked, from: $("bot-from").value || "", to: $("bot-to").value || "" });
    msg("Saved."); $("bot-name").value = ""; $("bot-words").value = ""; $("bot-x").value = "";
    loadBots();
  } catch { msg("Couldn't save."); }
};
$("bot-list").addEventListener("click", async e => {
  const id = e.target.dataset.botdel; if (!id || !canBot()) return;
  e.preventDefault();
  try { await fetch(`${ROOT}/bots/${encodeURIComponent(id)}${KEY}`, { method: "DELETE" }); loadBots(); } catch {}
});
async function botCheck(text, d) {
  const hm = new Date().toTimeString().slice(0, 5);
  for (const b of bots) {
    if (!b.on) continue;
    if (b.from && b.to && !(b.from <= hm && hm <= b.to)) continue; // only active in its time window, if one is set
    const words = (b.words || "").split(",").map(w => w.trim().toLowerCase()).filter(Boolean);
    if (!words.some(w => text.toLowerCase().includes(w))) continue;
    const field = "strikes_" + b.id, n = (d[field] || 0) + 1;
    if (n >= b.x) { await patch(me.name, { [field]: 0 }); return b; }
    await patch(me.name, { [field]: n });
  }
  return null;
}

/* ---------- legal panel ---------- */
async function loadLegal() {
  loadReports("lg-reports");
  try {
    const r = await fetch(`${DB}${KEY}&pageSize=300`);
    const all = ((await r.json()).documents || []).map(parseDoc);
    const kids = all.filter(u => u.age === "1" && !u.deletedAt);
    $("lg-kids").innerHTML = kids.length ? "<table><tr><th>User</th></tr>" + kids.map(u => `<tr><td>${esc(u.id)}</td></tr>`).join("") + "</table>" : '<p class="mute">None.</p>';
    legalBin = all.filter(u => u.deletedAt);
    $("lg-bin").innerHTML = legalBin.length ? "<table><tr><th>User</th><th>Status</th><th></th></tr>" + legalBin.map(u =>
      `<tr><td>${esc(u.id)}</td><td>${u.legalHold ? "on hold" : Math.ceil((u.purgeAt - Date.now()) / 864e5) + " days left"}</td><td><button class="btn" data-hold="${esc(u.id)}">${u.legalHold ? "Unpause" : "Pause"}</button> <button class="btn" data-lexport="${esc(u.id)}">Export JSON</button> <button class="btn red" data-lperm="${esc(u.id)}">Perm delete</button></td></tr>`).join("") + "</table>" : '<p class="mute">Nothing in the bin.</p>';
  } catch { $("lg-kids").textContent = "Couldn't load."; }
  try {
    const r = await fetch(`${ROOT}/reports${KEY}&orderBy=t%20desc&pageSize=50`);
    const rows = ((await r.json()).documents || []).map(parseDoc).filter(o => o.status === "transferred");
    $("lg-trans").innerHTML = rows.length ? "<table><tr><th>Type</th><th>From</th><th></th></tr>" + rows.map(o =>
      `<tr><td>${esc(o.type)}</td><td>${esc(o.by || "?")}</td><td><button class="btn" data-ticket="${esc(o.id)}">Open</button> <button class="btn red" data-tkdel="${esc(o.id)}">Delete</button></td></tr>`).join("") + "</table>" : '<p class="mute">Nothing transferred.</p>';
  } catch { $("lg-trans").textContent = "Couldn't load."; }
}
document.body.addEventListener("click", async e => {
  if (e.target.dataset.hold && isLegal()) {
    e.preventDefault();
    const u = legalBin.find(x => x.id === e.target.dataset.hold); if (!u) return;
    try { await patch(u.id, { legalHold: !u.legalHold }); loadLegal(); } catch { toast("Couldn't update."); }
  }
  if (e.target.dataset.lexport && isLegal()) {
    e.preventDefault();
    const u = legalBin.find(x => x.id === e.target.dataset.lexport); if (!u) return;
    const clean = { ...u }; delete clean.salt; delete clean.passwordHash; delete clean.pwHistory; // never export credential material
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" }));
    a.download = u.id + ".json"; a.click(); URL.revokeObjectURL(a.href);
  }
  if (e.target.dataset.lperm) {
    const t = e.target; if (!isLegal()) return;
    e.preventDefault();
    if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "Sure? Click again"; setTimeout(() => { t.dataset.armed = ""; t.textContent = "Perm delete"; }, 4000); return; }
    try { await fetch(`${DB}/${encodeURIComponent(t.dataset.lperm)}${KEY}`, { method: "DELETE" }); loadLegal(); } catch { toast("Couldn't delete."); }
  }
  if (e.target.dataset.tkdel && isLegal()) {
    e.preventDefault();
    try { await fetch(`${ROOT}/reports/${encodeURIComponent(e.target.dataset.tkdel)}${KEY}`, { method: "DELETE" }); loadLegal(); } catch {}
  }
});

/* ---------- TOS (legal/owner edit, everyone can read) ---------- */
async function loadTos() {
  try {
    const r = await fetch(`${ROOT}/meta/tos${KEY}`);
    const text = r.ok ? (parseDoc(await r.json()).text || "") : "";
    $("tos-text").textContent = text || "No Terms of Service have been posted yet.";
    $("tos-area").value = text;
  } catch { $("tos-text").textContent = "Couldn't load the Terms of Service."; }
  $("tos-editbtn").classList.toggle("hide", !isLegal());
}
$("tos-editbtn").onclick = () => { $("tos-edit").classList.remove("hide"); $("tos-text").classList.add("hide"); };
$("tos-save").onclick = async () => {
  if (!isLegal()) return;
  try { await put("meta/tos", { text: $("tos-area").value.slice(0, 20000) }); $("tos-msg").textContent = "Saved."; loadTos(); $("tos-edit").classList.add("hide"); $("tos-text").classList.remove("hide"); }
  catch { $("tos-msg").textContent = "Couldn't save."; }
};

/* ---------- message of the day, about card, ad rotator ---------- */
async function loadMotd() {
  try {
    const r = await fetch(`${ROOT}/meta/motd${KEY}`);
    const text = r.ok ? parseDoc(await r.json()).text : "";
    $("motd-text").textContent = text || "";
    $("motd-banner").classList.toggle("hide", !text);
  } catch {}
}
async function loadAbout() {
  $("about-edit").classList.toggle("hide", !isDev());
  try {
    const r = await fetch(`${ROOT}/meta/about${KEY}`);
    const text = r.ok ? parseDoc(await r.json()).text : "";
    if (text) { $("about-text").textContent = text; $("about-area").value = text; }
  } catch {}
}
$("about-edit").onclick = () => { $("about-form").classList.remove("hide"); };
$("about-save").onclick = async () => {
  if (!isDev()) return;
  try { await put("meta/about", { text: $("about-area").value.slice(0, 1000) }); $("about-msg").textContent = "Saved."; loadAbout(); $("about-form").classList.add("hide"); }
  catch { $("about-msg").textContent = "Couldn't save."; }
};
const ADS = ["Your ad here - Slot 1", "Your ad here - Slot 2", "Your ad here - Slot 3", "Your ad here - Slot 4", "Your ad here - Slot 5"];
let adIdx = 0;
function rotateAds() { $("ad-rotator").textContent = ADS[adIdx % ADS.length]; adIdx++; }
rotateAds(); setInterval(rotateAds, 30000);
const HELP_TEXT = "/help  /clear  /clear_cache  /refresh_force  /bug_list  /prompt_reload  /whoami  /stats  /motd <text>  /theme <name>  /uptime";
const BUGS = ["none"];
async function runCommand(raw) {
  const [cmd, ...rest] = raw.slice(1).split(" "), arg = rest.join(" ");
  if (cmd === "help") return HELP_TEXT;
  if (cmd === "clear") { sessionStorage.clear(); return "Cleared this tab's session cache."; }
  if (cmd === "clear_cache") { sessionStorage.clear(); localStorage.clear(); return "Cleared session and local storage for this site."; }
  if (cmd === "refresh_force") { setTimeout(() => location.reload(), 300); return "Reloading..."; }
  if (cmd === "bug_list") return BUGS.map((b, i) => (i + 1) + ". " + b).join("\n");
  if (cmd === "prompt_reload") { await loadUpdates(); await loadBots(); return "Reloaded the update log and bots from Firestore."; }
  if (cmd === "whoami") return `${me.name} — ${RNAME[me.role] || me.role}`;
  if (cmd === "stats") { try { const r = await fetch(`${DB}${KEY}&pageSize=300`); return `${((await r.json()).documents || []).length} accounts on file.`; } catch { return "Couldn't load stats."; } }
  if (cmd === "motd") { if (!arg) return "Usage: /motd <text>"; try { await put("meta/motd", { text: arg.slice(0, 200) }); return "Message of the day updated."; } catch { return "Couldn't save."; } }
  if (cmd === "theme") { if (!THEMES[arg]) return "Themes: " + Object.keys(THEMES).join(", "); setTheme(arg); return "Theme set to " + arg + "."; }
  if (cmd === "uptime") return "This session has been open for " + Math.round((Date.now() - began) / 60000) + " minute(s).";
  return "Unknown command. Try /help.";
}
$("cmd-in").addEventListener("keydown", async e => {
  if (e.key !== "Enter") return;
  const raw = e.target.value.trim(); if (!raw.startsWith("/") || !isDev()) return;
  e.target.value = "";
  toast(await runCommand(raw));
});

/* ---------- support bot (rule-based, not real ML) ---------- */
const LEGAL_WORDS = ["court", "sue", "sued", "suing", "lawsuit", "attorney", "lawyer", "legal action", "subpoena"];
const HUMAN_WORDS = ["human", "representative", "real person", "talk to someone", "speak to someone", "speak with someone", "agent"];
let botTicket = null, botLocked = false, botSynced = new Set();
document.getElementById("bot-tos-link").onclick = e => { e.preventDefault(); switchTab("tos"); };
document.getElementById("ct-tos-link").onclick = e => { e.preventDefault(); switchTab("tos"); };
function botSay(text) { $("bot-chat-log").insertAdjacentHTML("beforeend", `<p class="msg"><b>Bot</b>: ${esc(text)}</p>`); $("bot-chat-log").scrollTop = $("bot-chat-log").scrollHeight; }
function botUserSay(text) { $("bot-chat-log").insertAdjacentHTML("beforeend", `<p class="msg"><b>You</b>: ${esc(text)}</p>`); $("bot-chat-log").scrollTop = $("bot-chat-log").scrollHeight; }
$("bot-agree").onclick = () => { $("bot-chat-intro").classList.add("hide"); $("bot-chat-form").classList.remove("hide"); botSay("Thanks! What can I help you with?"); };
$("bot-decline").onclick = () => botSay("No problem — you can read the Terms any time, and come back when you're ready.");
function listenBotTicket() {
  if (!window.listenDM) return;
  const me2 = me.role === "guest" ? "guest" : me.name;
  window.listenDM("ticket:" + botTicket, list => list.forEach(m => {
    if (botSynced.has(m.id) || m.u === me2) return;
    botSynced.add(m.id);
    $("bot-chat-log").insertAdjacentHTML("beforeend", `<p class="msg"><b>${esc(m.u)}</b>: ${esc(dec(m.x))}</p>`);
    $("bot-chat-log").scrollTop = $("bot-chat-log").scrollHeight;
  }));
}
$("bot-chat-form").addEventListener("submit", async e => {
  e.preventDefault();
  const x = cleanText($("bot-chat-in").value).slice(0, 500); if (!x) return;
  $("bot-chat-in").value = ""; botUserSay(x);
  if (botLocked) { botSay("This chat has been passed to Legal — refresh the page to start a new help chat."); return; }
  const low = x.toLowerCase(), by = me.role === "guest" ? "guest" : me.name;
  try {
    if (LEGAL_WORDS.some(w => low.includes(w))) {
      botLocked = true;
      const doc = await add("reports", { type: "contact", by, title: "Escalated by support bot", details: x, status: "transferred", t: Date.now() });
      botTicket = doc.name.split("/").pop();
      await add("dm", { room: "ticket:" + botTicket, u: by, x: wrap(x, CHAT_KEY), t: Date.now() });
      botSay("I'm not able to continue this conversation. I've passed it to our Legal team — they'll reply here, so keep this tab open if you can.");
      listenBotTicket();
    } else if (HUMAN_WORDS.some(w => low.includes(w)) && !botTicket) {
      const doc = await add("reports", { type: "contact", by, title: "Escalated by support bot", details: x, status: "open", t: Date.now() });
      botTicket = doc.name.split("/").pop();
      await add("dm", { room: "ticket:" + botTicket, u: by, x: wrap(x, CHAT_KEY), t: Date.now() });
      botSay("I've created a ticket — a team member will join this chat shortly. Keep this tab open if you can.");
      listenBotTicket();
    } else if (botTicket) {
      await add("dm", { room: "ticket:" + botTicket, u: by, x: wrap(x, CHAT_KEY), t: Date.now() });
    } else {
      botSay(low.includes("password") ? "You can change your password from Settings." : low.includes("ban") ? "If a ban seems wrong, tell me more and I'll pass it to the team if needed." : "Got it — tell me more, or say \"human\" to talk to a team member.");
    }
  } catch { botSay("Something went wrong sending that. Try again."); }
});

/* ---------- staff chat (mod+) ---------- */
let staffMsgs = [];

function renderStaff() {
  const box = $("staff-msgs");
  box.innerHTML = staffMsgs.map(m => {
    const text = dec(m.x || "");
    return `<p class="msg"><b>${esc(m.u || "Unknown")}</b>: ${esc(text)}</p>`;
  }).join("") || '<p class="mute">No staff messages yet.</p>';
  box.scrollTop = box.scrollHeight;
}

let staffUnsubscribe = null;

function listenStaffChat() {
  if (!isMod()) return;
  if (staffUnsubscribe) return;

  const box = $("staff-msgs");

  if (typeof window.listenStaff !== "function") {
    box.textContent = "Staff chat is still initializing. Try opening it again.";
    return;
  }

  staffUnsubscribe = window.listenStaff(
    list => {
      staffMsgs = list.slice().reverse();
      renderStaff();
    },
    error => {
      staffUnsubscribe = null;
      console.error("Staff chat listener failed:", error);
      box.textContent =
        "Couldn't load staff chat. Check the browser console.";
    }
  );
}

$("staff-form").addEventListener("submit", async e => {
  e.preventDefault();
  const x = cleanText($("staff-in").value).slice(0, 500);
  if (!x || !isMod()) return;

  $("staff-in").value = "";

  try {
    await fetch(`${ROOT}/staffchat${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          u: { stringValue: me.name },
          x: { stringValue: wrap(x, CHAT_KEY) },
          r: { stringValue: me.role },
          t: { integerValue: String(Date.now()) }
        }
      })
    });
  } catch {
    toast("Message didn't send.");
  }
});

/* ---------- safe markdown subset for profile bios (escape first, then a few tags; links need http(s)) ---------- */
function mdSafe(text) {
  let s2 = esc(text);
  s2 = s2.replace(/\[([^\]]{1,60})\]\((https?:\/\/[^\s)]{1,300})\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  return s2.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<u>$1</u>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\n/g, "<br>");
}

/* ---------- my public profile (18+ only; minors never appear in the directory) ---------- */
function renderLinkRows(links) {
  $("link-rows").innerHTML = links.map((l, i) => `<div style="display:flex;gap:6px;margin:4px 0">
    <input class="fld" style="margin:0" data-lbl="${i}" placeholder="Label" value="${esc(l.label || "")}">
    <input class="fld" style="margin:0;flex:1" data-url="${i}" placeholder="https://..." value="${esc(l.url || "")}">
    <button class="btn red" type="button" data-rm="${i}">×</button></div>`).join("");
}
let myLinks = [];
$("link-add").onclick = () => { if (myLinks.length < 5) { myLinks.push({ label: "", url: "" }); renderLinkRows(myLinks); } };
$("link-rows").addEventListener("click", e => { if (e.target.dataset.rm !== undefined && e.target.dataset.rm !== "") { myLinks.splice(+e.target.dataset.rm, 1); renderLinkRows(myLinks); } });
$("link-rows").addEventListener("input", e => {
  const i = e.target.dataset.lbl ?? e.target.dataset.url;
  if (i === undefined) return;
  if (e.target.dataset.lbl !== undefined) myLinks[+i].label = e.target.value; else myLinks[+i].url = e.target.value;
});
async function loadMyProfile() {
  try {
    const d = await getUser(me.name);
    $("bio-area").value = (d && d.bio) || "";
    myLinks = JSON.parse((d && d.links) || "[]");
    renderLinkRows(myLinks);
  } catch {}
}
$("profile-save").onclick = async () => {
  const msg = t => { $("profile-msg").textContent = t; };
  const bio = cleanText($("bio-area").value).slice(0, 500);
  const links = myLinks.filter(l => l.label && /^https?:\/\//.test(l.url)).slice(0, 5);
  try { await patch(me.name, { bio, links: JSON.stringify(links) }); msg("Saved."); } catch { msg("Couldn't save."); }
};

/* ---------- Users directory (adults only — minors never listed or searchable here) ---------- */
let directory = [];
async function loadUsers() {
  const box = $("user-list");
  box.textContent = "Loading users...";

  try {
    const response = await fetch(`${DB}${KEY}&pageSize = 300`);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `Firestore returned HTTP ${response.status}`
      );
    }

    directory = (data.documents || [])
      .map(parseDoc)
      .filter(user =>
        !user.deletedAt &&
        (user.age === "3" || user.age === "4")
      );

    renderUsers();
  } catch (error) {
    console.error("Users lookup failed:", error);
    box.textContent = "Couldn't load users. Check the browser console.";
  }
}
function renderUsers() {
  const q = $("user-search").value.trim().toLowerCase();
  const rows = directory.filter(u => !q || u.id.toLowerCase().includes(q));
  $("user-list").innerHTML = rows.length ? rows.map(u => `<div class="card" style="max-width:560px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px"><div class="userav" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--grape2),var(--leaf));color:#fff;display:grid;place-items:center;font-size:18px;font-weight:800">${esc(u.avatar || u.id[0].toUpperCase())}</div><b>${esc(u.id)}</b></div>
    ${u.bio ? `<p style="margin:8px 0 0">${mdSafe(u.bio)}</p>` : ""}
    ${(() => { try { const ls = JSON.parse(u.links || "[]"); return ls.length ? `<div style="margin-top:8px">${ls.map(l => `<a class="btn" style="display:inline-block;margin:2px 4px 0 0;text-decoration:none" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`).join("")}</div>` : ""; } catch { return ""; } })()}
  </div>`).join("") : '<p class="mute">No one found.</p>';
}
$("user-search").addEventListener("input", renderUsers);

/* ---------- Your tickets (two-way thread for the plain Contact Us path too) ---------- */
async function loadMyTickets() {
  try {
    const r = await fetch(`${ROOT}/reports${KEY}&orderBy=t%20desc&pageSize=50`);
    const mine = ((await r.json()).documents || []).map(parseDoc).filter(o => o.by === me.name);
    $("mytickets").innerHTML = mine.length ? mine.map(o => `<div class="card" style="margin-bottom:10px">
      <b>${esc(o.title || "Chat report")}</b> <span class="mute">(${o.status || "open"})</span>
      <div id="mt-${esc(o.id)}" style="max-height:160px;overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0"></div>
      <form data-room="ticket:${esc(o.id)}" class="mt-form" style="display:flex;gap:6px"><input class="fld" style="margin:0;flex:1" placeholder="Reply..."><button class="btn">Send</button></form>
    </div>`).join("") : '<p class="mute">No tickets yet.</p>';
    mine.forEach(o => { if (window.listenDM) window.listenDM("ticket:" + o.id, list => {
      const el = document.getElementById("mt-" + o.id); if (!el) return;
      el.innerHTML = list.map(m => `<p class="msg"><b>${esc(m.u)}</b>: ${esc(dec(m.x))}</p>`).join("") || '<p class="mute">No messages yet.</p>';
      el.scrollTop = el.scrollHeight;
    }); });
  } catch { $("mytickets").textContent = "Couldn't load your tickets."; }
}
$("mytickets").addEventListener("submit", async e => {
  if (!e.target.classList.contains("mt-form")) return;
  e.preventDefault();
  const input = e.target.querySelector("input"), x = cleanText(input.value).slice(0, 500); if (!x) return;
  input.value = "";
  try { await add("dm", { room: e.target.dataset.room, u: me.name, x: wrap(x, CHAT_KEY), t: Date.now() }); } catch { toast("Message didn't send."); }
});

/* ---------- code advice ---------- */
const SKELETON = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Page</title>
    <style>
        body {
            background-color: #f5f5f5;
            font-family: sans-serif;
            padding: 20px;
        }
        .btn {
            background-color: #00ff00;
            height: 50px;
            width: 150px; /* Widened slightly so text fits cleanly */
            cursor: pointer;
            font-weight: bold;
        }
        .counter {
            font-size: 24px;
            margin-top: 150px;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <button class="btn" onclick="addPoop()">poopysa buttcheek</button>
<p>search HELLO_its_me</p>
    <!-- Added a paragraph tag to display the actual score -->
    <p class="counter">Total: <span id="score">0</span></p>

    <script>
        let poop = 0;

        function addPoop() {
            poop += 7;
            // This line finds the 'score' element and changes its text to the new total
            document.getElementById("score").innerText = poop;
        }
    <\/script>
</body>
</html>`;
$("skeleton").textContent = SKELETON;
$("copy").onclick = async () => {
  try { await navigator.clipboard.writeText(SKELETON); $("copy").textContent = "Copied"; }
  catch { $("copy").textContent = "Press Ctrl+C"; }
  setTimeout(() => $("copy").textContent = "Copy", 1500);
};
  /* Sync the "hello its me" span with the OwnerName variable and current owner user */
(function () {
  function updateOwnerSpan() {
    const el = document.getElementById("OwnerName");
    if (!el) return;
    // If the signed-in user is the owner, prefer the signed-in name (me.name).
    // Otherwise fall back to the OwnerName variable, the span's "var" attr, or current text.
    const name = (typeof me !== "undefined" && me.role === "owner" && me.name)
      ? me.name
      : (typeof OwnerName !== "undefined" ? OwnerName : el.getAttribute("var") || el.textContent);
    el.textContent = name;
  }

  // expose helper in case you want to call it from console
  window.updateOwnerSpan = updateOwnerSpan;

  // run now
  updateOwnerSpan();

  // ensure it's updated whenever the app's enter() function runs (user login / enter)
  if (typeof enter === "function") {
    const _enter = enter;
    enter = function (u, d) {
      const res = _enter(u, d);
      try { updateOwnerSpan(); } catch (e) { /* ignore */ }
      return res;
    };
  }

  // also update once DOM is fully ready (harmless if already executed)
  document.addEventListener("DOMContentLoaded", updateOwnerSpan);
})();
(function () {
  function ensureOverlay() {
    if (!document.querySelector(".rift-static")) {
      const s = document.createElement("div");
      s.className = "rift-static";
      document.body.appendChild(s);
    }
  }
  function removeOverlay() {
    const ov = document.querySelector(".rift-static");
    if (ov) ov.remove();
  }

  const openBtn = document.getElementById("open-rift");
  const closeBtn = document.getElementById("rift-close");

  if (openBtn) openBtn.addEventListener("click", e => {
    e.preventDefault();
    if (typeof switchTab === "function") switchTab("rift");
    else document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "rift"));
    ensureOverlay();
  });

  if (closeBtn) closeBtn.addEventListener("click", e => {
    e.preventDefault();
    if (typeof switchTab === "function") switchTab("tos");
    else document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "tos"));
    removeOverlay();
  });

  if (typeof switchTab === "function") {
    const _switch = switchTab;
    window.switchTab = function (id) {
      const res = _switch(id);
      try {
        if (id === "rift") ensureOverlay(); else removeOverlay();
      } catch (err) {}
      return res;
    };
  }
})();
/* Temporary side-tab support for the Rift — paste at the end of dashboard JS */
(function () {
  const TEMP_TAB = "rift";
  const TEMP_LABEL = "Rift";

  // find the nav and tabs array used by the app
  const nav = document.querySelector("nav.side");
  // 'tabs' array is created earlier in the file; if not found, create a local one to keep same API
  window.tabs = window.tabs || [...document.querySelectorAll(".side-item")];

  function createTempSideTab() {
    // if already present, return it
    let existing = document.querySelector(`.side-item[data-tab="${TEMP_TAB}"]`);
    if (existing) return existing;

    const btn = document.createElement("button");
    btn.className = "side-item";
    btn.dataset.tab = TEMP_TAB;
    btn.textContent = TEMP_LABEL;
    btn.style.display = ""; // visible
    btn.addEventListener("click", () => {
      if (typeof switchTab === "function") switchTab(TEMP_TAB);
      else document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === TEMP_TAB));
    });

    // Option: insert near the top (after dashboard) or at end — adjust insertion point if you like
    nav.appendChild(btn);

    // update the tabs array used by the app so the existing switchTab tab-highlighting works
    window.tabs.push(btn);

    return btn;
  }

  function removeTempSideTab() {
    const btn = document.querySelector(`.side-item[data-tab="${TEMP_TAB}"]`);
    if (!btn) return;
    // remove from DOM
    btn.remove();
    // remove from tabs array
    const idx = window.tabs.findIndex(b => b.dataset && b.dataset.tab === TEMP_TAB);
    if (idx !== -1) window.tabs.splice(idx, 1);
  }

  // Wrap/patch switchTab so opening the rift adds the temp tab first (so built-in tab-highlighting works),
  // and leaving the rift removes it after switching.
  if (typeof switchTab === "function") {
    const _switch = switchTab;
    window.switchTab = function (id) {
      try {
        if (id === TEMP_TAB) {
          createTempSideTab();
        }
      } catch (e) { /* ignore */ }

      const res = _switch(id);

      try {
        if (id !== TEMP_TAB) {
          // leaving rift -> remove temp tab
          removeTempSideTab();
        }
      } catch (e) { /* ignore */ }

      return res;
    };
  } else {
    // fallback: if switchTab doesn't exist for some reason, ensure clicking shortcut manually shows view
    const openBtn = document.getElementById("open-rift");
    if (openBtn) openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      createTempSideTab();
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === TEMP_TAB));
    });
    // and the close button should hide it
    const closeBtn = document.getElementById("rift-close");
    if (closeBtn) closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "tos"));
      removeTempSideTab();
    });
  }

  // If user opened the Rift by other means (e.g. page load with rift active), create the tab now
  if (document.getElementById(TEMP_TAB)?.classList.contains("active")) createTempSideTab();

})();
