// js/nav-notifications.js
(function () {
 const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  const q = (s) => document.querySelector(s);

  // ----------------- ROLE HELPERS -----------------
  function getRoles() {
    try {
      const raw = localStorage.getItem("cf_roles");
      if (!raw) {
        const single = (localStorage.getItem("cf_role") || "").toLowerCase();
        return single ? [single] : [];
      }
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map((r) => String(r).toLowerCase());
    } catch {
      return [];
    }
  }

  function hasRole(code) {
    return getRoles().includes(code.toLowerCase());
  }

  function isAdmin() {
    try {
      const urlHasAdmin =
        new URL(location.href).searchParams.get("admin") === "1";
      return urlHasAdmin || hasRole("admin");
    } catch {
      return hasRole("admin");
    }
  }

  // ----------------- AUTH HEADERS -----------------
  // Use REAL user token if available (so RLS can see auth.uid()).
  async function authHeaders() {
    try {
      if (window.NCR?.auth?.client) {
        const {
          data: { session },
        } = await window.NCR.auth.client.auth.getSession();

        if (session && session.access_token) {
          return {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${session.access_token}`, // <-- user token
            Accept: "application/json",
          };
        }
      }
    } catch (e) {
      console.warn("nav-notifications: failed to get auth session, falling back to anon", e);
    }

    // Fallback (e.g., if used on public page) – will likely return [] if RLS is strict
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

  // ----------------- FORMAT TIME -----------------
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

  // ----------------- LOAD NOTIFICATIONS -----------------
  async function loadNotifications() {
    const badge = q("#notifBadge");
    const list = q("#notifList");
    if (!badge || !list) return;

    try {
      const url =
        `${SUPABASE_URL}/rest/v1/ncr_notifications` +
        `?select=id,message,created_at,read,link,type,recipient_role` +
        `&order=created_at.desc&limit=20`;

      const rows = await fetchJson(url);

      const userRoles = getRoles(); // ["quality","engineering",...]
      const adminUser = isAdmin();

      console.debug("nav-notifications: roles=", userRoles, "admin=", adminUser);
      console.debug("nav-notifications: raw rows=", rows);

      const visible = rows.filter((n) => {
        const raw = (n.recipient_role || "").toLowerCase().trim();

        if (adminUser) return true; // admins see everything

        if (!raw || raw === "all") return true;

        // support comma-separated targets like "quality,engineering"
        const targets = raw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

        if (targets.length === 0) return true;

        // if user has any of the target roles, show it
        return targets.some((t) => userRoles.includes(t));
      });

      list.innerHTML = "";

      if (!visible || visible.length === 0) {
        list.innerHTML = `
          <div class="list-group-item border-0 py-3 text-muted">
            No notifications for your role.
          </div>`;
        badge.classList.add("d-none");
        badge.textContent = "0";
        return;
      }

      let unreadCount = 0;

      visible.forEach((n) => {
        if (!n.read) unreadCount++;

        const safeMsg = n.message || "";
        const time = fmtTime(n.created_at);

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
          `<small class="text-muted mt-1">${time}</small>`;

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
      list.innerHTML = `
        <div class="list-group-item border-0 py-3 text-danger small">
          Could not load notifications.<br/>
          <code>${msg}</code>
        </div>`;
      if (badge) {
        badge.classList.add("d-none");
        badge.textContent = "0";
      }
    }
  }

  // ----------------- BOOTSTRAP -----------------
  document.addEventListener("DOMContentLoaded", async () => {
    // make sure user is logged in (if auth helper exists)
    try {
      if (window.NCR?.auth?.requireLogin) {
        await window.NCR.auth.requireLogin();
      }
    } catch (e) {
      console.warn("nav-notifications: requireLogin failed / not available", e);
      // If not logged in, just skip loading notifications
      return;
    }

    loadNotifications();

    const notifMenu = q("#notifMenu");
    if (notifMenu) {
      notifMenu.addEventListener("click", () => {
        loadNotifications();
      });
    }
  });
})();
