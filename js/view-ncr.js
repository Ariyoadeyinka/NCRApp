(function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  const q = (s) => document.querySelector(s);

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

  async function fetchNCRs() {
    const params = [
      "select=id,ncr_no,status,product_no,so_no,qty_defective,qty_supplied,rep_name,wip,date_raised,supplier_id,suppliers(name),current_stage,whose_turn_dept,next_up_dept",
      "order=id.desc",
      "limit=200"
    ].join("&");


    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?${params}`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      console.error("Failed to load NCRs");
      return [];
    }
    return res.json();
  }

  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toISOString().slice(0, 10);
  }

  function statusBadge(status) {
    const s = String(status || "").toLowerCase();
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
  const isDraft = (s === "pending" || s === "draft");
  const isClosed = (s === "closed");
  if (isDraft || isClosed) return ""; 

  const dept = computeNextDept(n);
  if (!dept || dept === "closed") return ""; 

  const looks = {
    quality:     "bg-info text-dark",
    engineering: "bg-primary",
    operations:  "bg-secondary"
  };
  const cls = looks[dept] || "bg-secondary";
  const label = stageLabel(dept).toUpperCase();

  return `<span class="badge rounded-pill ${cls} fw-semibold me-2 px-3 py-1">NEXT: ${label}</span>`;
}



function renderCard(n) {
  const supplierName = (n.suppliers && n.suppliers.name) ? n.suppliers.name : "";
  const qtyText = (n.qty_defective ?? "") && (n.qty_supplied ?? "")
    ? `${n.qty_defective} / ${n.qty_supplied}` : "";

  const processText = n.wip ? "WIP" : "Supplier";
  const s = String(n.status || "").toLowerCase();
  const isDraft  = (s === "pending" || s === "draft");
  const isClosed = (s === "closed");

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
         <button class="btn btn-outline-primary" data-action="view"><i class="fa fa-eye me-1"></i> View</button>
         <button class="btn btn-outline-dark" data-action="edit"><i class="fa fa-pen me-1"></i> Edit</button>
        `}
    <button class="btn btn-outline-danger btn-sm" data-action="delete"><i class="bi bi-trash"></i> Delete</button>
  </div>
</div>`;
}



  function applyFilters(rows, searchTerm, status) {
    let out = rows;
    const term = (searchTerm || "").trim().toLowerCase();

    if (status && status.toLowerCase() !== "all status") {
      const s = status.toLowerCase();
      out = out.filter(r => String(r.status || "").toLowerCase() === s);
    }

    if (term) {
      out = out.filter(r => {
        return [
          r.ncr_no,
          r.product_no,
          r.so_no,
          r.rep_name,
          r.suppliers?.name
        ].filter(Boolean).some(v => String(v).toLowerCase().includes(term));
      });
    }

    return out;
  }

  async function removeNcr(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`
      }
    });
    if (!res.ok) throw new Error("Delete failed");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const listEl = ensureListContainer();

    const searchInput = document.querySelector(".row.mb-4.g-2 input[type='text']") ||
      document.querySelector("input[type='text']");
    const statusSelect = document.querySelector(".row.mb-4.g-2 select") ||
      document.querySelector("select");

    let rows = await fetchNCRs();
    listEl.innerHTML = rows.map(renderCard).join("") || `<div class="text-muted">No NCRs found.</div>`;

    searchInput?.addEventListener("input", () => {
      const filtered = applyFilters(rows, searchInput.value, statusSelect?.value);
      listEl.innerHTML = filtered.map(renderCard).join("") || `<div class="text-muted">No matching NCRs.</div>`;
    });
    statusSelect?.addEventListener("change", () => {
      const filtered = applyFilters(rows, searchInput?.value, statusSelect.value);
      listEl.innerHTML = filtered.map(renderCard).join("") || `<div class="text-muted">No matching NCRs.</div>`;
    });

    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const card = btn.closest("[data-id]");
      const id = card?.getAttribute("data-id");
      const action = btn.getAttribute("data-action");

      if (!id) return;

      if (action === "delete") {
        if (!confirm("Delete this NCR?")) return;
        try {
          await removeNcr(id);
          rows = rows.filter(r => String(r.id) !== String(id));
          const filtered = applyFilters(rows, searchInput?.value, statusSelect?.value);
          listEl.innerHTML = filtered.map(renderCard).join("") || `<div class="text-muted">No NCRs found.</div>`;
        } catch (err) {
          alert("Failed to delete NCR.");
        }
      } else if (action === "view") {
        window.location.href = `/ncr-detail.html?id=${id}`;
      } else if (action === "edit") {
        alert("Edit action clicked (implement navigation).");
      }
    });
  });
})();
