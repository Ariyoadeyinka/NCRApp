// js/create-ncr.js
document.addEventListener("DOMContentLoaded", async function () {
  // state holder for current draft id
  window.NCR = window.NCR || {};
  window.NCR.state = window.NCR.state || {};

  const getQuery = (k) => new URL(location.href).searchParams.get(k);

  // ---- Modal helpers (reusable) ----
  function showConfirmModal(title, body, yesLabel) {
    return new Promise(function (resolve) {
      var el = document.getElementById("cfConfirmModal");
      var m = bootstrap.Modal.getOrCreateInstance(el);
      document.getElementById("cfConfirmTitle").textContent = title || "Please confirm";
      document.getElementById("cfConfirmBody").textContent = body || "Are you sure?";
      var yesBtn = document.getElementById("cfConfirmYesBtn");
      yesBtn.textContent = yesLabel || "Yes";
      // clean old handlers
      var newYesBtn = yesBtn.cloneNode(true);
      yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

      newYesBtn.addEventListener("click", function () {
        m.hide();
        resolve(true);
      });
      el.addEventListener("hidden.bs.modal", function onHide() {
        el.removeEventListener("hidden.bs.modal", onHide);
        resolve(false); // if closed without clicking Yes
      }, { once: true });

      m.show();
    });
  }

  function showSuccessModal(title, body) {
    var el = document.getElementById("cfSuccessModal");
    var m = bootstrap.Modal.getOrCreateInstance(el);
    document.getElementById("cfSuccessTitle").textContent = title || "Success";
    document.getElementById("cfSuccessBody").textContent = body || "Done.";
    m.show();
  }

  // Set Date Raised today
  var input = document.querySelector('input[name="dateRaised"]');
  if (input) {
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    input.value = `${yyyy}-${mm}-${dd}`;
    var review = document.getElementById('reviewDateRaised');
    if (review) review.value = input.value;
  }

  // Initialize supplier dropdown and NCR number
  await window.NCR.suppliers.initSuppliers();
  await window.NCR.utils.setNcrNoField();

  // --- Persist supplier instantly when changed (keeps it sticky next time) ---
  const supplierSelectEl = document.getElementById("supplier");
  supplierSelectEl?.addEventListener("change", async () => {
    const val = supplierSelectEl.value;

    // If user picked an existing numeric id, just save
    const parsed = Number(val);
    if (val && val !== "add_new" && Number.isFinite(parsed)) {
      await trySaveDraft(false); // silent
      return;
    }

    // If options store names, resolve to id and rewrite the selected option to that id
    if (val && val !== "add_new") {
      const id = await window.NCR.api.getOrCreateSupplierId(val.trim());
      supplierSelectEl.options[supplierSelectEl.selectedIndex].value = String(id);
      await trySaveDraft(false);
      return;
    }

    // If "+ Add New Supplier", wait for Add button handler
  });

  // If you show an "Add New Supplier" UI, select new supplier immediately and save
  document.getElementById("addSupplierBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("newSupplierName");
    const name = input?.value?.trim();
    if (!name) return;

    const id = await window.NCR.api.getOrCreateSupplierId(name);

    const select = document.getElementById("supplier");
    // add option if missing, then select it
    let opt = Array.from(select.options).find(o => o.value === String(id));
    if (!opt) {
      opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      const addNew = Array.from(select.options).find(o => o.value === "add_new");
      if (addNew) select.insertBefore(opt, addNew);
      else select.appendChild(opt);
    }
    select.value = String(id);

    await trySaveDraft(false); // persist immediately
  });

  // Live validation UI reset on input
  document.querySelectorAll("input, select, textarea").forEach(el => {
    el.addEventListener("input", () => {
      if (el.value.trim() || el.type === "number") {
        el.classList.remove("is-invalid");
        el.style.borderColor = "#17345120";
        var holder = el.closest(".col-12, .col-md-6, .col") || el.parentElement;
        var oldErr = holder.querySelector(".cf-error");
        if (oldErr) oldErr.remove();
      }
    });
  });

  // Step navigation validation
  var toStep2 = document.getElementById("toStep2");
  var toStep3 = document.getElementById("toStep3");
  toStep2.addEventListener("click", (e) => {
    var ok = window.NCR.utils.validateStep(document.getElementById("step1"));
    if (!ok) e.preventDefault();
  });
  toStep3.addEventListener("click", async (e) => {
    var ok = window.NCR.utils.validateStep(document.getElementById("step2"));
    if (!ok) { e.preventDefault(); return; }
    // Save progress before review (optional but helpful)
    await trySaveDraft();
    window.NCR.utils.fillReview();
  });

  // Non-Conforming radio text sync (if used)
  var nc = document.getElementById("nonConforming");
  var ncLbl = document.getElementById("nonConformingLabel");
  if (nc && ncLbl) nc.addEventListener("change", () => ncLbl.textContent = nc.checked ? "Yes" : "No");

  // LOAD DRAFT if returning via ?ncrId=...
  const draftId = getQuery("ncrId") || getQuery("id");
  if (draftId) {
    try {
      const n = await window.NCR.api.getNcrById(draftId);
      if (n) {
        window.NCR.state.ncrId = n.id;

        // Step 1
        document.querySelector("[name='ncrNo']").value = n.ncr_no || "";
        if (n.supplier_id != null) {
          await selectSupplierById(n.supplier_id); // robust select by ID
        }
        document.querySelector("[name='productNo']").value = n.product_no || "";
        document.querySelector("[name='soNo']").value = n.so_no || "";
        document.querySelector("[name='dateRaised']").value = (n.date_raised || "").slice(0, 10) || "";
        document.querySelector("[name='dateClosed']").value = n.date_closed || "N/A";

        // Step 2
        if (n.wip !== null && n.wip !== undefined) {
          const idToCheck = n.wip ? "wipYes" : "wipNo";
          const el = document.getElementById(idToCheck);
          if (el) el.checked = true;
        }
        if (n.is_nc !== null && n.is_nc !== undefined) {
          const idToCheck = n.is_nc ? "ncYes" : "ncNo";
          const el = document.getElementById(idToCheck);
          if (el) el.checked = true;
        }
        document.querySelector("[name='qtySupplied']").value = n.qty_supplied ?? "";
        document.querySelector("[name='qtyDefective']").value = n.qty_defective ?? "";
        document.querySelector("[name='defectDesc']").value = n.defect_desc || "";
        document.querySelector("[name='repName']").value = n.rep_name || "";

        var reviewDate = document.getElementById('reviewDateRaised');
        if (reviewDate) reviewDate.value = (n.date_raised || "").slice(0, 10) || "";

        // Show step 2 if it looks populated
        const hasQuality = !!(n.defect_desc || n.rep_name || n.qty_defective || n.qty_supplied);
        if (hasQuality) {
          document.getElementById("step1").style.display = "none";
          document.getElementById("step2").style.display = "block";
        }
      }
    } catch (e) {
      console.warn("Failed to load draft:", e);
    }
  }

  // SAVE buttons -> save/patch draft (status: pending)
  // SAVE (draft): confirm, save, then success modal
  document.querySelectorAll(".btn.btn-save").forEach(function (btn) {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();

      var ok = await showConfirmModal(
        "Save Draft?",
        "Save your progress as a draft? You can continue later.",
        "Save Draft"
      );
      if (!ok) return;

      var prevHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

      try {
        await trySaveDraft(false);
        var ncrNo = document.querySelector("[name='ncrNo']")?.value || "Draft";
        showSuccessModal("Draft Saved", `💾 Your draft (${ncrNo}) has been saved.`);
      } catch (err) {
        console.error(err);
        showSuccessModal("Save Failed", "❌ Could not save draft: " + (err?.message || err));
      } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    });
  });


  document.getElementById("submitNcr").addEventListener("click", async function (e) {
    e.preventDefault();

    var ok = await showConfirmModal(
      "Create NCR?",
      "Please confirm you want to create this NCR. You can still edit it later.",
      "Create"
    );
    if (!ok) return;

    var submitBtn = document.getElementById("submitNcr");
    var prevHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

    try {
      var supplierSelect = document.getElementById("supplier");
      var supplierName = supplierSelect?.value === "add_new"
        ? document.getElementById("newSupplierName")?.value?.trim()
        : supplierSelect?.value?.trim();

      var formVals = {
        ncrNo: document.querySelector("[name='ncrNo']")?.value?.trim(),
        productNo: document.querySelector("[name='productNo']")?.value?.trim(),
        soNo: document.querySelector("[name='soNo']")?.value?.trim(),
        dateRaised: document.querySelector("[name='dateRaised']")?.value?.trim(),
        dateClosed: (function () {
          var v = document.querySelector("[name='dateClosed']")?.value?.trim();
          return v && v !== "N/A" ? v : null;
        })(),
        wip: document.querySelector("input[name='wip']:checked")?.value === "Yes",
        defectDesc: document.querySelector("[name='defectDesc']")?.value?.trim(),
        isNC: document.querySelector("input[name='isNC']:checked")?.value === "Yes",
        qtySupplied: Number(document.querySelector("[name='qtySupplied']")?.value ?? 0),
        qtyDefective: Number(document.querySelector("[name='qtyDefective']")?.value ?? 0),
        repName: document.querySelector("[name='repName']")?.value?.trim(),
        status: "open"
      };

      var supplierId = await window.NCR.api.getOrCreateSupplierId(supplierName);
      var payload = {
        ncr_no: formVals.ncrNo,
        supplier_id: supplierId,
        product_no: formVals.productNo,
        so_no: formVals.soNo,
        date_raised: formVals.dateRaised,
        date_closed: formVals.dateClosed || null,
        wip: formVals.wip,
        defect_desc: formVals.defectDesc,
        is_nc: formVals.isNC,
        qty_supplied: formVals.qtySupplied,
        qty_defective: formVals.qtyDefective,
        rep_name: formVals.repName,
        status: "open"
      };

      var saved;
      if (window.NCR.state.ncrId) {
        saved = await window.NCR.api.updateNcr(window.NCR.state.ncrId, payload);
      } else {
        saved = await window.NCR.api.insertNcr(payload);
      }

      showSuccessModal(
        "NCR Created",
        `✅ NCR #${saved.ncr_no} was created successfully.`
      );

      window.NCR.utils.resetFormForNext();
      await window.NCR.utils.setNcrNoField();
      window.NCR.state.ncrId = null;

    } catch (err) {
      console.error(err);
      showSuccessModal("Save Failed", "❌ Failed to save NCR: " + (err?.message || err));
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = prevHtml;
    }
  });


  async function selectSupplierById(id) {
    if (id == null) return;
    const select = document.getElementById("supplier");
    if (!select) return;

    select.value = String(id);
    if (select.value === String(id)) return;

    try {
      const url = `${window.NCR.api.BASE_URL}/rest/v1/suppliers?select=id,name&id=eq.${encodeURIComponent(id)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: window.NCR.api.ANON_KEY,
          Authorization: `Bearer ${window.NCR.api.ANON_KEY}`,
          Accept: "application/json"
        }
      });
      if (!res.ok) return;
      const rows = await res.json();
      const sup = rows[0];
      if (!sup) return;

      const opt = document.createElement("option");
      opt.value = String(sup.id);
      opt.textContent = sup.name || `Supplier #${sup.id}`;

      const addNew = Array.from(select.options).find(o => o.value === "add_new");
      if (addNew) select.insertBefore(opt, addNew);
      else select.appendChild(opt);

      select.value = String(sup.id);
    } catch (_) {
    }
  }

  async function ensureDraftSupplierId() {
    const DRAFT_SUPPLIER_NAME = "Unspecified (Draft)";

    const supplierSelect = document.getElementById("supplier");
    const supplierVal = supplierSelect?.value;

    if (supplierVal && supplierVal !== "add_new") {
      const parsed = Number(supplierVal);
      if (Number.isFinite(parsed)) return parsed;
      if (supplierVal && supplierVal.trim().length > 0) {
        return await window.NCR.api.getOrCreateSupplierId(supplierVal.trim());
      }
    }

    if (supplierVal === "add_new") {
      const newName = document.getElementById("newSupplierName")?.value?.trim();
      if (newName && newName.length > 0) {
        return await window.NCR.api.getOrCreateSupplierId(newName);
      }
    }

    return await window.NCR.api.getOrCreateSupplierId(DRAFT_SUPPLIER_NAME);
  }

  async function trySaveDraft(showAlert) {
    try {
      const ncrNoEl = document.querySelector("[name='ncrNo']");
      let ncrNo = ncrNoEl?.value?.trim();
      if (!ncrNo || ncrNo.length < 3) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        ncrNo = `DRAFT-${stamp}`;
        if (ncrNoEl) ncrNoEl.value = ncrNo;
      }

      const dateEl = document.querySelector("[name='dateRaised']");
      let dateRaised = dateEl?.value?.trim();
      if (!dateRaised) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        dateRaised = `${yyyy}-${mm}-${dd}`;
        if (dateEl) dateEl.value = dateRaised;
      }

      const supplierId = await ensureDraftSupplierId();

      const payload = {
        ncr_no: ncrNo,
        supplier_id: supplierId,
        product_no: document.querySelector("[name='productNo']")?.value?.trim() || null,
        so_no: document.querySelector("[name='soNo']")?.value?.trim() || null,
        date_raised: dateRaised,
        date_closed: (() => {
          const v = document.querySelector("[name='dateClosed']")?.value?.trim();
          return v && v !== "N/A" ? v : null;
        })(),
        wip: document.querySelector("input[name='wip']:checked")?.value === "Yes",
        defect_desc: document.querySelector("[name='defectDesc']")?.value?.trim() || null,
        is_nc: document.querySelector("input[name='isNC']:checked")?.value === "Yes",
        qty_supplied: (document.querySelector("[name='qtySupplied']")?.value ?? "") === "" ? null : Number(document.querySelector("[name='qtySupplied']")?.value),
        qty_defective: (document.querySelector("[name='qtyDefective']")?.value ?? "") === "" ? null : Number(document.querySelector("[name='qtyDefective']")?.value),
        rep_name: document.querySelector("[name='repName']")?.value?.trim() || null,
        status: "pending"
      };

      let saved;
      if (window.NCR.state.ncrId) {
        saved = await window.NCR.api.updateNcr(window.NCR.state.ncrId, payload);
      } else {
        const saver = window.NCR.api.saveDraft || window.NCR.api.insertNcr;
        saved = await saver(payload);
        window.NCR.state.ncrId = saved?.id;
        if (saved?.ncr_no && ncrNoEl) ncrNoEl.value = saved.ncr_no;
      }

      if (showAlert) alert(`💾 Draft saved${saved?.ncr_no ? ` (#${saved.ncr_no})` : ""}.`);
    } catch (err) {
      console.error(err);
      if (showAlert) alert("❌ Could not save draft: " + (err?.message || err));
    }
  }
});
