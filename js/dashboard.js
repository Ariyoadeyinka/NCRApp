document.addEventListener("DOMContentLoaded", async function () {
    const BASE = "https://iijnoqzobocnoqxzgcdy.supabase.co";
    const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

    if (!BASE || !KEY) {
        console.warn("NCR API config missing (BASE_URL / ANON_KEY). Counts and recent list will not load.");
        return;
    }

    const headers = {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "count=exact"
    };

    const $ = (sel) => document.querySelector(sel);

    function fmtDate(d) {
        try {
            const dt = new Date(d);
            return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
        } catch {
            return d || "";
        }
    }

    function statusClasses(status) {
        const s = String(status || "").toLowerCase();
        if (s === "closed") return { codeCls: "closed", badgeCls: "closed", iconCode: "fa-regular fa-circle-check", iconBadge: "fa-regular fa-circle-check", label: "Closed" };
        if (s === "pending") return { codeCls: "pending", badgeCls: "pending", iconCode: "fa-regular fa-clock", iconBadge: "fa-regular fa-clock", label: "Pending" };
        return { codeCls: "open", badgeCls: "open", iconCode: "fa-solid fa-triangle-exclamation", iconBadge: "fa-solid fa-triangle-exclamation", label: "Open" };
    }

    function escapeHtml(s) {
        return (s ?? "").toString()
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function renderNcrItem(n) {
        const st = statusClasses(n.status);
        const supplierName = n.suppliers?.name ? ` &nbsp; Supplier: <strong>${escapeHtml(n.suppliers.name)}</strong> &nbsp;` : (n.supplier_name ? ` &nbsp; Supplier:<strong> ${escapeHtml(n.supplier_name)}</strong> &nbsp;` : " &nbsp; ");
        const rep = n.rep_name ? ` Rep: <strong>${escapeHtml(n.rep_name)}</strong>` : "";
        const created = n.created_at ? fmtDate(n.created_at) : "";
        const title = n.product_no
            ? `${escapeHtml(n.product_no)}`
            : (n.defect_desc ? escapeHtml(n.defect_desc).slice(0, 80) : "NCR Item");

        return `
      <div class="ncr-item" data-id="${n.id}">
        <div class="ncr-code ${st.codeCls}">
          <i class="${st.iconCode}"></i> ${escapeHtml(n.ncr_no || `NCR-${n.id}`)}
        </div>
        <div class="ncr-details">
          Product-No: <strong>${title}</strong><br>
          Created: <strong>${escapeHtml(created)}</strong>${supplierName}${rep}
        </div>
        <div class="ncr-actions">
          
          <button class="btn-open-detail" aria-label="Open NCR ${escapeHtml(n.ncr_no || n.id)}">
          <span class="ncr-status ${st.badgeCls}">${st.label}  <i class="fas fa-external-link-alt"></i></span>
           
          </button>
        </div>
      </div>`;
    }

    async function fetchCountByStatus(status) {
        const url = new URL(`${BASE}/rest/v1/ncrs`);
        url.searchParams.set("select", "id");
        if (status) url.searchParams.set("status", `eq.${status}`);

        const res = await fetch(url.toString(), { method: "HEAD", headers });
        const cr = res.headers.get("Content-Range");
        if (cr) {
            const total = cr.split("/")[1];
            return Number(total ?? 0);
        }
        const res2 = await fetch(url.toString(), { headers });
        if (!res2.ok) return 0;
        const rows = await res2.json();
        return Array.isArray(rows) ? rows.length : 0;
    }

    async function fetchTotalCount() {
        return fetchCountByStatus(null);
    }

    async function fetchRecent(limit = 3) {
        const baseSelect = "id,ncr_no,status,created_at,rep_name,product_no,defect_desc,supplier_id,suppliers(name)";
        let url = new URL(`${BASE}/rest/v1/ncrs`);
        url.searchParams.set("select", baseSelect);
        url.searchParams.set("order", "updated_at.desc,created_at.desc");
        url.searchParams.set("limit", String(limit));

        let res = await fetch(url.toString(), { headers });
        if (!res.ok) {
            url = new URL(`${BASE}/rest/v1/ncrs`);
            url.searchParams.set("select", baseSelect);
            url.searchParams.set("order", "created_at.desc");
            url.searchParams.set("limit", String(limit));
            res = await fetch(url.toString(), { headers });
        }
        if (!res.ok) return [];
        return res.json();
    }


    try {
        const [total, open, draft, closed, recent] = await Promise.all([
            fetchTotalCount(),
            fetchCountByStatus("open"),
            fetchCountByStatus("pending"),
            fetchCountByStatus("closed"),
            fetchRecent(3)
        ]);

        $("#count-total") && ($("#count-total").textContent = total);
        $("#count-open") && ($("#count-open").textContent = open);
        $("#count-draft") && ($("#count-draft").textContent = draft);
        $("#count-closed") && ($("#count-closed").textContent = closed);

        const host = $("#recent-ncr-list");
        if (host) {
            host.innerHTML = recent.map(renderNcrItem).join("");

            host.querySelectorAll(".btn-open-detail").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const root = e.currentTarget.closest(".ncr-item");
                    const id = root?.getAttribute("data-id");
                    if (!id) return;
                    window.location.href = `view-ncr.html?id=${encodeURIComponent(id)}`;
                });
            });
        }
    } catch (err) {
        console.error("Dashboard load failed:", err);
    }

    (function makeStatusCardsClickable() {
        const titleToStatus = (txt) => {
            const t = (txt || "").trim().toLowerCase();
            if (t.includes("total")) return "";
            if (t.includes("open")) return "open";
            if (t.includes("draft")) return "pending";
            if (t.includes("completed") || t.includes("closed")) return "closed";
            return "";
        };

        const cards = document.querySelectorAll(".status-box.card");
        cards.forEach((card) => {
            const titleEl = card.querySelector(".status-title");
            const status = titleToStatus(titleEl?.textContent || "");

            card.style.cursor = "pointer";
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `Filter NCRs: ${status || "All"}`);

            const go = () => {
                const params = new URLSearchParams();
                if (status) params.set("status", status);
                window.location.href = `view-ncr.html${params.toString() ? "?" + params.toString() : ""}`;
            };

            card.addEventListener("click", go);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
            });
        });
    })();

});
