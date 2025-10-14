(async function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const container = document.getElementById("detailContainer");

  if (!id) {
    container.innerHTML = `<div class="alert alert-danger">No NCR ID provided.</div>`;
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${id}&select=*`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    container.innerHTML = `<div class="alert alert-danger">Failed to load NCR (HTTP ${res.status}).</div>`;
    return;
  }

  const rows = await res.json();
  const n = rows[0];
  if (!n) {
    container.innerHTML = `<div class="alert alert-warning">NCR not found.</div>`;
    return;
  }

  container.innerHTML = `
<div class="card p-4 shadow-sm mb-4" style="border-radius:12px;">
  <div class="d-flex justify-content-between align-items-start">
    <div>
      <h5 class="fw-semibold text-dark mb-1">${n.ncr_no}</h5>
      <p class="text-muted mb-3">${n.item_desc || ""}</p>
      <span class="badge ${n.status === "closed" ? "bg-success-subtle text-success" :
      n.status === "pending" ? "bg-warning text-dark" :
        "bg-danger-subtle text-danger"}">${n.status?.toUpperCase() || "OPEN"}</span>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-outline-dark btn-sm"><i class="fa fa-pen me-1"></i> Edit</button>
      <button class="btn btn-outline-danger btn-sm"><i class="fa fa-trash me-1"></i> Delete</button>
    </div>
  </div>

  <hr>
  <h6 class="fw-semibold mt-2">Process Information</h6>
  <div class="row">
    <div class="col-md-6">
      <p><strong>Supplier ID:</strong> ${n.supplier_id || ""}</p>
      <p><strong>PO / Product No.:</strong> ${n.product_no || ""}</p>
    </div>
    <div class="col-md-6">
      <p><strong>Date Created:</strong> ${n.date_raised || ""}</p>
      <p><strong>Sales Order No.:</strong> ${n.so_no || ""}</p>
    </div>
  </div>

  <hr>
  <h6 class="fw-semibold">Item Information</h6>
  <p><strong>Quantity Supplied:</strong> ${n.qty_supplied ?? ""}</p>
  <p><strong>Quantity Defective:</strong> ${n.qty_defective ?? ""}</p>

  <hr>
  <h6 class="fw-semibold">Quality Representative</h6>
  <p><strong>Name:</strong> ${n.rep_name || ""}</p>

  <hr>
  <h6 class="fw-semibold">Defect Information</h6>
  <p><strong>Description of Defect:</strong></p>
  <div class="form-control bg-light-subtle">${n.defect_desc || ""}</div>
  <p class="mt-2"><strong>Item Marked Non-Conforming:</strong> ${n.is_nc ? "Yes" : "No"}</p>
</div>`;
})();
