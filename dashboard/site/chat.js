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
  const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Public demo search key

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
    }
    if (tabId === "priv_chat") {
      loadPrivRooms();
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
        `<div class="card">
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

  function renderSubMessages(list) {
    const box = $("sub-msgs");
    if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    
    const parsed = list.map(o => ({
      id: o.id, u: o.u, x: dec(o.x), r: o.r, a: o.a, t: o.t
    })).reverse();

    box.innerHTML = parsed.map(m => {
      const timeStr = $("ts") && $("ts").checked ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
      const tag = (typeof rk !== "undefined") && rk(m.r) >= 3 ? `<span class="tag">${m.r}</span>` : m.r === "mod" ? '<span class="tag">mod</span> &check;' : "";
      const av = (typeof AVATARS !== "undefined") && AVATARS.includes(m.a) ? m.a + " " : "";
      
      let content = fmt(filt(m.x || ""));
      if (m.x && m.x.startsWith("[GIF]:")) {
        const gifUrl = m.x.slice(6);
        if (gifUrl.startsWith("https://")) {
          content = `<img src="${esc(gifUrl)}" class="chat-inline-gif" alt="GIF" style="max-width:200px; display:block; border-radius:8px; margin-top:5px; border:2px solid var(--line);">`;
        }
      }
      
      return `<p class="msg">${timeStr}${av}<b>${esc(m.u)}</b>${tag}: ${content}</p>`;
    }).join("") || '<p class="mute">Welcome to the room! Say hi!</p>';

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

      try {
        await fetch(`${ROOT}/SubChats/${encodeURIComponent(curSubRoom)}/messages${KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: me.name },
              x: { stringValue: wrap(filt(txt), CHAT_KEY) },
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

  function renderPrivMessages(list) {
    const box = $("priv-msgs");
    if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    
    const parsed = list.map(o => ({
      id: o.id, u: o.u, x: dec(o.x), r: o.r, a: o.a, t: o.t
    })).reverse();

    box.innerHTML = parsed.map(m => {
      const timeStr = $("ts") && $("ts").checked ? `<small>${new Date(m.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small> ` : "";
      const av = (typeof AVATARS !== "undefined") && AVATARS.includes(m.a) ? m.a + " " : "";
      
      let content = fmt(filt(m.x || ""));
      if (m.x && m.x.startsWith("[GIF]:")) {
        const gifUrl = m.x.slice(6);
        if (gifUrl.startsWith("https://")) {
          content = `<img src="${esc(gifUrl)}" class="chat-inline-gif" alt="GIF" style="max-width:200px; display:block; border-radius:8px; margin-top:5px; border:2px solid var(--line);">`;
        }
      }
      
      return `<p class="msg">${timeStr}${av}<b>${esc(m.u)}</b>: ${content}</p>`;
    }).join("") || '<p class="mute">Secure messaging channel ready.</p>';

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

      try {
        await fetch(`${ROOT}/PrivChats/${encodeURIComponent(curPrivRoom)}/messages${KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              u: { stringValue: me.name },
              x: { stringValue: wrap(filt(txt), CHAT_KEY) },
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
              x: { stringValue: wrap(payload, CHAT_KEY) },
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
              x: { stringValue: wrap(payload, CHAT_KEY) },
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
    menu.style.minWidth = "130px";
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
      
      const showDeleteOption = (typeof isMod === "function") ? isMod() : false; 
      const isOwnMessage = typeof me !== "undefined" && me && (author === me.name);

      menu.innerHTML = `
        <ul style="list-style:none; padding:0; margin:0; font-family:inherit; font-size:13px;">
          <li data-action="reply" data-author="${esc(author)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">↳ Reply</li>
          ${!isOwnMessage && typeof me !== "undefined" && me && me.role !== "guest" ? `<li data-action="priv" data-peer="${esc(author)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">💬 Private Chat</li>` : ""}
          ${!isOwnMessage ? `<li data-action="report" data-id="${esc(msgId)}" style="padding:8px 12px; cursor:pointer; color:var(--ink); font-weight:bold;">⚠️ Report</li>` : ""}
          ${showDeleteOption ? `<li data-action="delete" data-id="${esc(msgId)}" style="padding:8px 12px; cursor:pointer; color:#d63b3b; font-weight:bold; border-top:1px solid var(--line);">🗑️ Delete</li>` : ""}
        </ul>
      `;

      const rect = trigger.getBoundingClientRect();
      menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
      menu.style.left = `${Math.min(window.innerWidth - 140, rect.left + window.scrollX - 100)}px`;
      menu.classList.remove("hide");
      return;
    }

    const menuItem = e.target.closest("#chat-global-context-menu li");
    if (menuItem) {
      const action = menuItem.dataset.action;
      
      if (action === "reply") {
        const author = menuItem.dataset.author;
        const chatIn = $("chat-in") || $("sub-chat-in") || $("priv-chat-in");
        if (chatIn) {
          chatIn.value = `@${author} ` + chatIn.value;
          chatIn.focus();
        }
      } 
      else if (action === "priv") {
        const peer = menuItem.dataset.peer;
        const privTabBtn = document.querySelector('.side-item[data-tab="priv_chat"]');
        if (privTabBtn) {
          privTabBtn.click();
          const targetInput = $("priv-target-user");
          if (targetInput) {
            targetInput.value = peer;
            const startBtn = $("priv-start-btn");
            if (startBtn) startBtn.click();
          }
        }
      } 
      else if (action === "report") {
        const id = menuItem.dataset.id;
        const m = (typeof lastMsgs !== "undefined") && lastMsgs.find(x => x.id === id);
        if (m && typeof me !== "undefined" && me && typeof add === "function") {
          add("reports", { 
            type: "message", msgId: m.id, author: m.u, 
            text: cleanText(m.x).slice(0, 300), by: me.name, t: Date.now() 
          }).then(() => toast("Reported. Thanks!")).catch(() => toast("Failed to send report."));
        }
      } 
      else if (action === "delete") {
        const id = menuItem.dataset.id;
        if (typeof isMod === "function" && isMod()) {
          fetch(`${ROOT}/chat/${encodeURIComponent(id)}${KEY}`, { method: "DELETE" })
            .then(() => {
              if (typeof window.listenChat !== "function" && typeof pollChat === "function") { seen = 0; pollChat(true); }
              toast("Message deleted.");
            }).catch(() => toast("Deletion failed."));
        }
      }
    }
    menu.classList.add("hide");
  });

  const messageBox = $("msgs");
  if (messageBox) {
    messageBox.addEventListener("scroll", () => {
      const menu = document.getElementById("chat-global-context-menu");
      if (menu) menu.classList.add("hide");
    }, { passive: true });
  }

})();
