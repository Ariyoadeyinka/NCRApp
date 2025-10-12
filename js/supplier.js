(function () {
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

    function wireAddNewSupplierUI() {
        const supplierSelect = document.getElementById("supplier");
        if (!supplierSelect) return;

        const supplierField = supplierSelect.closest(".cf-supplier-field");
        const addNewRow = supplierField?.querySelector(".cf-add-new");
        const newSupplierInput = document.getElementById("newSupplierName");
        const addBtn = document.getElementById("addSupplierBtn");
        const cancelBtn = document.getElementById("cancelAddSupplierBtn");

        function showAddRow() { if (addNewRow) { addNewRow.style.display = ""; newSupplierInput?.focus(); } }
        function hideAddRow() { if (addNewRow) addNewRow.style.display = "none"; if (newSupplierInput) newSupplierInput.value = ""; }

        supplierSelect.addEventListener("change", () => {
            if (supplierSelect.value === "add_new") showAddRow(); else hideAddRow();
        });

        addBtn?.addEventListener("click", async () => {
            const name = newSupplierInput?.value?.trim();
            if (!name) { newSupplierInput?.focus(); return; }
            const exists = Array.from(supplierSelect.options).some(o => o.value !== "add_new" && o.text.trim().toLowerCase() === name.toLowerCase());
            if (exists) { supplierSelect.value = name; hideAddRow(); return; }
            try {
                const id = await window.NCR.api.getOrCreateSupplierId(name);
                const addNewOpt = supplierSelect.querySelector("option[value='add_new']");
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                supplierSelect.insertBefore(opt, addNewOpt);
                supplierSelect.value = name;
                hideAddRow();
            } catch (err) {
                alert(err.message || "Failed to add supplier");
            }
        });

        cancelBtn?.addEventListener("click", () => { supplierSelect.value = ""; hideAddRow(); });

        newSupplierInput?.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { supplierSelect.value = ""; hideAddRow(); supplierSelect.focus(); }
        });
    }

    async function initSuppliers() {
        const supplierSelect = document.getElementById("supplier");
        if (!supplierSelect) return;
        try {
            const rows = await window.NCR.api.fetchSuppliers();
            populateSupplierSelect(supplierSelect, rows);
        } catch (_) { }
        wireAddNewSupplierUI();
    }

    window.NCR = window.NCR || {};
    window.NCR.suppliers = { initSuppliers };
})();
