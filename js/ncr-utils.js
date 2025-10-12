(async function () {
  const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

  const rand7 = () => String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
  const makeCandidate = () => `NCR-${new Date().getFullYear()}-${rand7()}`;

  async function existsInDb(ncrNo) {
    const qs = `ncr_no=eq.${encodeURIComponent(ncrNo)}&select=ncr_no&limit=1`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs?${qs}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" }
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  }

  async function getUniqueNcrNoFromDb(maxTries = 6) {
    for (let i = 0; i < maxTries; i++) {
      const candidate = makeCandidate();
      const taken = await existsInDb(candidate);
      if (!taken) return candidate;
    }
    const fallback = `NCR-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
    return fallback;
  }

  async function setNcrNoField() {
    const input = document.querySelector("[name='ncrNo']");
    if (input) input.value = await getUniqueNcrNoFromDb();
  }

  function validateStep(container) {
    let valid = true;
    const fields = container.querySelectorAll("input[required], select[required], textarea[required]");
    fields.forEach(field => {
      const val = (field.type === "number") ? field.value : field.value.trim();
      const holder = field.closest(".col-12, .col-md-6, .col") || field.parentElement;
      const oldErr = holder.querySelector(".cf-error");
      if (oldErr) oldErr.remove();
      if (!val) {
        valid = false;
        field.classList.add("is-invalid");
        field.style.borderColor = "#dc3545";
        const msg = document.createElement("span");
        msg.className = "cf-error text-danger small mt-1 d-block";
        msg.textContent = "This field is required.";
        holder.appendChild(msg);
      } else {
        field.classList.remove("is-invalid");
        field.style.borderColor = "#17345120";
      }
    });
    return valid;
  }

  function getVal(name) {
    const el = document.querySelector(`[name='${name}']`);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked ? "Yes" : "No";
    return el.value.trim();
  }

  function fillReview() {
    const get = id => document.getElementById(id);
    get("reviewNcrNo").value = getVal("ncrNo");
    get("reviewSupplier").value = document.getElementById("supplier")?.value ?? "";
    get("reviewProductNo").value = getVal("productNo");
    get("reviewSoNo").value = getVal("soNo");
    get("reviewDateRaised").value = getVal("dateRaised");
    get("reviewDateClosed").value = getVal("dateClosed");
    const wip = document.querySelector("input[name='wip']:checked")?.value || "";
    const nonCheck = document.querySelector("input[name='isNC']:checked")?.value || "";
    get("reviewWip").value = wip;
    get("reviewDefectDesc").value = getVal("defectDesc");
    get("reviewIsNc").value = nonCheck;
    get("reviewQtySupplied").value = getVal("qtySupplied");
    get("reviewQtyDefective").value = getVal("qtyDefective");
    get("reviewRepName").value = getVal("repName");
  }

  function resetFormForNext() {
    document.querySelectorAll("input.is-invalid, select.is-invalid, textarea.is-invalid").forEach(el => el.classList.remove("is-invalid"));
    document.querySelectorAll(".cf-error").forEach(e => e.remove());
    document.querySelectorAll("input[name='productNo'], input[name='soNo'], input[name='itemDesc'], input[name='defectDesc'], input[name='repName'], input[name='qtySupplied'], input[name='qtyDefective']").forEach(el => el.value = "");
    const inNon = document.getElementById("ncNo"); if (inNon) inNon.checked = true;
    const wipNo = document.getElementById("wipNo"); if (wipNo) wipNo.checked = true;
    const supplierSelect = document.getElementById("supplier"); if (supplierSelect) supplierSelect.value = "";
    const addRow = document.querySelector(".cf-add-new"); if (addRow) addRow.style.display = "none";
    location.hash = "#step1";
  }

  window.NCR = window.NCR || {};
  window.NCR.utils = { setNcrNoField, validateStep, fillReview, resetFormForNext, getUniqueNcrNoFromDb };
})();
