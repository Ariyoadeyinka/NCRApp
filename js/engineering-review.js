// js/engineering-review.js
(function () {
    // --- NEW: same constants style as Quality page --- (if you need Supabase URL/KEY here, add like in other files)
    const q = (sel) => document.querySelector(sel);
    const Q = (sel) => Array.from(document.querySelectorAll(sel));

    let currentStage = "engineering";
    let currentNcrNumber = ""; // store NCR number for notifications
    let currentSession = null; // store supabase session so we can read user id

    // --- Notifications (same as before) ---

    async function createNotificationRow(payload) {
        try {
            if (!window.NCR?.auth?.client) return;
            const client = window.NCR.auth.client;
            const { error } = await client
                .from("ncr_notifications")
                .insert(payload);
            if (error) {
                console.warn("eng failed to create notification", error);
            } else {
                console.log("eng created notification:", payload);
            }
        } catch (err) {
            console.warn("eng createNotificationRow threw:", err);
        }
    }

    async function createOperationsNotification(ncrId, ncrNumber) {
        const displayNumber = ncrNumber || ncrId;
        const message = `NCR #${displayNumber} has been sent to Procurement for review.`;
        const link = `view-ncr.html?id=${encodeURIComponent(ncrId)}`;

        try {
            await createNotificationRow({
                ncr_id: ncrId,
                message,
                type: "stage_change",
                recipient_role: "operations",
                link,
            });
        } catch (error) {
            console.warn("Failed to insert Operations notification", error);
        }
    }

    // ---------- Generic helpers ----------

    function showConfirmModal(title, body, yesLabel) {
        return new Promise((resolve) => {
            const el = q("#cfConfirmModal");
            const modal = bootstrap.Modal.getOrCreateInstance(el);
            q("#cfConfirmTitle").textContent = title || "Please confirm";
            q("#cfConfirmBody").textContent = body || "Are you sure?";

            const yesBtn = q("#cfConfirmYesBtn");
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

    function fmtDate(d) {
        if (!d) return "";
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return d;
        return dt.toISOString().slice(0, 10);
    }

    function showError(message) {
        console.error(message);
        const container = q("main.container-xxl, main.container") || document.body;
        let alert = q("#eng-error");
        if (!alert) {
            alert = document.createElement("div");
            alert.id = "eng-error";
            alert.className = "alert alert-danger mt-3";
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

    function setText(el, txt) {
        if (el) el.textContent = txt;
    }

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
        document.querySelectorAll(".cf-error").forEach((e) => e.remove());
        document.querySelectorAll(".is-invalid").forEach((el) => {
            el.classList.remove("is-invalid");
            el.style.borderColor = "#17345120";
        });
    }

    // ---------- Engineer name helpers ----------

    function getCurrentUserDisplayNameFromMetadata() {
        if (currentSession && currentSession.user) {
            const u = currentSession.user;
            const meta = u.user_metadata || {};

            if (meta.full_name) return meta.full_name;
            if (meta.name) return meta.name;
            if (meta.display_name) return meta.display_name;
            if (meta.first_name || meta.last_name) {
                return `${meta.first_name || ""} ${meta.last_name || ""}`.trim();
            }
            // we intentionally do NOT fall back to email
        }

        // localStorage fallbacks (if you stored something there elsewhere)
        try {
            const rawProfile = localStorage.getItem("cf_user_profile");
            if (rawProfile) {
                const p = JSON.parse(rawProfile);
                if (p.full_name) return p.full_name;
                if (p.name) return p.name;
            }
        } catch {
            // ignore
        }

        const alt =
            localStorage.getItem("cf_user_name") ||
            localStorage.getItem("cf_full_name") ||
            "";
        return alt;
    }

    async function resolveEngineerName() {
        // 1) session metadata / local storage
        let name = getCurrentUserDisplayNameFromMetadata();

        // 2) profiles table fallback using full_name ONLY (matches your schema)
        if (!name && window.NCR?.auth?.client && currentSession?.user?.id) {
            try {
                const client = window.NCR.auth.client;
                const { data, error } = await client
                    .from("profiles")
                    .select("full_name")
                    .eq("id", currentSession.user.id)
                    .maybeSingle(); // returns null if no row

                if (!error && data && data.full_name) {
                    name = data.full_name;
                } else if (error) {
                    console.warn("[eng] profiles lookup error:", error);
                }
            } catch (e) {
                console.warn("[eng] profiles lookup threw:", e);
            }
        }

        console.log("[eng] resolved engineer name:", name);
        return name || "";
    }

    async function prefillEngineerName() {
        const el = q("#engName");
        if (!el) return;

        // If already filled from DB load, just lock it
        if (el.value && el.value.trim() !== "") {
            el.readOnly = true;
            return;
        }

        const name = await resolveEngineerName();
        if (name && name.trim()) {
            el.value = name.trim();
        }

        // always read-only for user
        el.readOnly = true;
    }

    // ---------- Load NCR (quality-ish header info) ----------

    async function loadNcr() {
        if (!window.NCR?.auth?.client) {
            showError("Auth client not available. Please sign in again.");
            return;
        }
        const client = window.NCR.auth.client;
        const id = readQueryId();
        if (!id) {
            showError("No NCR id provided in the URL.");
            return;
        }

        try {
            const { data, error } = await client
                .from("ncrs")
                .select(
                    "id, ncr_no, status, current_stage, date_raised, rep_name, wip, defect_desc, qty_supplied, qty_defective, product_no, so_no, is_nc, suppliers(name)"
                )
                .eq("id", id)
                .single();

            if (error || !data) {
                console.error(error);
                showError("Could not load NCR details. Please try again.");
                return;
            }

            const n = data;
            currentStage = (n.current_stage || "").toLowerCase();

            if (currentStage !== "engineering" && currentStage !== "operations") {
                console.warn(
                    "NCR current_stage is neither engineering nor operations:",
                    n.current_stage
                );
            }

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

            currentNcrNumber = mapping.ncrNo || "";

            Q('input[data-source="quality"]').forEach((input) => {
                const field = input.dataset.field;
                if (field && Object.prototype.hasOwnProperty.call(mapping, field)) {
                    input.value = String(mapping[field] ?? "");
                }
            });

            Q('[data-source="quality"]').forEach((el) => {
                const field = el.dataset.field;
                if (field && Object.prototype.hasOwnProperty.call(mapping, field)) {
                    el.textContent = String(mapping[field] ?? "");
                }
            });

            const reviewNo = q("#reviewNcrNo");
            if (reviewNo) reviewNo.textContent = mapping.ncrNo || "NCR";

            setText(
                q("#reviewStatus"),
                (n.status || "open").charAt(0).toUpperCase() +
                (n.status || "open").slice(1)
            );
            setText(
                q("#reviewStage"),
                (n.current_stage || "engineering").charAt(0).toUpperCase() +
                (n.current_stage || "engineering").slice(1)
            );

            const statusBadge = q("#statusBadge");
            if (statusBadge) {
                statusBadge.classList.remove(
                    "bg-secondary",
                    "bg-warning",
                    "bg-primary",
                    "bg-success"
                );
                statusBadge.classList.add(
                    n.status === "closed" ? "bg-secondary" : "bg-primary"
                );
                statusBadge.textContent =
                    (n.status || "Open").charAt(0).toUpperCase() +
                    (n.status || "Open").slice(1);
            }

            const notEngMsg = q("#engNotInStageMsg");
            const engMain = q("#engMainWrapper");
            if (notEngMsg) notEngMsg.classList.add("d-none");
            if (engMain) engMain.classList.remove("d-none");
        } catch (err) {
            console.error(err);
            showError("Unexpected error loading NCR.");
        }
    }

    // ---------- Engineering form ----------

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
        clearAllErrors();
        let valid = true;

        const dispAny = document.querySelector("input[name='disp']");
        const custAny = document.querySelector("input[name='cust']");
        const revAny = document.querySelector("input[name='rev']");

        if (!model.disposition && dispAny) {
            showFieldError(dispAny, "Please select a disposition.");
            valid = false;
        } else if (dispAny) {
            clearFieldError(dispAny);
        }

        if (!model.customer_notify && custAny) {
            showFieldError(custAny, "Please select customer notification.");
            valid = false;
        } else if (custAny) {
            clearFieldError(custAny);
        }

        if (!model.drawing_update_required && revAny) {
            showFieldError(
                revAny,
                "Please indicate if drawing update is required."
            );
            valid = false;
        } else if (revAny) {
            clearFieldError(revAny);
        }

        const dispNotesEl = q("#engDispositionNotes");
        if (dispNotesEl) {
            if (!model.disposition_notes) {
                showFieldError(dispNotesEl, "Disposition notes are required.");
                valid = false;
            } else {
                clearFieldError(dispNotesEl);
            }
        }

        const engNameEl = q("#engName");
        if (engNameEl) {
            if (!model.engineer_name) {
                showFieldError(engNameEl, "Engineer name is required.");
                valid = false;
            } else {
                clearFieldError(engNameEl);
            }
        }

        return valid;
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

    async function loadEngineering() {
        if (!window.NCR?.auth?.client) {
            showError("Auth client not available. Please sign in again.");
            return;
        }
        const client = window.NCR.auth.client;
        const ncrId = readQueryId();
        if (!ncrId) return;

        try {
            const { data, error } = await client
                .from("ncr_engineering")
                .select(
                    "disposition, customer_notify, disposition_notes, drawing_update_required, original_rev, updated_rev, engineer_name, revision_date, signature_date, signature, status"
                )
                .eq("ncr_id", ncrId)
                .limit(1);

            if (error) {
                console.error("loadEngineering error:", error);
                return;
            }
            if (!data || !data.length) {
                return;
            }

            const row = data[0];

            const setRadio = (name, value) => {
                if (!value) return;
                const el = q(`input[name="${name}"][value="${value}"]`);
                if (el) el.checked = true;
            };

            setRadio("disp", row.disposition);
            setRadio("cust", row.customer_notify);
            setRadio("rev", row.drawing_update_required);

            if (q("#engDispositionNotes"))
                q("#engDispositionNotes").value = row.disposition_notes || "";
            if (q("#engOriginalRev"))
                q("#engOriginalRev").value = row.original_rev || "";
            if (q("#engUpdatedRev"))
                q("#engUpdatedRev").value = row.updated_rev || "";
            if (q("#engName")) q("#engName").value = row.engineer_name || "";
            if (q("#engRevisionDate"))
                q("#engRevisionDate").value = row.revision_date
                    ? fmtDate(row.revision_date)
                    : "";
            if (q("#engSignatureDate"))
                q("#engSignatureDate").value = row.signature_date
                    ? fmtDate(row.signature_date)
                    : "";
            if (q("#engSignature")) q("#engSignature").value = row.signature || "";

            populateReviewFromForm();
        } catch (err) {
            console.error("Unexpected error loading engineering row:", err);
        }
    }

    async function upsertEngineering(statusForRow) {
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
            signature: m.signature,
        };

        const { data, error } = await client
            .from("ncr_engineering")
            .upsert(payload, { onConflict: "ncr_id", ignoreDuplicates: false })
            .select()
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
                current_stage: "engineering",
            })
            .eq("id", ncrId)
            .select(
                "id,status,closed_at,closed_by,current_stage,whose_turn_dept,next_up_dept"
            )
            .single();

        if (error) throw error;
        return data;
    }

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

    // ---------- Wiring up page ----------

    document.addEventListener("DOMContentLoaded", async () => {
        if (!window.NCR?.auth?.requireLogin) {
            console.error("Auth module not loaded, redirecting to login.");
            window.location.href = "login.html";
            return;
        }
        const session = await window.NCR.auth.requireLogin();
        if (!session) return;
        currentSession = session;

        await loadNcr();
        await loadEngineering();
        await prefillEngineerName(); // 🔥 fill & lock engineer name here

        const btnSave = q("#btnSave");
        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const ok = await showConfirmModal(
                    "Save Draft?",
                    "Save your engineering notes as a draft?",
                    "Save Draft"
                );
                if (!ok) return;

                const prev = btnSave.innerHTML;
                btnSave.disabled = true;
                btnSave.innerHTML =
                    '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

                try {
                    await upsertEngineering("draft");
                    showSuccessModal(
                        "Draft Saved",
                        "Your engineering draft has been saved."
                    );
                } catch (e) {
                    console.error(e);
                    showFailModal(
                        "Save Failed",
                        e.message || "Failed to save draft."
                    );
                } finally {
                    btnSave.disabled = false;
                    btnSave.innerHTML = prev;
                }
            });
        }

        q("#btnGoReview")?.addEventListener("click", (e) => {
            e.preventDefault();
            const model = readEngForm();
            if (!validateForSubmit(model)) {
                switchToEditStep();
                return;
            }
            populateReviewFromForm();
            switchToReviewStep();
        });

        q("#btnBackToEdit")?.addEventListener("click", (e) => {
            e.preventDefault();
            switchToEditStep();
        });

        const btnForward = q("#btnForward");
        if (btnForward) {
            if (currentStage === "operations") {
                btnForward.textContent = "Save Changes";

                btnForward.addEventListener("click", async (e) => {
                    e.preventDefault();
                    const model = readEngForm();
                    if (!validateForSubmit(model)) {
                        switchToEditStep();
                        return;
                    }

                    const ok = await showConfirmModal(
                        "Save Engineering Changes?",
                        "Your engineering updates will be saved. The NCR will remain in Operations.",
                        "Save Changes"
                    );
                    if (!ok) return;

                    const prev = btnForward.innerHTML;
                    btnForward.disabled = true;
                    btnForward.innerHTML =
                        '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

                    try {
                        await upsertEngineering("draft");
                        showSuccessModal(
                            "Changes Saved",
                            "Your engineering changes have been saved.",
                            () => {
                                window.location.href = "view-ncr.html?updated=1";
                            }
                        );
                    } catch (e2) {
                        console.error(e2);
                        showFailModal(
                            "Save Failed",
                            e2.message || "Failed to save engineering changes."
                        );
                    } finally {
                        btnForward.disabled = false;
                        btnForward.innerHTML = "Save Changes";
                    }
                });
            } else {
                btnForward.addEventListener("click", async (e) => {
                    e.preventDefault();
                    const model = readEngForm();
                    if (!validateForSubmit(model)) {
                        switchToEditStep();
                        return;
                    }

                    const ok = await showConfirmModal(
                        "Forward to Procurement?",
                        "Engineering will be saved and this NCR will move to Procurement (Operations). Proceed?",
                        "Forward"
                    );
                    if (!ok) return;

                    const prev = btnForward.innerHTML;
                    btnForward.disabled = true;
                    btnForward.innerHTML =
                        '<span class="spinner-border spinner-border-sm me-1"></span> Forwarding…';

                    try {
                        const client = window.NCR.auth.client;
                        const ncrId = Number(readQueryId());

                        // 1) Save engineering info
                        try {
                            await upsertEngineering("draft");
                        } catch (_) {
                            // ignore if no existing row
                        }

                        // 2) Call your Postgres function
                        const { error } = await client.rpc("forward_to_operations", {
                            p_ncr_id: ncrId,
                        });
                        if (error) throw error;

                        // 3) HARD-SET stage to Operations on the NCR row
                        await client
                            .from("ncrs")
                            .update({
                                current_stage: "operations",
                                whose_turn_dept: "operations",
                                next_up_dept: "operations",
                                status: "open",
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", ncrId);

                        // 4) Create notification for Operations
                        await createOperationsNotification(ncrId, currentNcrNumber);

                        showSuccessModal(
                            "Forwarded",
                            "This NCR has been forwarded to Procurement.",
                            () => {
                                window.location.href = "view-ncr.html?forwarded=1";
                            }
                        );
                    } catch (e2) {
                        console.error(e2);
                        showFailModal(
                            "Forward Failed",
                            e2.message || "Failed to forward to Procurement."
                        );
                    } finally {
                        btnForward.disabled = false;
                        btnForward.textContent = "Forward to Procurement";
                    }
                });
            }
        }

        const btnClose = q("#btnCloseNcr");
        if (btnClose) {
            btnClose.addEventListener("click", async (e) => {
                e.preventDefault();
                try {
                    const ok = await showConfirmModal(
                        "Close this NCR?",
                        "This marks the NCR as Closed and keeps it in the Engineering stage.",
                        "Close NCR"
                    );
                    if (!ok) return;

                    const prev = btnClose.innerHTML;
                    btnClose.disabled = true;
                    btnClose.innerHTML =
                        '<span class="spinner-border spinner-border-sm me-1"></span> Closing…';

                    try {
                        await upsertEngineering("draft");
                    } catch (_) { }

                    await closeNcrInEngineering();
                    reflectClosedInUI();

                    showSuccessModal(
                        "NCR Closed",
                        "The NCR is now closed and remains in the Engineering stage."
                    );
                } catch (e2) {
                    console.error(e2);
                    showFailModal(
                        "Close Failed",
                        e2.message || "Could not close the NCR."
                    );
                } finally {
                    btnClose.disabled = false;
                    btnClose.innerHTML = "Close NCR";
                }
            });
        }

        const signOutLink = document.querySelector('a[href="#logout"]');
        if (signOutLink) {
            signOutLink.addEventListener("click", async (event) => {
                event.preventDefault();
                const ok = await showConfirmModal(
                    "Sign out?",
                    "Sign out of Crossfire NCR?",
                    "Sign out"
                );
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
