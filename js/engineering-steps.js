document.addEventListener("DOMContentLoaded", function () {
    const stepForm = document.getElementById("engStepForm");
    const stepReview = document.getElementById("engStepReview");
    const btnGoReview = document.getElementById("btnGoReview");
    const btnBackToEdit = document.getElementById("btnBackToEdit");
    const stepLabelForm = document.getElementById("stepLabelForm");
    const stepLabelReview = document.getElementById("stepLabelReview");

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

    function clearAllErrors() {
        document.querySelectorAll(".cf-error").forEach(e => e.remove());
        document.querySelectorAll(".is-invalid").forEach(el => {
            el.classList.remove("is-invalid");
            el.style.borderColor = "#17345120";
        });
    }

    function setStep(showReview) {
        if (showReview) {
            stepForm.classList.add("d-none");
            stepReview.classList.remove("d-none");
            stepLabelForm.classList.remove("eng-step-active");
            stepLabelReview.classList.add("eng-step-active");

            const selectedDisp = document.querySelector("input[name='disp']:checked");
            document.getElementById("reviewDisp").textContent = selectedDisp ? selectedDisp.value : "—";

            const cust = document.querySelector("input[name='cust']:checked");
            document.getElementById("reviewCustNotify").textContent = cust ? cust.value : "—";

            const revReq = document.querySelector("input[name='rev']:checked");
            document.getElementById("reviewRevRequired").textContent = revReq ? revReq.value : "—";

            document.getElementById("reviewDispNotes").textContent =
                document.getElementById("engDispositionNotes").value || "—";

            document.getElementById("reviewOrigRev").textContent =
                document.getElementById("engOriginalRev").value || "—";

            document.getElementById("reviewUpdatedRev").textContent =
                document.getElementById("engUpdatedRev").value || "—";

            document.getElementById("reviewEngineerName").textContent =
                document.getElementById("engName").value || "—";

            document.getElementById("reviewRevisionDate").textContent =
                document.getElementById("engRevisionDate").value || "—";

            document.getElementById("reviewSignatureDate").textContent =
                document.getElementById("engSignatureDate").value || "—";

            document.getElementById("reviewSignature").textContent =
                document.getElementById("engSignature").value || "—";

            const ncrNoInput = document.querySelector("[data-field='ncrNo']");
            if (ncrNoInput) {
                document.getElementById("reviewNcrNo").textContent =
                    ncrNoInput.value || ncrNoInput.textContent || "NCR";
            }
        } else {
            stepReview.classList.add("d-none");
            stepForm.classList.remove("d-none");
            stepLabelReview.classList.remove("eng-step-active");
            stepLabelForm.classList.add("eng-step-active");
        }
    }

    function validateBeforeReview() {
        clearAllErrors();
        let valid = true;

        const dispChecked = document.querySelector("input[name='disp']:checked");
        const dispAny = document.querySelector("input[name='disp']");
        if (!dispChecked && dispAny) {
            showFieldError(dispAny, "Please select a disposition.");
            valid = false;
        } else if (dispAny) {
            clearFieldError(dispAny);
        }

        const custChecked = document.querySelector("input[name='cust']:checked");
        const custAny = document.querySelector("input[name='cust']");
        if (!custChecked && custAny) {
            showFieldError(custAny, "Please select customer notification.");
            valid = false;
        } else if (custAny) {
            clearFieldError(custAny);
        }

        const revChecked = document.querySelector("input[name='rev']:checked");
        const revAny = document.querySelector("input[name='rev']");
        if (!revChecked && revAny) {
            showFieldError(revAny, "Please indicate if drawing update is required.");
            valid = false;
        } else if (revAny) {
            clearFieldError(revAny);
        }

        const dispNotesEl = document.getElementById("engDispositionNotes");
        if (dispNotesEl) {
            if (!dispNotesEl.value.trim()) {
                showFieldError(dispNotesEl, "Disposition notes are required.");
                valid = false;
            } else {
                clearFieldError(dispNotesEl);
            }
        }

        const engNameEl = document.getElementById("engName");
        if (engNameEl) {
            if (!engNameEl.value.trim()) {
                showFieldError(engNameEl, "Engineer name is required.");
                valid = false;
            } else {
                clearFieldError(engNameEl);
            }
        }

        return valid;
    }

    if (btnGoReview) {
        btnGoReview.addEventListener("click", function (e) {
            e.preventDefault();

            if (!validateBeforeReview()) {
                setStep(false);
                return;
            }

            setStep(true);
        });
    }

    if (btnBackToEdit) {
        btnBackToEdit.addEventListener("click", function (e) {
            e.preventDefault();
            setStep(false);
        });
    }
});
