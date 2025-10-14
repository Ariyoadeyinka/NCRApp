(function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  async function fetchSuppliers() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/suppliers?select=id,name&order=name.asc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("Failed to load suppliers");
    return res.json();
  }

  async function getOrCreateSupplierId(name) {
    const res1 = await fetch(`${SUPABASE_URL}/rest/v1/suppliers?select=id&name=eq.${encodeURIComponent(name)}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" }
    });
    const found = await res1.json();
    if (found.length) return found[0].id;

    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/suppliers`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ name })
    });
    const created = await res2.json();
    if (!res2.ok) throw new Error(created?.message || "Supplier insert failed");
    return created[0].id;
  }

  // Insert a new NCR (used when submitting directly without an existing draft)
  async function insertNcr(body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "NCR insert failed");
    return data[0];
  }

  // Save a draft (status: pending). Partial fields allowed.
// api.js
async function saveDraft(partial) {
  const payload = { ...partial };
  if (!payload.status) payload.status = "pending";

  const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch {}
  if (!res.ok) throw new Error(data?.message || raw || "Draft save failed");
  return (data && data[0]) || null;
}

async function updateNcr(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });

  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch {}
  if (!res.ok) throw new Error(data?.message || raw || "Update failed");
  return (data && data[0]) || null;
}


  // Patch existing NCR
  async function updateNcr(id, patch) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(patch)
    });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows?.message || "Update failed");
    return rows[0];
  }

  // Get a single NCR by id (for Continue flow)
  async function getNcrById(id) {
    const params = new URLSearchParams({
      select: "id,ncr_no,status,product_no,so_no,date_raised,date_closed,wip,defect_desc,is_nc,qty_supplied,qty_defective,rep_name,supplier_id",
      limit: "1"
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(id)}&${params}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" }
    });
    if (!res.ok) throw new Error("Failed to load NCR");
    const arr = await res.json();
    return arr[0] || null;
  }

  async function closeNcr(ncrId, closedBy) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?id=eq.${encodeURIComponent(ncrId)}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString(), closed_by: closedBy })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Close failed");
    return data[0];
  }

  // expose
  window.NCR = window.NCR || {};
  window.NCR.api = {
    BASE_URL: SUPABASE_URL,
    ANON_KEY: SUPABASE_ANON,
    fetchSuppliers,
    getOrCreateSupplierId,
    insertNcr,
    saveDraft,
    updateNcr,
    getNcrById,
    closeNcr
  };
})();
