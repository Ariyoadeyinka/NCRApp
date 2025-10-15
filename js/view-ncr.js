(function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  function isAdmin() {
    try {
      const urlHasAdmin = new URL(location.href).searchParams.get("admin") === "1";
      const role = (localStorage.getItem("cf_role") || "").toLowerCase();
      return urlHasAdmin || role === "admin";
    } catch { return false; }
  }
  const urlStatus = new URLSearchParams(location.search).get('status');
  const statusSelect = document.getElementById('statusFilter') || document.querySelector('select');

  if (urlStatus && statusSelect) {
    const v = urlStatus.toLowerCase();
    const allowed = new Set(['open', 'pending', 'closed']);
    statusSelect.value = allowed.has(v) ? v : '';
  }

  const q = (s) => document.querySelector(s);
  const Q = (s) => Array.from(document.querySelectorAll(s));
  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toISOString().slice(0, 10);
  }
  function titleCase(s) {
    return (s || "").toString().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }
  function escIlike(term) {
    return term.replace(/[%_]/g, (m) => "\\" + m);
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
  async function fetchJson(url, init) {
    const finalUrl = withApiKeyInUrl(url);
    const res = await fetch(finalUrl, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Accept: "application/json",
        ...(init && init.headers ? init.headers : {})
      },
      ...(init || {})
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      const error = new Error(`HTTP ${res.status} — ${msg}`);
      error.status = res.status;
      error.body = msg;
      throw error;
    }
    return res;
  }

  function ensureListContainer() {
    let list = document.getElementById("ncrList");
    if (!list) {
      list = document.createElement("div");
      list.id = "ncrList";
      const filtersRow = document.querySelector(".row.mb-4.g-2") || document.querySelector(".row.g-2");
      if (filtersRow?.parentElement) {
        filtersRow.parentElement.insertBefore(list, filtersRow.nextSibling);
      } else {
        const main = document.querySelector("main .container, main .container-xxl") || document.body;
        main.appendChild(list);
      }
    }
    document.querySelectorAll("#ncrList ~ .card.p-4.mb-4, .card.p-4.mb-4").forEach(el => el.remove());
    return list;
  }

  function ensurePagerContainer() {
    let pager = document.getElementById("ncrPager");
    if (!pager) {
      pager = document.createElement("div");
      pager.id = "ncrPager";
      pager.className = "d-flex flex-wrap justify-content-between align-items-center mt-3";
      const list = ensureListContainer();
      list.parentElement.insertBefore(pager, list.nextSibling);
    }
    return pager;
  }

  function statusBadge(status) {
    const s = String(status || "").toLowerCase();
    if (s === "archived") {
      return `<span class="badge rounded-pill bg-secondary bg-opacity-25 text-secondary fw-semibold me-2 px-3 py-1">ARCHIVED</span>`;
    }
    if (s === "closed") {
      return `<span class="badge rounded-pill bg-success bg-opacity-25 text-success fw-semibold me-2 px-3 py-1">CLOSED</span>`;
    }
    if (s === "pending" || s === "draft") {
      return `<span class="badge rounded-pill bg-warning bg-opacity-25 text-dark fw-semibold me-2 px-3 py-1">DRAFT</span>`;
    }
    return `<span class="badge-open text-dark me-2">OPEN</span>`;
  }

  function stageLabel(s) {
    const map = { quality: "Quality", engineering: "Engineering", operations: "Operations", closed: "Closed" };
    return map[(s || "").toLowerCase()] || "";
  }
  function computeNextDept(n) {
    const next = (n.next_up_dept || "").toLowerCase();
    if (next) return next;
    const cur = String(n.current_stage || "").toLowerCase();
    if (cur === "quality") return "engineering";
    if (cur === "engineering") return "operations";
    if (cur === "operations") return "closed";
    return "";
  }
  function nextDeptBadge(n) {
    const s = String(n.status || "").toLowerCase();
    const softArchived = (n.archived === true || s === "archived");
    const isDraft = (s === "pending" || s === "draft");
    const isClosed = (s === "closed");
    if (softArchived || isDraft || isClosed) return "";

    const dept = computeNextDept(n);
    if (!dept || dept === "closed") return "";

    const COLORS = {
      quality: { bg: "#E6F4FF", text: "#173451" },
      engineering: { bg: "#173451", text: "#FFFFFF" },
      operations: { bg: "#EFEAFE", text: "#3B2F5C" }
    };

    const { bg, text } = COLORS[dept] || { bg: "#EEE", text: "#222" };
    const label = stageLabel(dept).toUpperCase();

    return `
      <span class="badge rounded-pill fw-semibold me-2 px-3 py-1" style="background:${bg};color:${text};">
        NEXT: ${label}
      </span>
    `;
  }

  // ---------- render card ----------
  function renderCard(n) {
    const supplierName = (n.suppliers && n.suppliers.name) ? n.suppliers.name : "";
    const qtyText = (n.qty_defective ?? "") && (n.qty_supplied ?? "")
      ? `${n.qty_defective} / ${n.qty_supplied}` : "";

    const processText = n.wip ? "WIP" : "Supplier";
    const s = String(n.status || "").toLowerCase();
    const isDraft = (s === "pending" || s === "draft");

    const nextBadge = nextDeptBadge(n);

    return `
<div class="card p-4 mb-4 shadow-sm border rounded-3" style="border-radius: 12px;" data-id="${n.id}">
  <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
    <div class="min-w-0">
      <h5 class="fw-semibold text-dark mb-1 text-truncate">${n.ncr_no || ""}</h5>
      <div class="text-muted small">
        ${n.product_no ? `<span>Product-No: <span class="text-dark">${n.product_no}</span></span>` : ""}
        ${n.so_no ? `<span class="ms-2">Sales-Order No: <span class="text-dark">${n.so_no}</span></span>` : ""}
      </div>
    </div>
    <div class="d-flex align-items-center gap-2 flex-wrap">
      ${nextBadge}
      ${statusBadge(n.status)}
    </div>
  </div>

  <div class="row mt-3 g-3">
    <div class="col-md-6">
      <p class="mb-1"><span class="text-muted">Quality Rep:</span> <span class="text-dark">${n.rep_name || "—"}</span></p>
      <p class="mb-1"><span class="text-muted">Process:</span> <span class="text-dark">${processText}</span></p>
      ${supplierName ? `<p class="mb-1"><span class="text-muted">Supplier:</span> <span class="text-dark">${supplierName}</span></p>` : ""}
    </div>
    <div class="col-md-6">
      ${qtyText ? `<p class="mb-1"><span class="text-muted">Qty Defective:</span> <span class="text-dark">${qtyText}</span></p>` : ""}
      <p class="mb-1"><span class="text-muted">Date Created:</span> <span class="text-dark">${fmtDate(n.date_raised)}</span></p>
    </div>
  </div>

  <div class="d-flex justify-content-end gap-2 mt-3">
    ${isDraft
        ? `<a class="btn btn-primary" data-action="continue" href="create-ncr.html?ncrId=${n.id}">
             <i class="fa fa-play me-1"></i> Continue
           </a>`
        : `
           <button class="btn btn-outline-primary" data-action="view"
                   style="--bs-btn-color:#173451;--bs-btn-border-color:#173451;--bs-btn-hover-bg:#173451;--bs-btn-hover-border-color:#173451;--bs-btn-active-bg:#12253A;--bs-btn-active-border-color:#12253A;">
             <i class="fa fa-eye me-1"></i> View
           </button>
           <button class="btn btn-outline-dark" data-action="edit"><i class="fa fa-pen me-1"></i> Edit</button>
         `}
    <button class="btn btn-outline-secondary btn-sm" data-action="archive"><i class="bi bi-archive"></i> Archive</button>
  </div>
</div>`;
  }

  async function fetchPageNCRs({ page, pageSize, searchTerm, statusFilter, adminVisible }) {
    const base = `${SUPABASE_URL}/rest/v1/ncrs`;
    const select =
      "id,ncr_no,status,product_no,so_no,qty_defective,qty_supplied,rep_name,wip,date_raised,date_closed,defect_desc,is_nc,supplier_id,created_at,archived,current_stage,next_up_dept,whose_turn_dept,suppliers(name)";
    const qs = new URLSearchParams({ select, order: "id.desc", limit: String(pageSize), offset: String((page - 1) * pageSize) });

    const filters = [];

    if (!adminVisible) {
      filters.push("archived=is.false");
    }

    if (statusFilter) {
      filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
    }

    if (searchTerm) {
      const term = escIlike(searchTerm.trim());
      filters.push(`or=(ncr_no.ilike.*${term}*,product_no.ilike.*${term}*,so_no.ilike.*${term}*,rep_name.ilike.*${term}*)`);
    }

    for (const f of filters) qs.append("", f);
    const queryStr = [qs.toString()].concat(filters.map(f => f)).join("&");

    const res = await fetchJson(`${base}?${queryStr}`, {
      headers: { Prefer: "count=exact" }
    });

    const rows = await res.json();
    const contentRange = res.headers.get("Content-Range") || "";
    const total = (() => {
      const m = contentRange.match(/\/(\d+)$/);
      return m ? parseInt(m[1], 10) : rows.length;
    })();

    const normalized = rows.map(r => ({
      ...r,
      suppliers: (r.suppliers && typeof r.suppliers === "object")
        ? r.suppliers
        : (r.suppliers_name ? { name: r.suppliers_name } : r.suppliers)
    }));

    return { rows: normalized, total };
  }

  async function archiveNcr(id) {
    const base = `${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(id)}`;
    await fetchJson(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ archived: true })
    });
    return { mode: "archived_flag" };
  }

  function ensureViewModal() {
    if (document.getElementById("ncrViewModal")) return;

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .cf-modal .modal-content { border: 0; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
      .cf-modal .modal-header { border: 0; padding-bottom: 0; }
      .cf-modal .modal-title { display:flex; align-items:center; gap:.5rem; }
      .cf-kv label { font-size: .75rem; color: var(--bs-secondary-color, #6c757d); margin-bottom: .25rem; }
      .cf-kv .form-control-plaintext { padding: .25rem 0; border: 0; font-weight: 600; color: #212529; }
      .cf-section-title { font-weight: 600; font-size: .9rem; color: #495057; margin: .25rem 0 .75rem; }
      .cf-divider { height:1px; background: rgba(23,52,81,.08); margin:.5rem 0 1rem; }
      @media (min-width: 992px){ .cf-grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; } }
      .cf-metadata { font-size:.8rem; color:#6c757d; }
      .cf-mini-modal .modal-content { border:0; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.08); }
      .cf-mini-modal .modal-header { border:0; }
      .cf-mini-modal .modal-body { padding-top:0; }
    `;
    document.head.appendChild(styleEl);

    const view = document.createElement("div");
    view.className = "modal fade cf-modal";
    view.id = "ncrViewModal";
    view.tabIndex = -1;
    view.setAttribute("aria-hidden", "true");
    view.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header px-4 pt-4">
            <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between w-100">
              <div class="d-flex align-items-center gap-2">
                <span class="badge rounded-pill bg-body-secondary text-body fw-semibold px-3 py-2" id="vmStatusPill">STATUS</span>
                <h5 class="modal-title m-0" id="vmTitle">NCR</h5>
              </div>
              <div class="cf-metadata mt-2 mt-lg-0" id="vmMeta"></div>
            </div>
            <button type="button" class="btn-close ms-2" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-body px-4 pb-0">
            <div class="row g-4">
              <div class="col-12 col-lg-6">
                <div class="cf-section-title"><i class="fa-regular fa-file-lines me-1"></i> NCR Details</div>
                <div class="cf-divider"></div>
                <div class="cf-grid-2">
                  <div class="cf-kv"><label>NCR No</label><div class="form-control-plaintext" id="vmNcrNo">—</div></div>
                  <div class="cf-kv"><label>Supplier</label><div class="form-control-plaintext" id="vmSupplier">—</div></div>
                  <div class="cf-kv"><label>Product No</label><div class="form-control-plaintext" id="vmProductNo">—</div></div>
                  <div class="cf-kv"><label>Sales Order No</label><div class="form-control-plaintext" id="vmSoNo">—</div></div>
                  <div class="cf-kv"><label>Date Raised</label><div class="form-control-plaintext" id="vmDateRaised">—</div></div>
                  <div class="cf-kv"><label>Closed Date</label><div class="form-control-plaintext" id="vmDateClosed">—</div></div>
                </div>
              </div>

              <div class="col-12 col-lg-6">
                <div class="cf-section-title"><i class="fa-regular fa-clipboard me-1"></i> Quality Details</div>
                <div class="cf-divider"></div>
                <div class="cf-grid-2">
                  <div class="cf-kv"><label>WIP PRO</label><div class="form-control-plaintext" id="vmWip">—</div></div>
                  <div class="cf-kv"><label>Non-Conforming</label><div class="form-control-plaintext" id="vmIsNc">—</div></div>
                  <div class="cf-kv"><label>Qty Supplied</label><div class="form-control-plaintext" id="vmQtySupplied">—</div></div>
                  <div class="cf-kv"><label>Qty Defective</label><div class="form-control-plaintext" id="vmQtyDefective">—</div></div>
                  <div class="cf-kv" style="grid-column:1 / -1;"><label>Defect Description</label><div class="form-control-plaintext" id="vmDefectDesc">—</div></div>
                  <div class="cf-kv" style="grid-column:1 / -1;"><label>Quality Rep</label><div class="form-control-plaintext" id="vmRepName">—</div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer px-4 py-3 d-flex justify-content-between">
            <div><small class="text-muted" id="vmAudit">Created — • Updated —</small></div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary" id="vmArchive"><i class="bi bi-archive me-1"></i> Archive</button>
              <button class="btn btn-dark" id="vmEdit"><i class="fa fa-pen me-1"></i> Edit</button>
              <button class="btn btn-primary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(view);

    const confirm = document.createElement("div");
    confirm.className = "modal fade cf-mini-modal";
    confirm.id = "cfArchiveConfirm";
    confirm.tabIndex = -1;
    confirm.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header"><h6 class="modal-title"><i class="bi bi-archive me-2"></i>Archive NCR?</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body"><p class="mb-0">This NCR will be archived and hidden from non-admin users.</p></div>
          <div class="modal-footer">
            <button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-secondary" id="cfArchiveConfirmYes">Archive</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(confirm);

    const success = document.createElement("div");
    success.className = "modal fade cf-mini-modal";
    success.id = "cfArchiveSuccess";
    success.tabIndex = -1;
    success.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header"><h6 class="modal-title"><i class="bi bi-check-circle me-2"></i>Archived</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body"><p class="mb-0" id="cfArchiveSuccessBody">NCR archived successfully.</p></div>
          <div class="modal-footer"><button class="btn btn-primary" data-bs-dismiss="modal">OK</button></div>
        </div>
      </div>`;
    document.body.appendChild(success);

    const error = document.createElement("div");
    error.className = "modal fade cf-mini-modal";
    error.id = "cfArchiveError";
    error.tabIndex = -1;
    error.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header"><h6 class="modal-title text-danger"><i class="bi bi-x-circle me-2"></i>Archive Failed</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body"><p class="mb-0" id="cfArchiveErrorBody">Could not archive this NCR.</p></div>
          <div class="modal-footer"><button class="btn btn-primary" data-bs-dismiss="modal">Close</button></div>
        </div>
      </div>`;
    document.body.appendChild(error);
  }

  function fillViewModal(n) {
    const s = String(n.status || "").toLowerCase();
    const pill = q("#vmStatusPill");
    pill.className = "badge rounded-pill fw-semibold px-3 py-2";
    if (n.archived === true || s === "archived") {
      pill.classList.add("bg-secondary", "bg-opacity-25", "text-secondary");
      pill.textContent = "ARCHIVED";
    } else if (s === "closed") {
      pill.classList.add("bg-success", "bg-opacity-25", "text-success");
      pill.textContent = "CLOSED";
    } else if (s === "pending" || s === "draft") {
      pill.classList.add("bg-warning", "bg-opacity-25", "text-dark");
      pill.textContent = "DRAFT";
    } else {
      pill.classList.add("bg-info", "bg-opacity-25", "text-dark");
      pill.textContent = "OPEN";
    }

    q("#vmTitle").textContent = n.ncr_no || "NCR";
    q("#vmMeta").innerHTML = `
      <span class="me-3"><i class="fa-regular fa-calendar me-1"></i> Raised: ${fmtDate(n.date_raised)}</span>
      <span class="me-3"><i class="fa-regular fa-clock me-1"></i> Updated: ${fmtDate(n.updated_at || n.created_at)}</span>
      ${n.current_stage ? `<span><i class="fa-solid fa-diagram-project me-1"></i> Stage: ${titleCase(n.current_stage)}</span>` : ""}
    `;

    q("#vmNcrNo").textContent = n.ncr_no || "—";
    q("#vmSupplier").textContent = n.suppliers?.name || "—";
    q("#vmProductNo").textContent = n.product_no || "—";
    q("#vmSoNo").textContent = n.so_no || "—";
    q("#vmDateRaised").textContent = fmtDate(n.date_raised) || "—";
    q("#vmDateClosed").textContent = n.date_closed ? fmtDate(n.date_closed) : "—";

    q("#vmWip").textContent = n.wip ? "Yes" : "No";
    q("#vmIsNc").textContent = n.is_nc ? "Yes" : "No";
    q("#vmQtySupplied").textContent = (n.qty_supplied ?? "") === "" ? "—" : String(n.qty_supplied);
    q("#vmQtyDefective").textContent = (n.qty_defective ?? "") === "" ? "—" : String(n.qty_defective);
    q("#vmDefectDesc").textContent = n.defect_desc || "—";
    q("#vmRepName").textContent = n.rep_name || "—";

    q("#vmAudit").textContent =
      `Created ${fmtDate(n.created_at)} • Updated ${fmtDate(n.updated_at || n.created_at)}`;

    const editBtn = q("#vmEdit");
    const arcBtn = q("#vmArchive");
    editBtn.onclick = () => {
      const params = new URLSearchParams({ ncrId: String(n.id), mode: "edit", returnTo: "view-ncr.html" });
      window.location.href = `create-ncr.html?${params.toString()}`;
    };
    arcBtn.onclick = async () => {
      const ok = await showArchiveConfirm(n);
      if (!ok) return;
      try {
        await archiveNcr(n.id);
        await showArchiveSuccess(n);
        bootstrap.Modal.getOrCreateInstance(document.getElementById("ncrViewModal")).hide();
        state.needsReload = true;
        load();
      } catch (e) {
        showArchiveError(e);
      }
    };
  }
  function showViewModal(n) {
    ensureViewModal();
    fillViewModal(n);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("ncrViewModal")).show();
  }
  function ensureArchiveModals() { ensureViewModal(); }
  function showArchiveConfirm() {
    ensureArchiveModals();
    return new Promise((resolve) => {
      const el = document.getElementById("cfArchiveConfirm");
      const yes = document.getElementById("cfArchiveConfirmYes");
      const m = bootstrap.Modal.getOrCreateInstance(el);
      const newYes = yes.cloneNode(true);
      yes.parentNode.replaceChild(newYes, yes);
      newYes.addEventListener("click", () => { m.hide(); resolve(true); }, { once: true });
      el.addEventListener("hidden.bs.modal", function onHide() {
        el.removeEventListener("hidden.bs.modal", onHide);
        resolve(false);
      }, { once: true });
      m.show();
    });
  }
  function showArchiveSuccess(n) {
    ensureArchiveModals();
    q("#cfArchiveSuccessBody").textContent = `NCR ${n.ncr_no || ""} was archived successfully.`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("cfArchiveSuccess")).show();
  }
  function showArchiveError(err) {
    ensureArchiveModals();
    q("#cfArchiveErrorBody").textContent = `Could not archive NCR. ${(err && err.message) ? err.message : ""}`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("cfArchiveError")).show();
  }

  function renderPager({ total, page, pageSize }) {
    const pager = ensurePagerContainer();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (page > totalPages) page = totalPages;

    const maxBtns = 5;
    const half = Math.floor(maxBtns / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + maxBtns - 1);
    start = Math.max(1, Math.min(start, end - maxBtns + 1));

    const pageBtns = [];
    for (let p = start; p <= end; p++) {
      pageBtns.push(`
        <li class="page-item ${p === page ? "active" : ""}">
          <a class="page-link" href="#" data-page="${p}">${p}</a>
        </li>`);
    }

    pager.innerHTML = `
      <div class="text-muted small mb-2 mb-md-0">
        Showing <strong>${total ? ((page - 1) * pageSize + 1) : 0}-${Math.min(page * pageSize, total)}</strong>
        of <strong>${total}</strong>
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="input-group input-group-sm" style="width: 140px;">
          <label class="input-group-text" for="pageSizeSel">Rows</label>
          <select id="pageSizeSel" class="form-select">
            ${[5, 10, 20, 50].map(n => `<option value="${n}" ${n === pageSize ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </div>

        <nav aria-label="NCR pagination">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item ${page <= 1 ? "disabled" : ""}">
              <a class="page-link" href="#" data-page="${page - 1}" aria-label="Previous">&laquo;</a>
            </li>
            ${pageBtns.join("")}
            <li class="page-item ${page >= totalPages ? "disabled" : ""}">
              <a class="page-link" href="#" data-page="${page + 1}" aria-label="Next">&raquo;</a>
            </li>
          </ul>
        </nav>
      </div>
    `;
    pager.querySelectorAll("a.page-link[data-page]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = parseInt(a.getAttribute("data-page"), 10);
        if (!Number.isFinite(target) || target === state.page) return;
        state.page = Math.max(1, target);
        load();
      });
    });
    pager.querySelector("#pageSizeSel")?.addEventListener("change", (e) => {
      const val = parseInt(e.target.value, 10);
      if (!Number.isFinite(val) || val === state.pageSize) return;
      state.pageSize = val;
      state.page = 1;
      load();
    });
  }

  const state = {
    page: 1,
    pageSize: 10,
    total: 0,
    rows: [],
    needsReload: false
  };

  async function load() {
    const listEl = ensureListContainer();
    const pager = ensurePagerContainer();

    const searchInput = document.querySelector(".row.mb-4.g-2 input[type='text']") || document.querySelector("input[type='text']");
    const statusSelect = document.querySelector(".row.mb-4.g-2 select, #statusFilter") || document.querySelector("select");
    const searchTerm = (searchInput?.value || "").trim();
    let statusFilter = (statusSelect?.value || "").toLowerCase();
    if (statusFilter === "all status" || statusFilter === "") statusFilter = "";

    listEl.innerHTML = `<div class="text-muted small py-5 text-center">Loading…</div>`;
    try {
      const { rows, total } = await fetchPageNCRs({
        page: state.page,
        pageSize: state.pageSize,
        searchTerm,
        statusFilter,
        adminVisible: isAdmin()
      });
      state.rows = rows;
      state.total = total;

      listEl.innerHTML = rows.map(renderCard).join("") || `<div class="text-muted">No NCRs found.</div>`;
      renderPager({ total, page: state.page, pageSize: state.pageSize });
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `
        <div class="alert alert-warning" role="alert">
          <div class="fw-semibold mb-1">Couldn’t load NCRs.</div>
          <div class="small text-muted"><code>${(err && err.message) ? err.message : String(err)}</code></div>
          <div class="small">Check your PostgREST policies and columns (e.g., <code>archived</code> boolean). </div>
        </div>
      `;
      pager.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    ensureListContainer();
    ensureViewModal();
    ensurePagerContainer();

    const searchInput = document.querySelector(".row.mb-4.g-2 input[type='text']") || document.querySelector("input[type='text']");
    const statusSelect = document.querySelector(".row.mb-4.g-2 select, #statusFilter") || document.querySelector("select");

    searchInput?.addEventListener("input", () => { state.page = 1; load(); });
    statusSelect?.addEventListener("change", () => { state.page = 1; load(); });

    const listEl = ensureListContainer();
    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action], a[data-action]");
      if (!btn) return;
      const card = btn.closest("[data-id]");
      const id = card?.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id) return;

      const n = state.rows.find(r => String(r.id) === String(id));

      if (action === "archive") {
        if (!n) return;
        const ok = await showArchiveConfirm(n);
        if (!ok) return;
        try {
          await archiveNcr(id);
          await showArchiveSuccess(n);

          const remaining = state.total - 1;
          const totalPagesAfter = Math.max(1, Math.ceil(remaining / state.pageSize));
          if (state.page > totalPagesAfter) state.page = totalPagesAfter;
          load();
        } catch (err) {
          showArchiveError(err);
        }
        return;
      }

      if (action === "view") {
        if (!n) return;
        showViewModal(n);
        return;
      }

      if (action === "edit") {
        const params = new URLSearchParams({ ncrId: String(id), mode: "edit", returnTo: "view-ncr.html" });
        window.location.href = `create-ncr.html?${params.toString()}`;
        return;
      }

      if (action === "continue") {
        const params = new URLSearchParams({ ncrId: String(id), mode: "edit", returnTo: "view-ncr.html" });
        window.location.href = `create-ncr.html?${params.toString()}`;
        return;
      }
    });

    load();
  });
})();
