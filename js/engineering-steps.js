document.addEventListener("DOMContentLoaded", function () {
    const stepForm = document.getElementById("engStepForm");
    const stepReview = document.getElementById("engStepReview");
    const btnGoReview = document.getElementById("btnGoReview");
    const btnBackToEdit = document.getElementById("btnBackToEdit");
    const stepLabelForm = document.getElementById("stepLabelForm");
    const stepLabelReview = document.getElementById("stepLabelReview");

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
                document.getElementById("reviewNcrNo").textContent = ncrNoInput.value || ncrNoInput.textContent || "NCR";
            }
        } else {
            stepReview.classList.add("d-none");
            stepForm.classList.remove("d-none");
            stepLabelReview.classList.remove("eng-step-active");
            stepLabelForm.classList.add("eng-step-active");
        }
    }

    if (btnGoReview) {
        btnGoReview.addEventListener("click", function () {
            setStep(true);
        });
    }
    if (btnBackToEdit) {
        btnBackToEdit.addEventListener("click", function () {
            setStep(false);
        });
    }
});