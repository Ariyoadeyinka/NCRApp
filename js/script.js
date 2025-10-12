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

    window.NCR = window.NCR || {};
    window.NCR.api = { fetchSuppliers, getOrCreateSupplierId, insertNcr, closeNcr };
})();
