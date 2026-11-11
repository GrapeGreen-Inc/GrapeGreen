javascript``` // Role hierarchy matching your actual Firestore roles
const ROLE_LEVELS = {
  guest: 0,
  user: 1,
  mod: 2,
  admin: 3,
  headadmin: 4,
  legal: 5,
  dev: 6,
  owner: 7
};

function hasRank(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 99);
}

// Helper to patch specific fields on a Firestore user document without overwriting the whole doc
async function patchUserFields(username, fieldsObj) {
  const maskParams = Object.keys(fieldsObj)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");

  const separator = KEY.includes("?") ? "&" : "?";
  const url = `${DB}/${encodeURIComponent(username)}${KEY}${separator}${maskParams}`;

  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: fieldsObj })
  });
  if (!r.ok) throw new Error("Firestore update failed: " + r.status);
}

// Click handler for .adm buttons
document.querySelector("#admin .adm")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-a]");
  if (!btn) return;

  const action = btn.dataset.a;
  const targetUser = document.getElementById("a-user")?.value.trim();
  const hours = Number(document.getElementById("a-hours")?.value);
  const reason = document.getElementById("a-reason")?.value.trim() || "No reason provided.";
  const msgEl = document.getElementById("a-msg");

  if (!targetUser) {
    msgEl.textContent = "Enter a username first.";
    return;
  }

  // Assumes `currentUser` holds the logged-in staff member's object (with `.role`)
  const myRole = currentUser?.role || "guest";

  try {
    const targetData = await getUser(targetUser);
    if (!targetData) {
      msgEl.textContent = `User "${targetUser}" not found.`;
      return;
    }

    // Prevent moderating higher or equal ranks (except owner)
    if (myRole !== "owner" && hasRank(targetData.role, myRole)) {
      msgEl.textContent = "You cannot moderate a user with an equal or higher rank.";
      return;
    }

    // 1. TEMP BAN (mod+)
    if (action === "ban") {
      if (!hasRank(myRole, "mod")) return (msgEl.textContent = "Requires mod+.");
      if (!hours || hours < 1) return (msgEl.textContent = "Enter valid ban hours.");

      const banUntil = Date.now() + hours * 60 * 60 * 1000;
      await patchUserFields(targetUser, {
        banUntil: { integerValue: String(banUntil) },
        reason: { stringValue: reason },
        type: { stringValue: "Account banned" }
      });
      msgEl.textContent = `Temp banned ${targetUser} for ${hours}h. Reason: ${reason}`;
    }

    // 2. PERM BAN (admin+)
    else if (action === "perm") {
      if (!hasRank(myRole, "admin")) return (msgEl.textContent = "Requires admin+.");

      const permTimestamp = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
      await patchUserFields(targetUser, {
        banUntil: { integerValue: String(permTimestamp) },
        reason: { stringValue: reason },
        type: { stringValue: "Account banned" }
      });
      msgEl.textContent = `Permanently banned ${targetUser}. Reason: ${reason}`;
    }

    // 3. TEMP IP BAN (admin+)
    else if (action === "ipban") {
      if (!hasRank(myRole, "admin")) return (msgEl.textContent = "Requires admin+.");
      if (!hours || hours < 1) return (msgEl.textContent = "Enter valid ban hours.");
      if (!targetData.ip) return (msgEl.textContent = `${targetUser} has no saved IP on record.`);

      const banUntil = Date.now() + hours * 60 * 60 * 1000;
      await patchUserFields(targetUser, {
        banUntil: { integerValue: String(banUntil) },
        reason: { stringValue: reason },
        type: { stringValue: "IP banned" }
      });
      msgEl.textContent = `IP banned ${targetUser} for ${hours}h. Reason: ${reason}`;
    }

    // 4. PERM IP BAN (head admin+)
    else if (action === "permip") {
      if (!hasRank(myRole, "headadmin")) return (msgEl.textContent = "Requires head admin+.");
      if (!targetData.ip) return (msgEl.textContent = `${targetUser} has no saved IP on record.`);

      const permTimestamp = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
      await patchUserFields(targetUser, {
        banUntil: { integerValue: String(permTimestamp) },
        reason: { stringValue: reason },
        type: { stringValue: "IP banned" }
      });
      msgEl.textContent = `Permanently IP banned ${targetUser}. Reason: ${reason}`;
    }

    // 5. UNBAN (mod+)
    else if (action === "unban") {
      if (!hasRank(myRole, "mod")) return (msgEl.textContent = "Requires mod+.");

      await patchUserFields(targetUser, {
        banUntil: { integerValue: "0" },
        reason: { stringValue: "" },
        type: { stringValue: "" }
      });
      msgEl.textContent = `Unbanned ${targetUser}.`;
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = "Error: " + err.message;
  }
});
```
