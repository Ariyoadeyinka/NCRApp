// js/nav-notifications.js
(function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  const q = (s) => document.querySelector(s);

  async function authHeaders() {
    try {
      if (window.NCR?.auth?.client) {
        const {
          data: { session },
        } = await window.NCR.auth.client.auth.getSession();

        if (session && session.access_token) {
          return {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${session.access_token}`,
            Accept: "application/json",
          };
        }
      }
    } catch (e) {
      console.warn(
        "nav-notifications: failed to get auth session, falling back to anon",
        e
      );
    }

    return {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Accept: "application/json",
    };
  }

  function withApiKeyInUrl(url) {
    try {
      const u = new URL(url, location.origin);
      if (!u.searchParams.get("apikey")) {
        u.searchParams.set("apikey", SUPABASE_ANON);
      }
      return u.toString();
    } catch {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}apikey=${encodeURIComponent(SUPABASE_ANON)}`;
    }
  }

  async function fetchJson(url) {
    const finalUrl = withApiKeyInUrl(url);
    const headers = await authHeaders();

    const res = await fetch(finalUrl, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`HTTP ${res.status} — ${body}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  function fmtTime(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const min = String(dt.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  async function loadNotifications() {
    const badge = q("#notifBadge");
    const list = q("#notifList");
    if (!badge || !list) {
      console.warn(
        "nav-notifications: missing #notifBadge or #notifList in DOM"
      );
      return;
    }

    try {
      const url =
        `${SUPABASE_URL}/rest/v1/ncr_notifications` +
        `?select=id,message,created_at,read,link,type,recipient_role` +
        `&order=created_at.desc&limit=20`;

      const rows = await fetchJson(url);
      console.debug("nav-notifications: raw rows=", rows);

      list.innerHTML = "";

      if (!rows || rows.length === 0) {
        list.innerHTML = `
          <div class="list-group-item border-0 py-3 text-muted">
            No notifications.
          </div>`;
        badge.classList.add("d-none");
        badge.textContent = "0";
        return;
      }

      let unreadCount = 0;

      rows.forEach((n) => {
        if (!n.read) unreadCount++;

        const safeMsg = n.message || "";
        const time = fmtTime(n.created_at);
        const roleLabel = (n.recipient_role || "all").toLowerCase();

        const base =
          '<div class="d-flex justify-content-between align-items-start">' +
          `<div class="fw-semibold ${n.read ? "" : "text-dark"}">` +
          `${safeMsg}</div>` +
          `${
            !n.read
              ? '<span class="badge rounded-pill bg-primary-subtle text-primary ms-2 small">New</span>'
              : ""
          }` +
          "</div>" +
          `<div class="d-flex justify-content-between align-items-center mt-1">` +
          `<small class="text-muted">${time}</small>` +
          `<span class="badge rounded-pill bg-light text-muted border ms-2 small">${roleLabel}</span>` +
          `</div>`;

        if (n.link) {
          list.insertAdjacentHTML(
            "beforeend",
            `
            <a href="${n.link}"
               class="list-group-item list-group-item-action border-0 py-3 d-flex flex-column">
              ${base}
            </a>`
          );
        } else {
          list.insertAdjacentHTML(
            "beforeend",
            `
            <div class="list-group-item border-0 py-3 d-flex flex-column">
              ${base}
            </div>`
          );
        }
      });

      if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
        badge.classList.remove("d-none");
      } else {
        badge.textContent = "0";
        badge.classList.add("d-none");
      }
    } catch (err) {
      console.warn("Failed to load notifications:", err);
      const msg = err && err.message ? err.message : String(err);
      if (list) {
        list.innerHTML = `
          <div class="list-group-item border-0 py-3 text-danger small">
            Could not load notifications.<br/>
            <code>${msg}</code>
          </div>`;
      }
      if (badge) {
        badge.classList.add("d-none");
        badge.textContent = "0";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    (async () => {
      try {
        if (window.NCR?.auth?.requireLogin) {
          await window.NCR.auth.requireLogin();
        }
      } catch (e) {
        console.warn(
          "nav-notifications: requireLogin failed / not available",
          e
        );
      }

      loadNotifications();
    })();

    const notifMenu = q("#notifMenu");
    if (notifMenu) {
      notifMenu.addEventListener("click", () => {
        loadNotifications();
      });
    } else {
      console.warn("nav-notifications: #notifMenu not found");
    }
  });
})();
