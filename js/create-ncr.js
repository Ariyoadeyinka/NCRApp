document.addEventListener("DOMContentLoaded", async function () {
  var input = document.querySelector('input[name="dateRaised"]');
  if (!input) return;

  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');

  input.value = `${yyyy}-${mm}-${dd}`;

  var review = document.getElementById('reviewDateRaised');
  if (review) review.value = input.value;
  await window.NCR.suppliers.initSuppliers();
  await window.NCR.utils.setNcrNoField();

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

  var toStep2 = document.getElementById("toStep2");
  var toStep3 = document.getElementById("toStep3");
  toStep2.addEventListener("click", (e) => {
    var ok = window.NCR.utils.validateStep(document.getElementById("step1"));
    if (!ok) e.preventDefault();
  });
  toStep3.addEventListener("click", (e) => {
    var ok = window.NCR.utils.validateStep(document.getElementById("step2"));
    if (!ok) { e.preventDefault(); return; }
    window.NCR.utils.fillReview();
  });

  var nc = document.getElementById("nonConforming");
  var ncLbl = document.getElementById("nonConformingLabel");
  if (nc && ncLbl) nc.addEventListener("change", () => ncLbl.textContent = nc.checked ? "Yes" : "No");

  document.getElementById("submitNcr").addEventListener("click", async (e) => {
    e.preventDefault();

    var supplierSelect = document.getElementById("supplier");
    var supplierName = supplierSelect?.value === "add_new"
      ? document.getElementById("newSupplierName")?.value?.trim()
      : supplierSelect?.value?.trim();

    var formVals = {
      ncrNo: document.querySelector("[name='ncrNo']")?.value?.trim(),
      productNo: document.querySelector("[name='productNo']")?.value?.trim(),
      soNo: document.querySelector("[name='soNo']")?.value?.trim(),
      dateRaised: document.querySelector("[name='dateRaised']")?.value?.trim(),
      dateClosed: (() => {
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

    try {
      var supplierId = await window.NCR.api.getOrCreateSupplierId(supplierName);
      var saved = await window.NCR.api.insertNcr({
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
        status: formVals.status
      });

      alert(`✅ NCR saved successfully! #${saved.ncr_no}`);

      window.NCR.utils.resetFormForNext();

      await window.NCR.utils.setNcrNoField();

    } catch (err) {
      console.error(err);
      alert("❌ Failed to save NCR: " + err.message);
    }


  });
});
