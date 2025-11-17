// public/js/engineering.js
(function () {
    const q = (sel) => document.querySelector(sel);
    const Q = (sel) => Array.from(document.querySelectorAll(sel));

    // ---------- Modal helpers (Bootstrap 5) ----------
    function showConfirmModal(title, body, yesLabel) {
        return new Promise((resolve) => {
            const el = q("#cfConfirmModal");
            const modal = bootstrap.Modal.getOrCreateInstance(el);
            q("#cfConfirmTitle").textContent = title || "Please confirm";
            q("#cfConfirmBody").textContent = body || "Are you sure?";
            const yesBtn = q("#cfConfirmYesBtn");

            // replace old handlers
            const newYesBtn = yesBtn.cloneNode(true);
            newYesBtn.textContent = yesLabel || "Yes";
            yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

            newYesBtn.addEventListener("click", () => {
                modal.hide();
                resolve(true);
            });

            const onHide = () => {
                el.removeEventListener("hidden.bs.modal", onHide);
                resolve(false);
            };
            el.addEventListener("hidden.bs.modal", onHide, { once: true });

            modal.show();
        });
    }

    function showSuccessModal(title, body, onOk) {
        const el = q("#cfSuccessModal");
        const modal = bootstrap.Modal.getOrCreateInstance(el);
        q("#cfSuccessTitle").textContent = title || "Success";
        q("#cfSuccessBody").textContent = body || "Done.";
        const okBtn = q("#cfSuccessOkBtn");

        const newOk = okBtn.cloneNode(true);
        newOk.textContent = "OK";
        okBtn.parentNode.replaceChild(newOk, okBtn);
        if (typeof onOk === "function") {
            newOk.addEventListener("click", onOk, { once: true });
        }
        modal.show();
    }

    function showFailModal(title, body) {
        const el = q("#cfFailModal");
        const modal = bootstrap.Modal.getOrCreateInstance(el);
        q("#cfFailTitle").textContent = title || "Action failed";
        q("#cfFailBody").textContent = body || "Something went wrong.";
        modal.show();
    }

    // ---------- Utility/UI helpers ----------
    function fmtDate(d) {
        if (!d) return "";
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return d;
        return dt.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    function showError(message) {
        console.error(message);
        const container = q("main.container-xxl") || document.body;
        let alert = q("#eng-error");
        if (!alert) {
            alert = document.createElement("div");
            alert.id = "eng-error";
            alert.className = "alert alert-danger mt-3";
            container.prepend(alert);
        }
        alert.textContent = message;
    }
    function showInfo(message) {
        const container = q("main.container-xxl") || document.body;
        let alert = q("#eng-info");
        if (!alert) {
            alert = document.createElement("div");
            alert.id = "eng-info";
            alert.className = "alert alert-success mt-3";
            container.prepend(alert);
        }
        alert.textContent = message;
    }
    function readQueryId() {
        const params = new URLSearchParams(window.location.search);
        return params.get("id") || params.get("ncrId");
    }
    function readRadio(name) {
        const el = q(`input[name="${name}"]:checked`);
        return el ? el.value : "";
    }
    function setReviewText(id, txt) {
        const el = q(`#${id}`);
        if (el) el.textContent = txt ?? "—";
    }
    function setText(el, txt) { if (el) el.textContent = txt; }

    // Reflect UI when status is changed to closed, keeping stage in engineering
    function reflectClosedInUI() {
        setText(q("#reviewStatus"), "Closed");
        setText(q("#reviewStage"), "Engineering");
        const statusBadge = q("#statusBadge");
        if (statusBadge) {
            statusBadge.classList.remove("bg-success", "bg-warning", "bg-primary");
            statusBadge.classList.add("bg-secondary");
            statusBadge.textContent = "Closed";
        }
    }

    // ---------- Load NCR header/quality summary ----------
    async function loadNcr() {
        if (!window.NCR || !window.NCR.auth || !window.NCR.auth.client) {
            showError("Auth client not available. Please sign in again.");
            return;
        }
        const client = window.NCR.auth.client;
        const id = readQueryId();
        if (!id) { showError("No NCR id provided in the URL."); return; }

        try {
            const { data, error } = await client
                .from("ncrs")
                .select("id, ncr_no, status, current_stage, date_raised, rep_name, wip, defect_desc, qty_supplied, qty_defective, product_no, so_no, is_nc, suppliers(name)")
                .eq("id", id)
                .single();

            if (error || !data) { console.error(error); showError("Could not load NCR details. Please try again."); return; }

            const n = data;
            const mapping = {
                ncrNo: n.ncr_no || "",
                dateRaised: fmtDate(n.date_raised),
                repName: n.rep_name || "",
                wip: n.wip ? "WIP" : "Supplier",
                itemDesc: n.product_no || "",
                defectDesc: n.defect_desc || "",
                qtySupplied: n.qty_supplied ?? "",
                qtyDefective: n.qty_defective ?? "",
                productNo: n.product_no || "",
                supplier: (n.suppliers && n.suppliers.name) || "",
                soNo: n.so_no || "",
                isNc: n.is_nc ? "Yes" : "No",
            };

            // fill inputs
            Q('input[data-source="quality"]').forEach((input) => {
                const field = input.dataset.field;
                if (field && Object.prototype.hasOwnProperty.call(mapping, field)) {
                    input.value = String(mapping[field] ?? "");
                }
            });
            // mirror to spans
            Q('[data-source="quality"]').forEach((el) => {
                const field = el.dataset.field;
                if (field && Object.prototype.hasOwnProperty.call(mapping, field)) {
                    el.textContent = String(mapping[field] ?? "");
                }
            });

            const reviewNo = q("#reviewNcrNo");
            if (reviewNo) reviewNo.textContent = mapping.ncrNo || "NCR";

            // reflect current status/stage initially
            setText(q("#reviewStatus"), (n.status || "open")[0].toUpperCase() + (n.status || "open").slice(1));
            setText(q("#reviewStage"), (n.current_stage || "engineering")[0].toUpperCase() + (n.current_stage || "engineering").slice(1));
            const statusBadge = q("#statusBadge");
            if (statusBadge) {
                statusBadge.classList.remove("bg-secondary", "bg-warning", "bg-primary", "bg-success");
                statusBadge.classList.add(n.status === "closed" ? "bg-secondary" : "bg-primary");
                statusBadge.textContent = (n.status || "Open")[0].toUpperCase() + (n.status || "Open").slice(1);
            }
        } catch (err) {
            console.error(err);
            showError("Unexpected error loading NCR.");
        }
    }

    // ---------- Engineering form read/validate ----------
    function readEngForm() {
        return {
            disposition: readRadio("disp") || null,
            customer_notify: readRadio("cust") || null,
            disposition_notes: q("#engDispositionNotes")?.value?.trim() || null,
            drawing_update_required: readRadio("rev") || null,
            original_rev: q("#engOriginalRev")?.value?.trim() || null,
            updated_rev: q("#engUpdatedRev")?.value?.trim() || null,
            engineer_name: q("#engName")?.value?.trim() || null,
            revision_date: q("#engRevisionDate")?.value || null,
            signature_date: q("#engSignatureDate")?.value || null,
            signature: q("#engSignature")?.value?.trim() || null,
        };
    }

    function validateForSubmit(model) {
        const missing = [];
        if (!model.disposition) missing.push("Disposition");
        if (!model.customer_notify) missing.push("Customer notification");
        if (!model.disposition_notes) missing.push("Disposition notes");
        if (!model.drawing_update_required) missing.push("Drawing update required");
        if (!model.engineer_name) missing.push("Engineer name");
        if (missing.length) {
            throw new Error(`Please complete required fields: ${missing.join(", ")}.`);
        }
    }

    function populateReviewFromForm() {
        const m = readEngForm();
        setReviewText("reviewDisp", m.disposition || "—");
        setReviewText("reviewCustNotify", m.customer_notify || "—");
        setReviewText("reviewRevRequired", m.drawing_update_required || "—");
        setReviewText("reviewDispNotes", m.disposition_notes || "—");
        setReviewText("reviewOrigRev", m.original_rev || "—");
        setReviewText("reviewUpdatedRev", m.updated_rev || "—");
        setReviewText("reviewEngineerName", m.engineer_name || "—");
        setReviewText("reviewRevisionDate", m.revision_date || "—");
        setReviewText("reviewSignatureDate", m.signature_date || "—");
        setReviewText("reviewSignature", m.signature || "—");
    }

    // ---------- DB ops ----------
    async function upsertEngineering(statusForRow /* 'draft'|'submitted' */) {
        const client = window.NCR.auth.client;
        const ncrId = readQueryId();
        const m = readEngForm();

        const payload = {
            ncr_id: Number(ncrId),
            status: statusForRow,
            disposition: m.disposition,
            customer_notify: m.customer_notify,
            disposition_notes: m.disposition_notes,
            drawing_update_required: m.drawing_update_required,
            original_rev: m.original_rev,
            updated_rev: m.updated_rev,
            engineer_name: m.engineer_name,
            revision_date: m.revision_date || null,
            signature_date: m.signature_date || null,
            signature: m.signature
        };

        const { data, error } = await window.NCR.auth.client
            .from("ncr_engineering")
            .upsert(payload, { onConflict: "ncr_id", ignoreDuplicates: false })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async function updateNcrToOperations() {
        const client = window.NCR.auth.client;
        const ncrId = readQueryId();
        const { data, error } = await client
            .from("ncrs")
            .update({
                current_stage: "operations",
                whose_turn_dept: "operations",
                next_up_dept: "closed",
            })
            .eq("id", ncrId)
            .select("id,current_stage,whose_turn_dept,next_up_dept")
            .single();

        if (error) throw error;
        return data;
    }

    async function closeNcrInEngineering() {
        const client = window.NCR.auth.client;
        const ncrId = Number(readQueryId());
        const { data, error } = await client
            .from("ncrs")
            .update({
                status: "closed",
                closed_at: new Date().toISOString(),
                closed_by: (await window.NCR.auth.requireLogin())?.user?.id ?? null,
                current_stage: "engineering"
            })
            .eq("id", ncrId)
            .select("id,status,closed_at,closed_by,current_stage,whose_turn_dept,next_up_dept")
            .single();

        if (error) throw error;
        return data;
    }

    // ---------- Step toggles ----------
    function switchToReviewStep() {
        q("#engStepForm")?.classList.add("d-none");
        q("#engStepReview")?.classList.remove("d-none");
        q("#stepLabelForm")?.classList.remove("eng-step-active");
        q("#stepLabelReview")?.classList.add("eng-step-active");
    }
    function switchToEditStep() {
        q("#engStepReview")?.classList.add("d-none");
        q("#engStepForm")?.classList.remove("d-none");
        q("#stepLabelReview")?.classList.remove("eng-step-active");
        q("#stepLabelForm")?.classList.add("eng-step-active");
    }

    // ---------- Init / Events ----------
    document.addEventListener("DOMContentLoaded", async () => {
        // 🔐 require login
        if (!window.NCR || !window.NCR.auth || !window.NCR.auth.requireLogin) {
            console.error("Auth module not loaded, redirecting to login.");
            window.location.href = "login.html";
            return;
        }
        const session = await window.NCR.auth.requireLogin();
        if (!session) return;

        await loadNcr();

        // Save (draft) with confirm ➜ success/fail
        const btnSave = q("#btnSave");
        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const ok = await showConfirmModal("Save Draft?", "Save your engineering notes as a draft?", "Save Draft");
                if (!ok) return;

                const prev = btnSave.innerHTML;
                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

                try {
                    await upsertEngineering("draft");
                    showSuccessModal("Draft Saved", "Your engineering draft has been saved.");
                } catch (e) {
                    console.error(e);
                    showFailModal("Save Failed", e.message || "Failed to save draft.");
                } finally {
                    btnSave.disabled = false;
                    btnSave.innerHTML = prev;
                }
            });
        }

        // Go to Review
        const btnGoReview = q("#btnGoReview");
        if (btnGoReview) {
            btnGoReview.addEventListener("click", () => {
                populateReviewFromForm();
                switchToReviewStep();
            });
        }

        // Back to Edit
        const btnBackToEdit = q("#btnBackToEdit");
        if (btnBackToEdit) {
            btnBackToEdit.addEventListener("click", () => {
                switchToEditStep();
            });
        }

        // Forward to Procurement
        const btnForward = q("#btnForward");
        if (btnForward) {
            btnForward.addEventListener("click", async () => {
                try {
                    const model = readEngForm();
                    validateForSubmit(model);

                    const ok = await showConfirmModal(
                        "Forward to Procurement?",
                        "Engineering will be saved and this NCR will move to Procurement (Operations). Proceed?",
                        "Forward"
                    );
                    if (!ok) return;

                    const prev = btnForward.innerHTML;
                    btnForward.disabled = true;
                    btnForward.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Forwarding…';

                    // keep notes
                    try { await upsertEngineering("draft"); } catch (_) { }

                    const ncrId = Number(readQueryId());
                    const { error } = await window.NCR.auth.client.rpc("forward_to_operations", { p_ncr_id: ncrId });
                    if (error) throw error;

                    showSuccessModal(
                        "Forwarded",
                        "This NCR has been forwarded to Procurement.",
                        () => { window.location.href = "view-ncr.html?forwarded=1"; }
                    );
                } catch (e) {
                    console.error(e);
                    showFailModal("Forward Failed", e.message || "Failed to forward to Procurement.");
                } finally {
                    btnForward.disabled = false;
                    btnForward.textContent = "Forward to Procurement";
                }
            });
        }

        // Close NCR in Engineering (no navigation)
        const btnClose = q("#btnCloseNcr");
        if (btnClose) {
            btnClose.addEventListener("click", async () => {
                try {
                    const ok = await showConfirmModal(
                        "Close this NCR?",
                        "This marks the NCR as Closed and keeps it in the Engineering stage.",
                        "Close NCR"
                    );
                    if (!ok) return;

                    const prev = btnClose.innerHTML;
                    btnClose.disabled = true;
                    btnClose.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Closing…';

                    // optionally persist notes
                    try { await upsertEngineering("draft"); } catch (_) { }

                    await closeNcrInEngineering();
                    reflectClosedInUI();

                    showSuccessModal("NCR Closed", "The NCR is now closed and remains in the Engineering stage.");
                } catch (e) {
                    console.error(e);
                    showFailModal("Close Failed", e.message || "Could not close the NCR.");
                } finally {
                    btnClose.disabled = false;
                    btnClose.innerHTML = "Close NCR";
                }
            });
        }

        // Sign out
        const signOutLink = document.querySelector('a[href="#logout"]');
        if (signOutLink) {
            signOutLink.addEventListener("click", async (event) => {
                event.preventDefault();
                const ok = await showConfirmModal("Sign out?", "Sign out of Crossfire NCR?", "Sign out");
                if (!ok) return;
                if (window.NCR?.auth && typeof window.NCR.auth.signOut === "function") {
                    await window.NCR.auth.signOut();
                } else {
                    window.location.href = "login.html";
                }
            });
        }
    });
})();
