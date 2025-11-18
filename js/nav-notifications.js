// js/nav-notifications.js
(function () {
   const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

    const q = (s) => document.querySelector(s);
    const READ_KEY = "cf_notif_read_ids";

    // Keep the full list of notification IDs currently loaded for this role
    let lastNotificationIds = [];

    // Full-page pagination state
    let fullPageRows = [];
    const PAGE_SIZE = 10;
    let currentPage = 1;

    // --- Role helper ---------------------------------------------------------
    function getCurrentRole() {
        try {
            return (localStorage.getItem("cf_role") || "").toLowerCase().trim();
        } catch {
            return "";
        }
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

        const headers = {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            Accept: "application/json",
        };

        const res = await fetch(finalUrl, { headers });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}: ${body}`);
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

    // --- localStorage helpers for read state ---------------------------------
    function getReadSet() {
        try {
            const raw = localStorage.getItem(READ_KEY);
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr : []);
        } catch {
            return new Set();
        }
    }

    function saveReadSet(set) {
        try {
            localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set)));
        } catch {
            // ignore
        }
    }

    // -------------------------------------------------------------------------
    // Badge: based on ALL notifications for this role (not just the 5 shown)
    // -------------------------------------------------------------------------
    function updateBadgeFromState() {
        const badge = q("#notifBadge");
        if (!badge) return;

        const readSet = getReadSet();
        const unread = lastNotificationIds.filter((id) => !readSet.has(id)).length;

        if (unread <= 0) {
            badge.textContent = "0";
            badge.classList.add("d-none");
        } else {
            badge.textContent = unread > 9 ? "9+" : String(unread);
            badge.classList.remove("d-none");
        }
    }

    // -------------------------------------------------------------------------
    // Common: fetch + role filter
    // -------------------------------------------------------------------------
    async function fetchRoleNotifications(limit) {
        const rawRole = getCurrentRole();
        const readSet = getReadSet();

        const rows = await fetchJson(
            `${SUPABASE_URL}/rest/v1/ncr_notifications` +
            `?select=id,message,created_at,read,link,type,recipient_role` +
            `&order=created_at.desc&limit=${limit}`
        );

        let displayRows = [];
        if (!rawRole) {
            displayRows = rows;
        } else {
            const role = rawRole.toLowerCase();
            displayRows = rows.filter((n) => {
                const rRole = (n.recipient_role || "all").toLowerCase();
                if (rRole === "all") return true;
                if (role === "admin") return true;
                if (role.includes("engineer")) {
                    return ["engineering", "engineer", "all"].includes(rRole);
                }
                if (role.includes("quality")) {
                    return ["quality", "quality_control", "all"].includes(rRole);
                }
                return rRole === role;
            });
        }

        // Update global IDs for badge
        lastNotificationIds = displayRows.map((n) => String(n.id));

        return { displayRows, readSet };
    }

    // -------------------------------------------------------------------------
    // Dropdown: Load notifications (max 5 displayed)
    // -------------------------------------------------------------------------
    async function loadNotifications() {
        const badge = q("#notifBadge");
        const list = q("#notifList");

        if (!badge || !list) return;

        try {
            const { displayRows, readSet } = await fetchRoleNotifications(50);

            list.innerHTML = "";

            if (displayRows.length === 0) {
                list.innerHTML = `<div class="list-group-item border-0 py-3 text-muted">No notifications for your role.</div>`;
                updateBadgeFromState();
                return;
            }

            // TOTAL unread across all notifications for this role
            const unreadTotal = displayRows.reduce((acc, n) => {
                const id = String(n.id);
                const isRead = n.read || readSet.has(id);
                return acc + (isRead ? 0 : 1);
            }, 0);

            // Only show latest 5 in dropdown
            const rowsForDropdown = displayRows.slice(0, 5);

            rowsForDropdown.forEach((n) => {
                const time = fmtTime(n.created_at);
                const id = String(n.id);
                const isRead = n.read || readSet.has(id);

                const newBadge = isRead
                    ? ""
                    : `<span class="badge bg-primary-subtle text-primary small new-badge">New</span>`;

                const content = `
          <div class="d-flex justify-content-between align-items-start">
            <div class="fw-semibold ${isRead ? "text-muted" : ""}">${n.message}</div>
            <div class="ms-2">
              ${newBadge}
            </div>
          </div>
          <small class="text-muted mt-1">${time}</small>
        `;

                if (n.link) {
                    list.insertAdjacentHTML(
                        "beforeend",
                        `<a href="${n.link}" class="list-group-item list-group-item-action border-0 py-3 ${isRead ? "notif-read" : ""}" data-id="${id}">${content}</a>`
                    );
                } else {
                    list.insertAdjacentHTML(
                        "beforeend",
                        `<div class="list-group-item border-0 py-3 ${isRead ? "notif-read" : ""}" data-id="${id}">${content}</div>`
                    );
                }
            });

            // Footer: Mark all
            list.insertAdjacentHTML(
                "beforeend",
                `
          <div class="list-group-item border-top py-2 text-center">
            <button type="button" class="btn btn-sm btn-light mark-all-read-btn">
              Mark all as read
            </button>
          </div>`
            );

            // Badge from TOTAL unread
            if (unreadTotal > 0) {
                badge.textContent = unreadTotal > 9 ? "9+" : unreadTotal.toString();
                badge.classList.remove("d-none");
            } else {
                badge.textContent = "0";
                badge.classList.add("d-none");
            }
        } catch (error) {
            console.warn("nav-notifications: loadNotifications failed", error);
            list.innerHTML = `<div class="list-group-item text-danger small">Could not load notifications.</div>`;
            updateBadgeFromState();
        }
    }

    // -------------------------------------------------------------------------
    // Full page: render one page
    // -------------------------------------------------------------------------
    function renderFullPage(page) {
        const list = q("#notifPageList");
        const pager = q("#notifPagination");
        if (!list || !pager) return;

        const readSet = getReadSet();
        const total = fullPageRows.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        currentPage = Math.min(Math.max(page, 1), totalPages);

        list.innerHTML = "";

        if (total === 0) {
            list.innerHTML = `
        <div class="list-group-item border-0 py-4 text-muted text-center">
          No notifications for your role.
        </div>`;
            pager.innerHTML = "";
            return;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, total);
        const slice = fullPageRows.slice(start, end);

        slice.forEach((n) => {
            const time = fmtTime(n.created_at);
            const id = String(n.id);
            const isRead = n.read || readSet.has(id);

            const newBadge = isRead
                ? ""
                : `<span class="badge bg-primary-subtle text-primary small new-badge">New</span>`;

            const content = `
        <div class="d-flex justify-content-between align-items-start">
          <div class="fw-semibold ${isRead ? "text-muted" : ""}">${n.message}</div>
          <div class="ms-2">
            ${newBadge}
          </div>
        </div>
        <small class="text-muted mt-1">${time}</small>
      `;

            const baseClass = `list-group-item border-0 py-3 ${isRead ? "notif-read" : ""}`;

            if (n.link) {
                list.insertAdjacentHTML(
                    "beforeend",
                    `<a href="${n.link}" class="${baseClass}" data-id="${id}">${content}</a>`
                );
            } else {
                list.insertAdjacentHTML(
                    "beforeend",
                    `<div class="${baseClass}" data-id="${id}">${content}</div>`
                );
            }
        });

        // Build pagination
        let html = "";

        const disabledPrev = currentPage === 1 ? " disabled" : "";
        html += `
      <li class="page-item${disabledPrev}">
        <a class="page-link notif-page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>
      </li>`;

        for (let p = 1; p <= totalPages; p++) {
            const active = p === currentPage ? " active" : "";
            html += `
        <li class="page-item${active}">
          <a class="page-link notif-page-link" href="#" data-page="${p}">${p}</a>
        </li>`;
        }

        const disabledNext = currentPage === totalPages ? " disabled" : "";
        html += `
      <li class="page-item${disabledNext}">
        <a class="page-link notif-page-link" href="#" data-page="${currentPage + 1}">&raquo;</a>
      </li>`;

        pager.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // Full page: load all notifications (for this role) and paginate
    // -------------------------------------------------------------------------
    async function loadFullPageNotifications() {
        const list = q("#notifPageList");
        const pager = q("#notifPagination");
        if (!list || !pager) return; // not on notifications.html

        try {
            const { displayRows } = await fetchRoleNotifications(200); // up to 200 for full page
            fullPageRows = displayRows;
            renderFullPage(1);
            updateBadgeFromState();
        } catch (err) {
            console.warn("nav-notifications: loadFullPageNotifications failed", err);
            list.innerHTML = `
        <div class="list-group-item border-0 py-4 text-danger text-center small">
          Could not load notifications.
        </div>`;
            pager.innerHTML = "";
            updateBadgeFromState();
        }
    }

    // -------------------------------------------------------------------------
    // UI-ONLY READ LOGIC (NO DB PATCHES, PERSISTS VIA localStorage)
    // -------------------------------------------------------------------------
    document.addEventListener("click", (ev) => {
        const all = ev.target.closest(".mark-all-read-btn");
        const notifItem = ev.target.closest("#notifList [data-id], #notifPageList [data-id]");
        const pageLink = ev.target.closest(".notif-page-link");

        // PAGINATION: change page
        if (pageLink) {
            ev.preventDefault();
            const page = parseInt(pageLink.getAttribute("data-page"), 10);
            if (!isNaN(page)) {
                renderFullPage(page);
            }
            return;
        }

        // MARK ALL AS READ (UI + localStorage, for ALL notifications, not just 5)
        if (all) {
            ev.preventDefault();

            const readSet = getReadSet();

            // Mark ALL loaded notifications for this role as read
            lastNotificationIds.forEach((id) => {
                readSet.add(String(id));
            });
            saveReadSet(readSet);

            // Update current dropdown DOM visually
            document
                .querySelectorAll("#notifList [data-id], #notifPageList [data-id]")
                .forEach((el) => {
                    const badgeEl = el.querySelector(".new-badge");
                    if (badgeEl) badgeEl.remove();
                    el.classList.add("notif-read");
                });

            updateBadgeFromState();
            return;
        }

        // SINGLE NOTIFICATION CLICK (UI + localStorage)
        if (notifItem) {
            const id = notifItem.getAttribute("data-id");
            if (!id) return;

            const badgeEl = notifItem.querySelector(".new-badge");
            if (!badgeEl) {
                // already marked as read
                return;
            }

            const readSet = getReadSet();
            readSet.add(String(id));
            saveReadSet(readSet);

            badgeEl.remove();
            notifItem.classList.add("notif-read");

            updateBadgeFromState();
            // allow navigation if it's an <a>
        }
    });

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        // Dropdown (bell)
        loadNotifications();

        // Full page (notifications.html)
        loadFullPageNotifications();

        const notifMenu = q("#notifMenu");
        if (notifMenu) {
            notifMenu.addEventListener("click", () => loadNotifications());
        }
    });
})();
