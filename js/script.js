document.addEventListener("DOMContentLoaded", function () {
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
})
})
