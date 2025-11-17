// js/create-ncr.js
document.addEventListener("DOMContentLoaded", async function () {
  await (window.NCR.auth?.requireLogin?.());
  // state holder for current draft id
  window.NCR = window.NCR || {};
  // --- Auth helpers (use the real user token instead of the anon key) ---
  await window.NCR.auth?.requireLogin?.();

  async function authHeaders() {
    if (!window.NCR?.auth?.client) throw new Error("Auth client missing");
    const { data: { session } } = await window.NCR.auth.client.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return {
      apikey: window.NCR.api?.ANON_KEY,           // keep sending your anon key here
      Authorization: `Bearer ${session.access_token}`, // <-- USER TOKEN
      Accept: "application/json",
      "Content-Type": "application/json"
    };
  }

  // Optional: a safe "get or create supplier id" that uses an RPC if you have it
  window.NCR.api = window.NCR.api || {};
  if (!window.NCR.api.getOrCreateSupplierId) {
    window.NCR.api.getOrCreateSupplierId = async function (nameOrId) {
      const n = Number(nameOrId);
      if (Number.isFinite(n)) return n;
      // Prefer an RPC; fall back to upsert if you don't have one
      const sb = window.NCR.auth.client;
      // Try RPC first
      const { data: rid, error: rpcErr } = await sb.rpc("get_or_create_supplier_id", { p_name: String(nameOrId) });
      if (!rpcErr) return rid;

      // Fallback: upsert by name, then select id
      const { error: upErr } = await sb.from("suppliers")
        .upsert({ name: String(nameOrId) }, { onConflict: "name", ignoreDuplicates: false });
      if (upErr) throw upErr;

      const { data, error } = await sb.from("suppliers")
        .select("id").eq("name", String(nameOrId)).limit(1).maybeSingle();
      if (error || !data) throw error || new Error("Supplier not found/created");
      return data.id;
    };
  }

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
        resolve(false);
      }, { once: true });

      m.show();
    });
  }



  const mode = new URL(location.href).searchParams.get("mode");
  const returnTo = new URL(location.href).searchParams.get("returnTo");


  if (mode === "edit") {
    const titleEl = document.getElementById("pageTitle");
    if (titleEl) titleEl.textContent = "Editing NCR";
    const submitBtn = document.getElementById("submitNcr");
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="fa-regular fa-paper-plane me-1"></i> Update`;
      submitBtn.setAttribute("aria-label", "Update NCR");
    }
  }
  function showStepById(id) {
    ["step1", "step2", "step3"].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = (s === id ? "block" : "none");
    });
  }
  function $(sel) { return document.querySelector(sel); }
  function byName(n) { return document.querySelector(`[name="${n}"]`); }

  function showFieldError(el, msg) {
    if (!el) return false;
    el.classList.add("is-invalid");
    el.style.borderColor = "#dc3545";
    const holder = el.closest(".col-12, .col-md-6, .col") || el.parentElement;
    if (holder && !holder.querySelector(".cf-error")) {
      const small = document.createElement("div");
      small.className = "cf-error small text-danger mt-1";
      small.textContent = msg;
      holder.appendChild(small);
    }
    return false;
  }

  function clearFieldError(el) {
    if (!el) return;
    el.classList.remove("is-invalid");
    el.style.borderColor = "#17345120";
    const holder = el.closest(".col-12, .col-md-6, .col") || el.parentElement;
    const err = holder && holder.querySelector(".cf-error");
    if (err) err.remove();
  }

  function parseIntOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Business rules:
  // - qty_defective <= qty_supplied
  // - numbers >= 0
  // - defectDesc length >= 20 chars (when provided / required on step2 & submit)
  // - productNo required (>0 length)
  // - repName required (>=3 chars)
  // - supplier required on submit (id or new name)
  // - closed date (if present) >= date_raised
  function validateBusinessRules(context /* 'step1' | 'step2' | 'submit' */) {
    let ok = true;

    // Step 1 checks
    if (context === 'step1' || context === 'submit') {
      const productNo = byName('productNo');
      if (!productNo?.value?.trim()) {
        ok = showFieldError(productNo, "Product number is required.") && ok;
      } else {
        clearFieldError(productNo);
      }

      const dateRaised = byName('dateRaised');
      if (!dateRaised?.value?.trim()) {
        ok = showFieldError(dateRaised, "Date raised is required.") && ok;
      } else {
        clearFieldError(dateRaised);
      }

      // closed date cannot be earlier than raised (if present and not 'N/A')
      const dateClosed = byName('dateClosed');
      const dr = dateRaised?.value ? new Date(dateRaised.value) : null;
      const dcVal = dateClosed?.value?.trim();
      if (dcVal && dcVal !== "N/A") {
        const dc = new Date(dcVal);
        if (dr && dc < dr) {
          ok = showFieldError(dateClosed, "Closed date cannot be earlier than Date Raised.") && ok;
        } else {
          clearFieldError(dateClosed);
        }
      } else {
        clearFieldError(dateClosed);
      }
    }

    // Step 2 checks
    if (context === 'step2' || context === 'submit') {
      const qtySuppliedEl = byName('qtySupplied');
      const qtyDefectiveEl = byName('qtyDefective');
      const defectDescEl = byName('defectDesc');
      const repNameEl = byName('repName');

      const qs = parseIntOrNull(qtySuppliedEl?.value);
      const qd = parseIntOrNull(qtyDefectiveEl?.value);

      // numbers must be >= 0
      if (qs === null || qs < 0) {
        ok = showFieldError(qtySuppliedEl, "Quantity supplied must be 0 or greater.") && ok;
      } else {
        clearFieldError(qtySuppliedEl);
      }
      if (qd === null || qd < 0) {
        ok = showFieldError(qtyDefectiveEl, "Quantity defective must be 0 or greater.") && ok;
      } else {
        clearFieldError(qtyDefectiveEl);
      }

      // qd <= qs
      if (qs !== null && qd !== null && qd > qs) {
        ok = showFieldError(qtyDefectiveEl, "Defective quantity cannot exceed supplied quantity.") && ok;
      }

      // description length >= 20
      const desc = defectDescEl?.value?.trim() || "";
      if (desc.length < 20) {
        ok = showFieldError(defectDescEl, "Please provide at least 20 characters.") && ok;
      } else {
        clearFieldError(defectDescEl);
      }

      // rep required, min 3 chars
      const rep = repNameEl?.value?.trim() || "";
      if (rep.length < 3) {
        ok = showFieldError(repNameEl, "Please enter the Quality Rep’s name (min 3 characters).") && ok;
      } else {
        clearFieldError(repNameEl);
      }
    }

    if (context === 'submit') {
      const supplierSelect = document.getElementById("supplier");
      const newName = document.getElementById("newSupplierName")?.value?.trim();
      const val = supplierSelect?.value;
      const supplierInvalid =
        !val || val === "" || (val === "add_new" && !newName);

      if (supplierInvalid) {
        ok = showFieldError(supplierSelect, "Please select a supplier or add a new one.") && ok;
      } else {
        clearFieldError(supplierSelect);
      }
    }

    if (!ok) {
      const first = document.querySelector(".is-invalid");
      first?.focus();
    }
    return !!ok;
  }

  const urlStart = new URL(location.href).searchParams.get("startStep");
  const hashStart = (location.hash || "").replace("#", "");
  if (urlStart === "2" || urlStart === "step2" || hashStart === "step2") {
    showStepById("step2");
  } else if (urlStart === "3" || urlStart === "step3" || hashStart === "step3") {
    showStepById("step3");
  } else {
    showStepById("step1");
  }

  if (returnTo) {
    document.querySelector('#cfSuccessModal .btn.btn-primary')
      ?.addEventListener('click', () => { window.location.href = returnTo; }, { once: true });
  }


  function showSuccessModal(title, body) {
    var el = document.getElementById("cfSuccessModal");
    var m = bootstrap.Modal.getOrCreateInstance(el);
    document.getElementById("cfSuccessTitle").textContent = title || "Success";
    document.getElementById("cfSuccessBody").textContent = body || "Done.";
    m.show();
  }

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

  await window.NCR.suppliers.initSuppliers();
  await window.NCR.utils.setNcrNoField();

  const supplierSelectEl = document.getElementById("supplier");
  supplierSelectEl?.addEventListener("change", async () => {
    const val = supplierSelectEl.value;

    const parsed = Number(val);
    if (val && val !== "add_new" && Number.isFinite(parsed)) {
      await trySaveDraft(false);
      return;
    }

    if (val && val !== "add_new") {
      const id = await window.NCR.api.getOrCreateSupplierId(val.trim());
      supplierSelectEl.options[supplierSelectEl.selectedIndex].value = String(id);
      await trySaveDraft(false);
      return;
    }

  });

  document.getElementById("addSupplierBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("newSupplierName");
    const name = input?.value?.trim();
    if (!name) return;

    const id = await window.NCR.api.getOrCreateSupplierId(name);

    const select = document.getElementById("supplier");
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

    await trySaveDraft(false);
  });

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

  const qtySuppliedEl = byName('qtySupplied');
  const qtyDefectiveEl = byName('qtyDefective');
  const defectDescEl = byName('defectDesc');

  qtySuppliedEl?.addEventListener('input', () => {
    const qs = parseIntOrNull(qtySuppliedEl.value);
    if (qs === null || qs < 0) {
      showFieldError(qtySuppliedEl, "Quantity supplied must be 0 or greater.");
    } else {
      clearFieldError(qtySuppliedEl);
      const qd = parseIntOrNull(qtyDefectiveEl?.value);
      if (qd !== null && qd > qs) {
        showFieldError(qtyDefectiveEl, "Defective quantity cannot exceed supplied quantity.");
      } else {
        clearFieldError(qtyDefectiveEl);
      }
    }
  });

  qtyDefectiveEl?.addEventListener('input', () => {
    const qs = parseIntOrNull(qtySuppliedEl?.value);
    const qd = parseIntOrNull(qtyDefectiveEl.value);
    if (qd === null || qd < 0) {
      showFieldError(qtyDefectiveEl, "Quantity defective must be 0 or greater.");
    } else if (qs !== null && qd > qs) {
      showFieldError(qtyDefectiveEl, "Defective quantity cannot exceed supplied quantity.");
    } else {
      clearFieldError(qtyDefectiveEl);
    }
  });

  defectDescEl?.addEventListener('input', () => {
    const desc = defectDescEl.value.trim();
    if (desc.length < 20) {
      showFieldError(defectDescEl, `Please provide at least 20 characters (${20 - desc.length} more to go).`);
    } else {
      clearFieldError(defectDescEl);
    }
  });

  var toStep2 = document.getElementById("toStep2");
  var toStep3 = document.getElementById("toStep3");
  toStep2.addEventListener("click", (e) => {
    const ok1 = window.NCR.utils.validateStep(document.getElementById("step1"));
    const ok2 = validateBusinessRules('step1');
    if (!ok1 || !ok2) { e.preventDefault(); return; }
    e.preventDefault();
    showStepById("step2");
  });


  toStep3.addEventListener("click", async (e) => {
    const ok1 = window.NCR.utils.validateStep(document.getElementById("step2"));
    const ok2 = validateBusinessRules('step2');
    if (!ok1 || !ok2) { e.preventDefault(); return; }
    e.preventDefault();
    await trySaveDraft();
    window.NCR.utils.fillReview();
    showStepById("step3");
  });


  document.getElementById("backToStep1")?.addEventListener("click", (e) => {
    e.preventDefault();
    showStepById("step1");
  });

  document.getElementById("backToStep2")?.addEventListener("click", (e) => {
    e.preventDefault();
    showStepById("step2");
  });

  var nc = document.getElementById("nonConforming");
  var ncLbl = document.getElementById("nonConformingLabel");
  if (nc && ncLbl) nc.addEventListener("change", () => ncLbl.textContent = nc.checked ? "Yes" : "No");

  const draftId = getQuery("ncrId") || getQuery("id");
  if (draftId) {
    try {
      const n = await window.NCR.api.getNcrById(draftId);
      if (n) {
        window.NCR.state.ncrId = n.id;

        document.querySelector("[name='ncrNo']").value = n.ncr_no || "";
        if (n.supplier_id != null) {
          await selectSupplierById(n.supplier_id);
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

        const startStep = new URL(location.href).searchParams.get("startStep") || (location.hash || "").replace("#", "");
        if (startStep === "2" || startStep === "step2") showStepById("step2");
        else if (startStep === "3" || startStep === "step3") showStepById("step3");
        else showStepById("step1");

      }
    } catch (e) {
      console.warn("Failed to load draft:", e);
    }
  }

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
        showSuccessModal("Draft Saved", `Your draft (${ncrNo}) has been saved.`);
        const destDraft = returnTo || `view-ncr.html?status=pending&highlight=${encodeURIComponent(window.NCR.state.ncrId || "")}`;
        const okDraftBtn = document.querySelector('#cfSuccessModal .btn.btn-primary');
        okDraftBtn?.addEventListener('click', () => { window.location.href = destDraft; }, { once: true });
      } catch (err) {
        console.error(err);
        showSuccessModal("Save Failed", "Could not save draft: " + (err?.message || err));
      } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    });
  });


  document.getElementById("submitNcr").addEventListener("click", async function (e) {
    e.preventDefault();
    if (!validateBusinessRules('submit')) return;
    const isEdit = (mode === "edit");
    var ok = await showConfirmModal(
      isEdit ? "Update NCR?" : "Create NCR?",
      isEdit
        ? "Please confirm you want to update this NCR."
        : "Please confirm you want to create this NCR. You can still edit it later.",
      isEdit ? "Update" : "Create"
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
      const sb = window.NCR.auth.client;
      const ENG = "engineering";

      async function shouldSetEngineeringOnUpdate(id) {
        if (!id) return true;
        const { data: prev, error } = await sb
          .from("ncrs")
          .select("status, current_stage, whose_turn_dept")
          .eq("id", id)
          .single();
        if (error) return true;
        return (prev?.status !== "open");
      }

      function applyEngineeringStage(p) {
        p.current_stage = ENG;
      }

      if (await shouldSetEngineeringOnUpdate(window.NCR.state.ncrId)) {
        applyEngineeringStage(payload);
      }
      let saved;

      if (window.NCR.state.ncrId) {
        const { data, error } = await sb
          .from("ncrs")
          .update(payload)
          .eq("id", window.NCR.state.ncrId)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb
          .from("ncrs")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        saved = data;
        window.NCR.state.ncrId = saved?.id;
      }



      showSuccessModal(
        isEdit ? "NCR Updated" : "NCR Created",
        isEdit
          ? `NCR #${saved.ncr_no} was updated successfully.`
          : `NCR #${saved.ncr_no} was created successfully.`
      );

      const dest = returnTo || `view-ncr.html?${isEdit ? "" : "status=open&"}highlight=${encodeURIComponent(saved.id)}`;
      const okBtn = document.querySelector('#cfSuccessModal .btn.btn-primary');
      okBtn?.addEventListener('click', () => {
        window.location.href = dest;
      }, { once: true });


    } catch (err) {
      console.error(err);
      showSuccessModal("Save Failed", "Failed to save NCR: " + (err?.message || err));
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

        headers: await authHeaders()
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

      const sb = window.NCR.auth.client;
      let saved;

      if (window.NCR.state.ncrId) {
        const { data, error } = await sb
          .from("ncrs")
          .update(payload)
          .eq("id", window.NCR.state.ncrId)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await sb
          .from("ncrs")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        saved = data;
        window.NCR.state.ncrId = saved?.id;
        if (saved?.ncr_no && ncrNoEl) ncrNoEl.value = saved.ncr_no;
      }


      if (showAlert) alert(`Draft saved${saved?.ncr_no ? ` (#${saved.ncr_no})` : ""}.`);
    } catch (err) {
      console.error(err);
      if (showAlert) alert("Could not save draft: " + (err?.message || err));
    }
  }
});
