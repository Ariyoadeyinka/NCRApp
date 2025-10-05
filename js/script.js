document.addEventListener("DOMContentLoaded", async function () {
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

    document.querySelectorAll("input, select, textarea").forEach(el => {
        el.addEventListener("input", () => {
            if (el.value.trim() || el.type === "number") {
                el.classList.remove("is-invalid");
                el.style.borderColor = "#17345120";
                const holder = el.closest(".col-12, .col-md-6, .col") || el.parentElement;
                const oldErr = holder.querySelector(".cf-error");
                if (oldErr) oldErr.remove();
            }
        });
    });

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
        get("reviewWip").value = wip;
        get("reviewItemDesc").value = getVal("itemDesc");
        get("reviewDefectDesc").value = getVal("defectDesc");
        get("reviewIsNc").value = getVal("isNC");
        get("reviewQtySupplied").value = getVal("qtySupplied");
        get("reviewQtyDefective").value = getVal("qtyDefective");
        get("reviewRepName").value = getVal("repName");
    }

    const toStep2 = document.getElementById("toStep2");
    const toStep3 = document.getElementById("toStep3");

    toStep2.addEventListener("click", (e) => {
        const ok = validateStep(document.getElementById("step1"));
        if (!ok) e.preventDefault();
    });

    toStep3.addEventListener("click", (e) => {
        const ok = validateStep(document.getElementById("step2"));
        if (!ok) {
            e.preventDefault();
            return;
        }
        fillReview();
    });

    const nc = document.getElementById("nonConforming");
    const ncLbl = document.getElementById("nonConformingLabel");
    if (nc && ncLbl) {
        nc.addEventListener("change", () => ncLbl.textContent = nc.checked ? "Yes" : "No");
    }

    const supplierSelect = document.getElementById("supplier");
    if (!supplierSelect) return;

    const supplierField = supplierSelect.closest(".cf-supplier-field");
    const addNewRow = supplierField?.querySelector(".cf-add-new");
    const newSupplierInput = document.getElementById("newSupplierName");
    const addBtn = document.getElementById("addSupplierBtn");
    const cancelBtn = document.getElementById("cancelAddSupplierBtn");

    function showAddRow() {
        if (!addNewRow) return;
        addNewRow.style.display = "";
        newSupplierInput?.focus();
    }

    function hideAddRow() {
        if (!addNewRow) return;
        addNewRow.style.display = "none";
        if (newSupplierInput) newSupplierInput.value = "";
    }

    supplierSelect.addEventListener("change", () => {
        const v = supplierSelect.value;
        if (v === "add_new") {
            showAddRow();
        } else {
            hideAddRow();
        }
    });

    addBtn?.addEventListener("click", () => {
        const name = newSupplierInput?.value?.trim();
        if (!name) {
            newSupplierInput?.focus();
            return;
        }

        const exists = Array.from(supplierSelect.options).some(o => o.text.trim().toLowerCase() === name.toLowerCase());
        if (exists) {
            supplierSelect.value = name;
            hideAddRow();
            return;
        }

        const addNewOpt = supplierSelect.querySelector("option[value='add_new']");
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;

        supplierSelect.insertBefore(opt, addNewOpt);
        supplierSelect.value = name;
        hideAddRow();
    });

    cancelBtn?.addEventListener("click", () => {
        supplierSelect.value = "";
        hideAddRow();
    });

    newSupplierInput?.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            supplierSelect.value = "";
            hideAddRow();
            supplierSelect.focus();
        }
    });

    async function fetchSuppliers() {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/suppliers?select=id,name&order=name.asc`,
            {
                headers: {
                    apikey: SUPABASE_ANON,
                    Authorization: `Bearer ${SUPABASE_ANON}`,
                    Accept: "application/json"
                }
            }
        );
        if (!res.ok) return null;
        return res.json();
    }

    function populateSupplierSelect(selectEl, suppliers) {
        selectEl.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.selected = true;
        placeholder.textContent = "Select supplier or add new";
        selectEl.appendChild(placeholder);
        (suppliers || []).forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.name;
            opt.textContent = s.name;
            selectEl.appendChild(opt);
        });
        const addNew = document.createElement("option");
        addNew.value = "add_new";
        addNew.textContent = "+ Add New Supplier";
        selectEl.appendChild(addNew);
    }

    try {
        const list = await fetchSuppliers();
        if (list) populateSupplierSelect(supplierSelect, list);
    } catch (_) {}
});


const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

async function getOrCreateSupplierId(name) {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/suppliers?select=id&name=eq.${encodeURIComponent(name)}`, {
        headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            Accept: "application/json"
        }
    });
    const found = await res.json();
    if (found.length) return found[0].id;

    res = await fetch(`${SUPABASE_URL}/rest/v1/suppliers`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
        },
        body: JSON.stringify({ name })
    });
    const created = await res.json();
    if (!res.ok) throw new Error(created?.message || "Supplier insert failed");
    return created[0].id;
}

async function insertNcr(formVals) {
    const body = {
        ncr_no: formVals.ncrNo,
        supplier_id: formVals.supplierId,
        product_no: formVals.productNo,
        so_no: formVals.soNo,
        date_raised: formVals.dateRaised,
        date_closed: formVals.dateClosed || null,
        wip: formVals.wip,
        item_desc: formVals.itemDesc,
        defect_desc: formVals.defectDesc,
        is_nc: formVals.isNC,
        qty_supplied: formVals.qtySupplied,
        qty_defective: formVals.qtyDefective,
        rep_name: formVals.repName
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ncrs`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "NCR insert failed");
    return data[0];
}

document.getElementById("submitNcr").addEventListener("click", async (e) => {
    e.preventDefault();

    const supplierSelect = document.getElementById("supplier");
    const supplierName = supplierSelect?.value === "add_new"
        ? document.getElementById("newSupplierName")?.value?.trim()
        : supplierSelect?.value?.trim();

    const formVals = {
        ncrNo: document.querySelector("[name='ncrNo']")?.value?.trim(),
        productNo: document.querySelector("[name='productNo']")?.value?.trim(),
        soNo: document.querySelector("[name='soNo']")?.value?.trim(),
        dateRaised: document.querySelector("[name='dateRaised']")?.value?.trim(),
        dateClosed: (() => {
            const v = document.querySelector("[name='dateClosed']")?.value?.trim();
            return v && v !== "N/A" ? v : null;
        })(),
        wip: document.querySelector("input[name='wip']:checked")?.value === "Yes",
        itemDesc: document.querySelector("[name='itemDesc']")?.value?.trim(),
        defectDesc: document.querySelector("[name='defectDesc']")?.value?.trim(),
        isNC: document.getElementById("nonConforming")?.checked,
        qtySupplied: Number(document.querySelector("[name='qtySupplied']")?.value ?? 0),
        qtyDefective: Number(document.querySelector("[name='qtyDefective']")?.value ?? 0),
        repName: document.querySelector("[name='repName']")?.value?.trim()
    };

    try {
        const supplierId = await getOrCreateSupplierId(supplierName);
        const saved = await insertNcr({ ...formVals, supplierId });
        alert(`✅ NCR saved successfully! #${saved.ncr_no}`);
        window.location.href = "index.html";
    } catch (err) {
        console.error(err);
        alert("❌ Failed to save NCR: " + err.message);
    }
});
