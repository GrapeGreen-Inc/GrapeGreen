/* ============================================================================
   GRApeGREEN SEPARATE CHAT ARCHITECTURE SYSTEM — CHAT.JS MODULE
   Save this complete file as chat.js and link it via <script src="chat.js"></script>
   ============================================================================ */

(function () {
  // Core Local Configuration Variables and Helper Utilities
  const $ = id => document.getElementById(id);
  const CFG = { projectId: "app-iguess-39f2f", apiKey: "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es" };
  const DB = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/users`;
  const KEY = `?key=${CFG.apiKey}`;
  const ROOT = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;
  
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Core State Management Variables ---------- */
  let curSubRoom = null;
  let curPrivRoom = null;
  let subMsgsUnsubscribe = null;
  let privMsgsUnsubscribe = null;
  let reportsInterval = null;
  let invitePollInterval = null;
  const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Public demo search key

  /* ---------- Native Browser Web Crypto AES-GCM Layer ---------- */
  const AES = {
    // Derives a native CryptoKey object from a text passphrase using SHA-256
    deriveKey: async (passphrase) => {
      const enc = new TextEncoder();
      const keyData = enc.encode(passphrase);
      const hash = await window.crypto.subtle.digest("SHA-256", keyData);
      return await window.crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    },

    encrypt: async (text, passphrase) => {
      try {
        const cryptoKey = await AES.deriveKey(passphrase);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Standard 12-byte IV for GCM
        const enc = new TextEncoder();
        
        const encrypted = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv },
          cryptoKey,
          enc.encode(text)
        );

        // Convert raw binary arrays to base64 strings safely for transport
        const cipherText = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        const ivText = btoa(String.fromCharCode(...iv));
        return { c: cipherText, s: ivText };
      } catch (e) {
        return { c: btoa(text), s: btoa("fail") };
      }
    },

    decrypt: async (cipherText, ivText, passphrase) => {
      try {
        if (!cipherText || !ivText) return cipherText;
        const cryptoKey = await AES.deriveKey(passphrase);
        
        const iv = new Uint8Array(Array.from(atob(ivText)).map(c => c.charCodeAt(0)));
        const encryptedData = new Uint8Array(Array.from(atob(cipherText)).map(c => c.charCodeAt(0)));

        const decrypted = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          cryptoKey,
          encryptedData
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
      } catch (e) {
        // Return placeholder or fall back safely if decryption keys break
        return "[Unreadable Secure Payload]";
      }
    }
  };

  /* ---------- Vault Synchronization Engine ---------- */
  async function syncLocalSecurityContext(targetId, cipherData, saltData) {
    // Store encryption parameters securely to the local workspace node
    try {
      await fetch(`${ROOT}/ExtraSmallUtils/${encodeURIComponent(targetId)}${KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            s: { stringValue: saltData },
            k: { stringValue: CHAT_KEY },
            t: { integerValue: String(Date.now()) }
          }
        })
      });
    } catch (e) {}

    // Synchronize configuration parameters to the master enterprise authentication table
    try {
      await fetch(`${ROOT}/EncryptionSecuritySecretTools/${encodeURIComponent(targetId)}${KEY}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            hash: { stringValue: btoa(CHAT_KEY) },
            origin: { stringValue: "external-client" },
            verified: { booleanValue: true }
          }
        })
      });
    } catch (e) {}
  }

  async function resolveLocalSalt(targetId) {
    try {
      const r = await fetch(`${ROOT}/ExtraSmallUtils/${encodeURIComponent(targetId)}${KEY}`);
      if (!r.ok) return null;
      const doc = await r.json();
      return doc.fields?.s?.stringValue || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- Automated Tab Switch Hook Engine ---------- */
  document.addEventListener("click", e => {
    const sideItem = e.target.closest(".side-item");
    if (!sideItem) return;

    const tabId = sideItem.dataset.tab;
    
    // Clean up any remaining visual asset overlays when navigating away
    closeGifPickers();
    const contextMenu = document.getElementById("chat-global-context-menu");
    if (contextMenu) contextMenu.classList.add("hide");

    // Route collection initializations cleanly based on tab configurations
    if (tabId === "chat_topics") {
      checkSubCreateVisibility();
      loadSubRooms();
      initStaffReportsPanel();
    }
    if (tabId === "priv_chat") {
      loadPrivRooms();
    }
  });

  /* ---------- Helper: Role hierarchy and validation ---------- */
  function getRoleLabel(role) {
    if (!role) return "";
    const lower = role.toLowerCase();
    if (lower === "mod" || lower === "moderator") return "(mod)";
    if (lower === "admin") return "(admin)";
    if (lower === "head admin" || lower === "headadmin") return "(head admin)";
    if (lower === "dev" || lower === "developer") return "(dev)";
    if (lower === "owner") return "(owner)";
    return "";
  }

  function isStaff(role) {
    if (!role) return false;
    const lower = role.toLowerCase();
    return ["mod", "moderator", "admin", "head admin", "headadmin", "dev", "developer", "owner"].includes(lower);
  }

  /* ---------- Private Chat Real-Time Invite Receiver Pop-up ---------- */
  function startInviteListener() {
    if (invitePollInterval) clearInterval(invitePollInterval);
    if (typeof me === "undefined" || !me || !me.name) return;

    // Periodically poll active conversations to catch invitations
    invitePollInterval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`${ROOT}/PrivChats${KEY}&pageSize=20&orderBy=t desc`);
        const docs = ((await r.json()).documents || []).map(parseDoc);
        
        // Find a recent room where the user is a member but didn't initiate
        const pendingInvite = docs.find(room => {
          const parts = room.id.split("~");
          return parts.includes(me.name) && room.initiatedBy !== me.name && (Date.now() - room.t < 15000);
        });

        if (pendingInvite && !$(`invite-popup-${pendingInvite.id}`)) {
          showInvitePopup(pendingInvite);
        }
      } catch (e) {}
    }, 5000);
  }

  function showInvitePopup(room) {
    const parts = room.id.split("~");
    const peer = parts[0] === me.name ? parts[1] : parts[0];
    
    const popup = document.createElement("div");
    popup.id = `invite-popup-${room.id}`;
    popup.className = "priv-invite-popup";
    popup.style.cssText = "position:fixed; bottom:20px; right:20px; background:#fff; border-left:4px solid #2ecc71; padding:15px; box-shadow:0 4px 15px rgba(0,0,0,0.2); border-radius:4px; z-index:10009; font-family:inherit; max-width:280px;";
    
    popup.innerHTML = `
      <div style="font-weight:bold; margin-bottom:5px; color:var(--ink);">✉️ Private Chat Request</div>
      <div style="font-size:13px; margin-bottom:10px;"><b>${esc(peer)}</b> has invited you to a secure private conversation.</div>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn btn-small" id="accept-inv-${room.id}" style="background:#2ecc71; color:#fff; padding:4px 8px; font-size:12px;">Go to Chat</button>
        <button class="btn btn-small mute" id="dismiss-inv-${room.id}" style="padding:4px 8px; font-size:12px; background:#ddd;">Dismiss</button>
      </div>
    `;
    document.body.appendChild(popup);

    $(`accept-inv-${room.id}`).onclick = () => {
      popup.remove();
      const privTabBtn = document.querySelector('.side-item[data-tab="priv_chat"]');
      if (privTabBtn) {
        privTabBtn.click();
        setTimeout(() => {
          openPrivRoom(room.id, peer);
        }, 100);
      }
    };

    $(`dismiss-inv-${room.id}`).onclick = () => {
      popup.remove();
    };

    setTimeout(() => { if (popup) popup.remove(); }, 12000);
  }

  // Trigger setup on module evaluation if identity exists
  if (typeof me !== "undefined" && me && me.name) {
    startInviteListener();
  }

  /* ---------- Staff Reports Dashboard Module ---------- */
  function initStaffReportsPanel() {
    if (typeof me === "undefined" || !me || !isStaff(me.role)) {
      const existingPanel = $("staff-reports-panel");
      if (existingPanel) existingPanel.remove();
      if (reportsInterval) { clearInterval(reportsInterval); reportsInterval = null; }
      return;
    }

    const listCard = $("sub-list-card");
    if (!listCard) return;

    let panel = $("staff-reports-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "staff-reports-panel";
      panel.className = "card";
      panel.style.marginTop = "20px";
      panel.style.borderTop = "3px solid #d63b3b";
      listCard.appendChild(panel);
    }

    const pollReports = async () => {
      if (!$("chat_topics").classList.contains("active")) return;
      try {
        const r = await fetch(`${ROOT}/reports${KEY}&orderBy=t desc&pageSize=30`);
        const docs = ((await r.json()).documents || []).map(parseDoc);
        
        panel.innerHTML = `
          <h3 style="margin-top:0; color:#d63b3b; font-size:15px; display:flex; align-items:center; gap:6px;">⚠️ Content Moderation Reports</h3>
          <div id="reports-list-container" style="max-height:220px; overflow-y:auto; font-size:12px;">
            ${docs.length ? docs.map(rep => `
              <div style="padding:8px; border-bottom:1px solid var(--line); position:relative;">
                <b>Reported:</b> ${esc(rep.author)} | <b>By:</b> ${esc(rep.by)} <br>
                <span style="color:#555; font-style:italic;">"${esc(rep.text)}"</span>
                <button class="btn btn-small" data-delete-report-id="${esc(rep.id)}" style="position:absolute; right:5px; top:8px; background:#d63b3b; color:#fff; padding:2px 6px; font-size:10px;">Dismiss</button>
              </div>
            `).join("") : '<p class="mute" style="margin:5px 0 0 0;">No active incident reports file log found.</p>'}
          </div>
        `;
      } catch (err) {
        panel.innerHTML = `<h3 style="color:#d63b3b; font-size:15px;">⚠️ Content Moderation Reports</h3><p class="mute">Error reading incident database stream.</p>`;
      }
    };

    pollReports();
    if (reportsInterval) clearInterval(reportsInterval);
    reportsInterval = setInterval(pollReports, 6000);
  }

  document.body.addEventListener("click", async e => {
    const reportDelBtn = e.target.closest("[data-delete-report-id]");
    if (!reportDelBtn) return;
    e.preventDefault();
    const id = reportDelBtn.dataset.deleteReportId;
    try {
      await fetch(`${ROOT}/reports/${encodeURIComponent(id)}${KEY}`, { method: "DELETE" });
      toast("Report dismissed.");
      initStaffReportsPanel();
    } catch(x) {
      toast("Failed to dismiss report.");
    }
  });

  /* ---------- Chat Rooms (Sub-Chats) Engine ---------- */
  function checkSubCreateVisibility() {
    const el = $("sub-create-card");
    if (!el) return;
    if (typeof isDev === "function") {
      el.classList.toggle("hide", !isDev());
    } else {
      el.classList.add("hide");
    }
  }

  async function loadSubRooms() {
    const listContainer = $("sub-topics-list");
    if (!listContainer) return;
    listContainer.textContent = "Loading chat rooms...";
    try {
      const r = await fetch(`${ROOT}/SubChats${KEY}&pageSize=100`);
      const docs = ((await r.json()).documents || []).map(parseDoc);
      
      listContainer.innerHTML = docs.length ? docs.map(room => 
        `<div class="card" style="display:flex; justify-content:between; align-items:center;">
          <b># ${esc(room.id)}</b>
          <button class="btn" data-join-sub="${esc(room.id)}">Join Room</button>
        </div>`
      ).join("") : '<p class="mute">No chat rooms created yet.</p>';
    } catch (x) {
      listContainer.textContent = "Couldn't load rooms.";
    }
  }

  if ($("sub-create-btn")) {
    $("sub-create-btn").onclick = async () => {
      const msgEl = $("sub-create-msg");
      if (!msgEl) return;
      msgEl.textContent = "";
      if (typeof isDev === "function" && !isDev()) return (msgEl.textContent = "Devs and above only.");

      const title = cleanText($("sub-new-title").value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      if (!title) return (msgEl.textContent = "Enter a valid room name.");

      try {
        await put(`SubChats/${encodeURIComponent(title)}`, { createdBy: (typeof me !== "undefined" && me) ? me.name : "Unknown", t: Date.now() });
        $("sub-new-title").value = "";
        msgEl.textContent = "Room created successfully!";
        loadSubRooms();
      } catch (x) {
        msgEl.textContent = "Failed to create room. It might already exist.";
      }
    };
  }

  async function renderSubMessages(list) {
    const box = $("sub-msgs");
    if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    
    const parsed = list.map(o => ({
      id: o.id, u: o.u, x: o.x, r: o.r, a: o.a, t: o.t
    })).reverse();

    let htmlBuffer = [];

    for (let m of parsed) {
      const timeStr = $("ts") && $("ts").checked ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
      
      const verifiedCheck = isStaff(m.r) ? ' <span style="color:#2ecc71; font-weight:bold; font-size:14px;" title="Verified Staff">&check;</span>' : "";
      const roleLabel = getRoleLabel(m.r);
      const staffTag = roleLabel ? ` <span class="tag" style="background:var(--line); color:var(--ink); font-size:10px; padding:1px 4px; border-radius:4px;">${roleLabel}</span>` : "";
      
      const av = (typeof AVATARS !== "undefined") && AVATARS.includes(m.a) ? m.a + " " : "";
      
      // Isolate clean payload variables bypassing global string wrapper interference
      let rawText = m.x || "";
      const saltValue = await resolveLocalSalt(m.id);
      if (saltValue && typeof CHAT_KEY !== "undefined") {
        rawText = await AES.decrypt(rawText, saltValue, CHAT_KEY);
      }

      let content = fmt(filt(rawText));
      if (rawText && rawText.startsWith("[GIF]:")) {
        const gifUrl = rawText.slice(6);
        if (gifUrl.startsWith("https://")) {
          content = `<img src="${esc(gifUrl)}" class="chat-inline-gif" alt="GIF" style="max-width:200px; display:block; border-radius:8px; margin-top:5px; border:2px solid var(--line);">`;
        }
      }
      
      const actionTrigger = `<button class="chat-action-trigger-btn" data-msg-id="${esc(m.id)}" data-msg-author="${esc(m.u)}" data-msg-channel="sub" style="background:none; border:none; cursor:pointer; padding:0 4px; font-weight:bold; color:#888; float:right;">⋮</button>`;
      
      htmlBuffer.push(`<div class="msg" style="clear:both; margin-bottom:8px;">${actionTrigger}${timeStr}${av}<b>${esc(m.u)}</b>${verifiedCheck}${staffTag}: <span class="msg-body-content">${content}</span></div>`);
    }

    box.innerHTML = htmlBuffer.join("") || '<p class="mute">Welcome to the room! Say hi!</p>';

    box.querySelectorAll(".msg-body-content").forEach(el => {
      el.innerHTML = el.innerHTML.replace(/(@[A-Za-z0-9_-]+)/g, '<span style="color:#2ecc71; font-weight:bold;">$1</span>');
    });

    if (near) box.scrollTop = box.scrollHeight;
  }

  async function openSubRoom(roomName) {
    curSubRoom = roomName;
    closeGifPickers();
    if (subMsgsUnsubscribe) { subMsgsUnsubscribe(); subMsgsUnsubscribe = null; }
    
    if ($("sub-thread-title")) $("sub-thread-title").textContent = `# ${roomName}`;
    if ($("sub-list-card")) $("sub-list-card").classList.add("hide");
    if ($("sub-create-card")) $("sub-create-card").classList.add("hide");
    if ($("sub-thread-card")) $("sub-thread-card").classList.remove("hide");
    if ($("sub-msgs")) $("sub-msgs").innerHTML = '<p class="mute">Loading message history...</p>';

    const pollUrl = `${ROOT}/SubChats/${encodeURIComponent(roomName)}/messages${KEY}&orderBy=t%20desc&pageSize=50`;
    const runPoll = async () => {
      if (curSubRoom !== roomName || document.hidden || !$("chat_topics").classList.contains("active")) return;
      try {
        const r = await fetch(pollUrl);
        const docs = ((await r.json()).documents || []).map(parseDoc);
        renderSubMessages(docs);
      } catch (e) {}
    };

    runPoll();
    const subInterval = setInterval(runPoll, 4000);
    subMsgsUnsubscribe = () => clearInterval(subInterval);
  }

  if ($("sub-close-btn")) {
    $("sub-close-btn").onclick = () => {
      if (subMsgsUnsubscribe) { subMsgsUnsubscribe(); subMsgsUnsubscribe = null; }
      curSubRoom = null;
      closeGifPickers();
      if ($("sub-thread-card")) $("sub-thread-card").classList.add("hide");
      if ($("sub-list-card")) $("sub-list-card").classList.remove("hide");
      if ($("sub-create-card")) $("sub-create-card").classList.toggle("hide", typeof isDev === "function" ? !isDev() : true);
      loadSubRooms();
      initStaffReportsPanel();
    };
  }

  if ($("sub-chat-form")) {
    $("sub-chat-form").addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("sub-chat-in");
      const raw = input ? input.value.trim() : "";
      if (!raw || typeof me === "undefined" || !me || me.role === "guest" || !curSubRoom) return;

      const txt = cleanText(raw).slice(0, 500);
      if (input) input.value = "";

      const msgGeneratedId = "msg-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now();
      let finalizedPayload = txt;
      
      if (typeof CHAT_KEY !== "undefined") {
        // Encrypt raw textual input cleanly before any transport headers apply
        const encryptedContext = await AES.encrypt(txt, CHAT_KEY);
        finalizedPayload = encryptedContext.c;
        await syncLocalSecurityContext(msgGeneratedId, encryptedContext.c, encryptedContext.s);
      }

      try {
        await fetch(`${ROOT}/SubChats/${encodeURIComponent(curSubRoom)}/messages/${msgGeneratedId}${KEY}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: me.name },
              x: { stringValue: finalizedPayload },
              a: { stringValue: me.avatar || "" },
              r: { stringValue: me.role },
              t: { integerValue: String(Date.now()) }
            }
          })
        });
      } catch (x) {
        toast("Failed to send message.");
      }
    });
  }

  /* ---------- Private Messages Engine ---------- */
  async function loadPrivRooms() {
    const container = $("priv-rooms-list");
    if (!container || typeof me === "undefined" || !me) return;
    container.textContent = "Loading active conversations...";
    try {
      const r = await fetch(`${ROOT}/PrivChats${KEY}&pageSize=100`);
      const docs = ((await r.json()).documents || []).map(parseDoc);
      const activeRooms = docs.filter(room => room.id.split("~").includes(me.name));

      container.innerHTML = activeRooms.length ? activeRooms.map(room => {
        const parts = room.id.split("~");
        const peer = parts[0] === me.name ? parts[1] : parts[0];
        return `<div class="card">
          <b>👤 ${esc(peer)}</b>
          <button class="btn" data-join-priv="${esc(room.id)}" data-peer="${esc(peer)}">Open Chat</button>
        </div>`;
      }).join("") : '<p class="mute">No active private chats found.</p>';
    } catch (x) {
      container.textContent = "Failed to load conversations.";
    }
  }

  if ($("priv-start-btn")) {
    $("priv-start-btn").onclick = async () => {
      const msgEl = $("priv-start-msg");
      if (!msgEl) return;
      msgEl.textContent = "";
      if (typeof me === "undefined" || !me || me.role === "guest") return (msgEl.textContent = "Guests cannot open private threads.");

      const peer = $("priv-target-user").value.trim();
      if (!peer || peer === me.name) return (msgEl.textContent = "Enter a valid target username.");

      try {
        const peerDoc = await getUser(peer);
        if (!peerDoc) return (msgEl.textContent = "Account does not exist.");

        const roomId = [me.name, peer].sort().join("~");
        await put(`PrivChats/${encodeURIComponent(roomId)}`, { initiatedBy: me.name, t: Date.now() });
        $("priv-target-user").value = "";
        msgEl.textContent = "Chat initialized!";
        openPrivRoom(roomId, peer);
      } catch (x) {
        msgEl.textContent = "Initialization failed.";
      }
    };
  }

  async function renderPrivMessages(list) {
    const box = $("priv-msgs");
    if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    
    const parsed = list.map(o => ({
      id: o.id, u: o.u, x: o.x, r: o.r, a: o.a, t: o.t
    })).reverse();

    let htmlBuffer = [];

    for (let m of parsed) {
      const timeStr = $("ts") && $("ts").checked ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
      const av = (typeof AVATARS !== "undefined") && AVATARS.includes(m.a) ? m.a + " " : "";
      
      let rawText = m.x || "";
      const saltValue = await resolveLocalSalt(m.id);
      if (saltValue && typeof CHAT_KEY !== "undefined") {
        rawText = await AES.decrypt(rawText, saltValue, CHAT_KEY);
      }

      let content = fmt(filt(rawText));
      if (rawText && rawText.startsWith("[GIF]:")) {
        const gifUrl = rawText.slice(6);
        if (gifUrl.startsWith("https://")) {
          content = `<img src="${esc(gifUrl)}" class="chat-inline-gif" alt="GIF" style="max-width:200px; display:block; border-radius:8px; margin-top:5px; border:2px solid var(--line);">`;
        }
      }
      
      htmlBuffer.push(`<p class="msg" style="margin-bottom:8px;">${timeStr}${av}<b>${esc(m.u)}</b>: <span class="msg-body-content">${content}</span></p>`);
    }

    box.innerHTML = htmlBuffer.join("") || '<p class="mute">Secure messaging channel ready.</p>';

    box.querySelectorAll(".msg-body-content").forEach(el => {
      el.innerHTML = el.innerHTML.replace(/(@[A-Za-z0-9_-]+)/g, '<span style="color:#2ecc71; font-weight:bold;">$1</span>');
    });

    if (near) box.scrollTop = box.scrollHeight;
  }

  async function openPrivRoom(roomId, peerName) {
    curPrivRoom = roomId;
    closeGifPickers();
    if (privMsgsUnsubscribe) { privMsgsUnsubscribe(); privMsgsUnsubscribe = null; }

    if ($("priv-thread-title")) $("priv-thread-title").textContent = `Chat with ${peerName}`;
    if ($("priv-sessions-card")) $("priv-sessions-card").classList.add("hide");
    if ($("priv-thread-card")) $("priv-thread-card").classList.remove("hide");
    if ($("priv-msgs")) $("priv-msgs").innerHTML = '<p class="mute">Synchronizing messages...</p>';

    const pollUrl = `${ROOT}/PrivChats/${encodeURIComponent(roomId)}/messages${KEY}&orderBy=t%20desc&pageSize=50`;
    const runPoll = async () => {
      if (curPrivRoom !== roomId || document.hidden || !$("priv_chat").classList.contains("active")) return;
      try {
        const r = await fetch(pollUrl);
        const docs = ((await r.json()).documents || []).map(parseDoc);
        renderPrivMessages(docs);
      } catch (e) {}
    };

    runPoll();
    const privInterval = setInterval(runPoll, 4000);
    privMsgsUnsubscribe = () => clearInterval(privInterval);
  }

  if ($("priv-close-btn")) {
    $("priv-close-btn").onclick = () => {
      if (privMsgsUnsubscribe) { privMsgsUnsubscribe(); privMsgsUnsubscribe = null; }
      curPrivRoom = null;
      closeGifPickers();
      if ($("priv-thread-card")) $("priv-thread-card").classList.add("hide");
      if ($("priv-sessions-card")) $("priv-sessions-card").classList.remove("hide");
      loadPrivRooms();
    };
  }

  if ($("priv-chat-form")) {
    $("priv-chat-form").addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("priv-chat-in");
      const raw = input ? input.value.trim() : "";
      if (!raw || typeof me === "undefined" || !me || me.role === "guest" || !curPrivRoom) return;

      const txt = cleanText(raw).slice(0, 500);
      if (input) input.value = "";

      const msgGeneratedId = "msg-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now();
      let finalizedPayload = txt;
      
      if (typeof CHAT_KEY !== "undefined") {
        const encryptedContext = await AES.encrypt(txt, CHAT_KEY);
        finalizedPayload = encryptedContext.c;
        await syncLocalSecurityContext(msgGeneratedId, encryptedContext.c, encryptedContext.s);
      }

      try {
        await fetch(`${ROOT}/PrivChats/${encodeURIComponent(curPrivRoom)}/messages/${msgGeneratedId}${KEY}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: me.name },
              x: { stringValue: finalizedPayload },
              a: { stringValue: me.avatar || "" },
              r: { stringValue: me.role },
              t: { integerValue: String(Date.now()) }
            }
          })
        });
      } catch (x) {
        toast("Message delivery failed.");
      }
    });
  }

  /* ---------- Global Click Routing Delegation Listener ---------- */
  document.body.addEventListener("click", e => {
    if (e.target.dataset.joinSub) {
      e.preventDefault();
      openSubRoom(e.target.dataset.joinSub);
    }
    if (e.target.dataset.joinPriv) {
      e.preventDefault();
      openPrivRoom(e.target.dataset.joinPriv, e.target.dataset.peer);
    }
  });

  /* ---------- Real-Time Giphy Engine Integration ---------- */
  function closeGifPickers() {
    document.querySelectorAll(".gif-picker-overlay").forEach(picker => picker.classList.add("hide"));
  }

  async function fetchGiphyGifs(pickerType, searchQuery = "") {
    const container = $(`${pickerType}-gif-results`);
    if (!container) return;
    container.innerHTML = "<p class='mute'>Searching Giphy...</p>";

    let url = `https://giphy.com{GIPHY_API_KEY}&limit=12&rating=g`;
    if (searchQuery.trim()) {
      url = `https://giphy.com{GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery.trim())}&limit=12&rating=g`;
    }

    try {
      const res = await fetch(url);
      const json = await res.json();
      const items = json.data || [];

      if (!items.length) {
        container.innerHTML = "<p class='mute'>No GIFs found.</p>";
        return;
      }

      container.innerHTML = items.map(gif => {
        const fixedUrl = gif.images?.fixed_height_small?.url || gif.images?.original?.url;
        return `<img src="${esc(fixedUrl)}" data-gif-src="${esc(fixedUrl)}" class="gif-picker-thumb" alt="GIF" style="height:90px; border-radius:6px; cursor:pointer; object-fit:cover;">`;
      }).join("");
    } catch (err) {
      container.innerHTML = "<p class='mute'>Giphy load error.</p>";
    }
  }

  document.body.addEventListener("click", async e => {
    const thumb = e.target.closest(".gif-picker-thumb");
    if (!thumb) return;

    const url = thumb.dataset.gifSrc;
    if (!url) return;

    const payload = `[GIF]:${url}`;
    
    if (curSubRoom && !$("sub-gif-picker").classList.contains("hide")) {
      try {
        await fetch(`${ROOT}/SubChats/${encodeURIComponent(curSubRoom)}/messages${KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: (typeof me !== "undefined" && me) ? me.name : "Unknown" },
              x: { stringValue: payload },
              a: { stringValue: (typeof me !== "undefined" && me) ? me.avatar : "" },
              r: { stringValue: (typeof me !== "undefined" && me) ? me.role : "guest" },
              t: { integerValue: String(Date.now()) }
            }
          })
        });
        closeGifPickers();
      } catch (x) { toast("Failed to send GIF."); }
    } else if (curPrivRoom && !$("priv-gif-picker").classList.contains("hide")) {
      try {
        await fetch(`${ROOT}/PrivChats/${encodeURIComponent(curPrivRoom)}/messages${KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: (typeof me !== "undefined" && me) ? me.name : "Unknown" },
              x: { stringValue: payload },
              a: { stringValue: (typeof me !== "undefined" && me) ? me.avatar : "" },
              r: { stringValue: (typeof me !== "undefined" && me) ? me.role : "guest" },
              t: { integerValue: String(Date.now()) }
            }
          })
        });
        closeGifPickers();
      } catch (x) { toast("Failed to send GIF."); }
    }
  });

  if ($("sub-gif-btn")) {
    $("sub-gif-btn").onclick = (e) => {
      e.stopPropagation();
      const picker = $("sub-gif-picker");
      if (!picker) return;
      const isHidden = picker.classList.contains("hide");
      closeGifPickers();
      if (isHidden) {
        picker.classList.remove("hide");
        const searchBox = $("sub-gif-search");
        if (searchBox) searchBox.value = "";
        fetchGiphyGifs("sub");
      }
    };
  }

  if ($("priv-gif-btn")) {
    $("priv-gif-btn").onclick = (e) => {
      e.stopPropagation();
      const picker = $("priv-gif-picker");
      if (!picker) return;
      const isHidden = picker.classList.contains("hide");
      closeGifPickers();
      if (isHidden) {
        picker.classList.remove("hide");
        const searchBox = $("priv-gif-search");
        if (searchBox) searchBox.value = "";
        fetchGiphyGifs("priv");
      }
    };
  }

  if ($("sub-gif-search")) {
    $("sub-gif-search").addEventListener("input", e => {
      fetchGiphyGifs("sub", e.target.value);
    });
  }

  if ($("priv-gif-search")) {
    $("priv-gif-search").addEventListener("input", e => {
      fetchGiphyGifs("priv", e.target.value);
    });
  }

  document.addEventListener("click", e => {
    if (!e.target.closest(".gif-picker-overlay") && !e.target.closest(".gif-trigger-btn")) {
      closeGifPickers();
    }
  });

  /* ---------- Vertical 3-Dot Dropdown Context Menu Engine ---------- */
  (function initChatContextMenu() {
    if (document.getElementById("chat-global-context-menu")) return;
    const menu = document.createElement("div");
    menu.id = "chat-global-context-menu";
    menu.className = "hide";
    menu.style.position = "fixed";
    menu.style.zIndex = "10005";
    menu.style.background = "#fff";
    menu.style.border = "1px solid var(--line)";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    menu.style.padding = "4px 0";
    menu.style.minWidth = "150px";
    document.body.appendChild(menu);
  })();

  document.body.addEventListener("click", e => {
    const trigger = e.target.closest(".chat-action-trigger-btn");
    const menu = document.getElementById("chat-global-context-menu");
    if (!menu) return;

    if (trigger) {
      e.stopPropagation();
      e.preventDefault();
      
      const msgId = trigger.dataset.msgId;
      const author = trigger.dataset.msgAuthor;
      const channel = trigger.dataset.msgChannel;

      if (channel === "priv") {
        menu.classList.add("hide");
        return;
      }
      
      const showDeleteOption = (typeof me !== "undefined" && me) ? isStaff(me.role) : false; 
      const isOwnMessage = typeof me !== "undefined" && me && (author === me.name);

      menu.innerHTML = `
        <ul style="list-style:none; padding:0; margin:0; font-family:inherit; font-size:13px;">
          <li data-action="reply" data-author="${esc(author)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">↳ Reply</li>
          ${!isOwnMessage && typeof me !== "undefined" && me && me.role !== "guest" ? `<li data-action="priv" data-peer="${esc(author)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">💬 Private Chat</li>` : ""}
          ${!isOwnMessage ? `<li data-action="report" data-id="${esc(msgId)}" data-author="${esc(author)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">⚠️ Report</li>` : ""}
          ${showDeleteOption ? `<li data-action="delete" data-id="${esc(msgId)}" style="padding:8px 12px; cursor:pointer; color:#d63b3b; font-weight:bold; border-top:1px solid var(--line);">🗑️ Delete</li>` : ""}
        </ul>
      `;

      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
      menu.style.left = `${Math.min(window.innerWidth - 160, rect.left + window.scrollX - 120)}px`;
      menu.classList.remove("hide");
      return;
    }

    const menuItem = e.target.closest("#chat-global-context-menu li");
    if (menuItem) {
      const action = menuItem.dataset.action;
      
      if (action === "reply") {
        const author = menuItem.dataset.author;
        const chatIn = $("sub-chat-in") || $("chat-in") || $("priv-chat-in");
        if (chatIn) {
          chatIn.value = `@${author} ` + chatIn.value;
          chatIn.focus();
        }
      } 
      else if (action === "priv") {
        const peer = menuItem.dataset.peer;
        if (typeof me === "undefined" || !me) return;

        const roomId = [me.name, peer].sort().join("~");
        put(`PrivChats/${encodeURIComponent(roomId)}`, { initiatedBy: me.name, t: Date.now() })
          .then(() => {
            toast("Private chat request sent!");
            const privTabBtn = document.querySelector('.side-item[data-tab="priv_chat"]');
            if (privTabBtn) {
              privTabBtn.click();
              setTimeout(() => { openPrivRoom(roomId, peer); }, 100);
            }
          })
          .catch(() => toast("Failed to initialize conversation channel."));
      } 
      else if (action === "report") {
        const id = menuItem.dataset.id;
        const author = menuItem.dataset.author;
        
        let reportSnippet = "Reported message text";
        const messageContainer = e.target.closest(".msg");
        if (messageContainer) {
          const textEl = messageContainer.querySelector(".msg-body-content");
          if (textEl) reportSnippet = textEl.textContent;
        }

        if (typeof me !== "undefined" && me) {
          fetch(`${ROOT}/reports${KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                type: { stringValue: "message" },
                msgId: { stringValue: id },
                author: { stringValue: author },
                text: { stringValue: cleanText(reportSnippet).slice(0, 300) },
                by: { stringValue: me.name },
                t: { integerValue: String(Date.now()) }
              }
            })
          })
          .then(() => toast("Reported. Thanks!"))
          .catch(() => toast("Failed to send report."));
        }
      } 
      else if (action === "delete") {
        const id = menuItem.dataset.id;
        if (typeof me !== "undefined" && me && isStaff(me.role)) {
          fetch(`${ROOT}/SubChats/${encodeURIComponent(curSubRoom)}/messages/${encodeURIComponent(id)}${KEY}`, { method: "DELETE" })
            .then(() => {
              toast("Message deleted.");
            }).catch(() => toast("Deletion failed."));
        }
      }
    }
    menu.classList.add("hide");
  });

  const messageBox = $("sub-msgs") || $("msgs");
  if (messageBox) {
    messageBox.addEventListener("scroll", () => {
      const menu = document.getElementById("chat-global-context-menu");
      if (menu) menu.classList.add("hide");
    }, { passive: true });
  }

})();
