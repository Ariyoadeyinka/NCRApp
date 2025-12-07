// js/operations-review.js
(function () {
    const q = (sel) => document.querySelector(sel);
    const Q = (sel) => Array.from(document.querySelectorAll(sel));
    let currentSession = null; // store session so we can use it for ops manager + notifications

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

    // ---------- Close the main NCR from Operations ----------

    async function closeNcrInOperations() {
        const client = window.NCR.auth.client;
        const ncrId = Number(readQueryId());

        if (!ncrId || Number.isNaN(ncrId)) {
            throw new Error("Invalid NCR id in URL.");
        }

        const session = await window.NCR.auth.requireLogin();
        const nowIso = new Date().toISOString();

        const { data, error } = await client
            .from("ncrs")
            .update({
                status: "closed",
                current_stage: "operations",
                date_closed: nowIso,
                closed_at: nowIso,
                closed_by: session?.user?.id ?? null
            })
            .eq("id", ncrId)
            .select("id,status,current_stage,date_closed,closed_at,closed_by");

        if (error) {
            console.error("closeNcrInOperations error:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            // RLS / no permission case
            console.error("closeNcrInOperations: no rows were updated (likely RLS)");
            throw new Error(
                "This NCR could not be closed. You might not have permission to update it."
            );
        }

        console.log("NCR closed successfully in operations:", data[0]);
        return true;
    }

    window.closeNcrInOperations = closeNcrInOperations;

    // ---------- Notifications: tell NCR + Quality dept that an NCR was closed ----------

    async function notifyNcrDeptClosed(ncrId) {
        if (!window.NCR?.auth?.client) {
            console.warn("Auth client not available; cannot send notification.");
            return;
        }

        const client = window.NCR.auth.client;
        const sessionUserId = currentSession?.user?.id ?? null;

        let ncrNoLabel = `#${ncrId}`;

        try {
            const { data, error } = await client
                .from("ncrs")
                .select("ncr_no")
                .eq("id", ncrId)
                .single();

            if (!error && data?.ncr_no) {
                ncrNoLabel = data.ncr_no;
            }
        } catch (e) {
            console.warn("Could not fetch NCR number for notification:", e);
        }

        const actorName = getCurrentUserDisplayName() || "Operations Manager";
        const baseMessage = `NCR ${ncrNoLabel} has been closed in Operations by ${actorName}.`;

        const basePayload = {
            ncr_id: Number(ncrId),
            type: "ncr_closed",
            message: baseMessage,
            link: `view-ncr.html?id=${encodeURIComponent(ncrId)}`,
            created_by: sessionUserId
        };

        const { error: notifError } = await client
            .from("ncr_notifications")
            .insert([
                { ...basePayload, recipient_role: "ncr_department" },
                { ...basePayload, recipient_role: "quality" }
            ]);

        if (notifError) {
            console.error("notifyNcrDeptClosed error:", notifError);
        } else {
            console.log("notifyNcrDeptClosed: notifications inserted for NCR + Quality");
        }
    }

    // ---------- Small helpers ----------

    function fmtDate(d) {
        if (!d) return "";
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return d;
        return dt.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    function showError(message) {
        console.error(message);
        const container = q("main.container-xxl, main.container") || document.body;
        let alert = q("#ops-error");
        if (!alert) {
            alert = document.createElement("div");
            alert.id = "ops-error";
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

    function showFieldError(el, msg) {
        if (!el) return false;
        el.classList.add("is-invalid");
        el.style.borderColor = "#dc3545";
        const holder =
            el.closest(".col-12, .col-md-6, .col, .col-lg-4") || el.parentElement;
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
        const holder =
            el.closest(".col-12, .col-md-6, .col, .col-lg-4") || el.parentElement;
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

    // ---------- NCR number helpers (unique NCR-YYYY-####) ----------

    function generateRandomNcrNo() {
        const year = new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit random
        return `NCR-${year}-${rand}`;
    }

    async function ncrNoExists(ncrNo) {
        if (!window.NCR?.auth?.client) {
            console.warn("Supabase client not available, skipping NCR dup check.");
            return false;
        }
        const client = window.NCR.auth.client;

        try {
            const { data, error } = await client
                .from("ncrs")
                .select("id")
                .eq("ncr_no", ncrNo)
                .limit(1);

            if (error) {
                console.error("ncrNoExists error:", error);
                return false; // fail open
            }
            return Array.isArray(data) && data.length > 0;
        } catch (err) {
            console.error("ncrNoExists unexpected error:", err);
            return false;
        }
    }

    async function generateUniqueNcrNo(maxAttempts = 5) {
        for (let i = 0; i < maxAttempts; i++) {
            const candidate = generateRandomNcrNo();
            const exists = await ncrNoExists(candidate);
            if (!exists) return candidate;
        }
        throw new Error("Could not generate a unique NCR number after several attempts.");
    }

    // ---------- Current user name helper (for Ops Manager) ----------

    function getCurrentUserDisplayName() {
        if (currentSession && currentSession.user) {
            const u = currentSession.user;
            const meta = u.user_metadata || {};

            // Prefer real name from metadata
            if (meta.full_name) return meta.full_name;
            if (meta.name) return meta.name;
            if (meta.display_name) return meta.display_name;
            if (meta.first_name || meta.last_name) {
                return `${meta.first_name || ""} ${meta.last_name || ""}`.trim();
            }
            // no email fallback (you don't want that)
        }

        // Fallbacks from localStorage if you’ve stored names there
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

    function prefillOpsManager() {
        const el = q("#opsManager");
        const dateEl = q("#opsDate");
        if (!el) return;
        if (el.value && el.value.trim() !== "") return;

        const name = getCurrentUserDisplayName();
        if (name) {
            el.value = name;
        }

        // ---- Prefill Ops Manager Date (today) ----
        if (dateEl && (!dateEl.value || dateEl.value.trim() === "")) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            dateEl.value = today;
        }
    }

    // ---------- Load Quality summary ----------

    async function loadQualitySummary() {
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
                    `
          id,
          ncr_no,
          status,
          current_stage,
          date_raised,
          closed_at,
          rep_name,
          wip,
          defect_desc,
          qty_supplied,
          qty_defective,
          product_no,
          so_no,
          is_nc,
          suppliers(name)
        `
                )
                .eq("id", id)
                .single();

            if (error || !data) {
                console.error(error);
                showError("Could not load NCR details. Please try again.");
                return;
            }

            const n = data;
            const mapping = {
                ncrNo: n.ncr_no || "",
                dateRaised: fmtDate(n.date_raised),
                dateClosed: fmtDate(n.closed_at),
                repName: n.rep_name || "",
                wip: n.wip ? "WIP" : "Supplier",
                defectDesc: n.defect_desc || "",
                qtySupplied: n.qty_supplied ?? "",
                qtyDefective: n.qty_defective ?? "",
                productNo: n.product_no || "",
                supplier: (n.suppliers && n.suppliers.name) || "",
                soNo: n.so_no || "",
                isNc: n.is_nc ? "Yes" : "No"
            };

            Q('input[data-source="quality"], textarea[data-source="quality"]').forEach(
                (el) => {
                    const field = el.dataset.field;
                    if (
                        field &&
                        Object.prototype.hasOwnProperty.call(mapping, field)
                    ) {
                        el.value = String(mapping[field] ?? "");
                    }
                }
            );

            Q('[data-source="quality"]:not(input):not(textarea)').forEach((el) => {
                const field = el.dataset.field;
                if (
                    field &&
                    Object.prototype.hasOwnProperty.call(mapping, field)
                ) {
                    el.textContent = String(mapping[field] ?? "");
                }
            });

            const inspectorNameEl = q("#inspectorName");
            if (
                inspectorNameEl &&
                (!inspectorNameEl.value || inspectorNameEl.value.trim() === "")
            ) {
                inspectorNameEl.value = mapping.repName || "";
            }

            const qualityDeptDateEl = q("#qualityDeptDate");
            if (
                qualityDeptDateEl &&
                (!qualityDeptDateEl.value || qualityDeptDateEl.value.trim() === "")
            ) {
                qualityDeptDateEl.value = mapping.dateRaised || "";
            }
        } catch (err) {
            console.error(err);
            showError("Unexpected error loading NCR.");
        }
    }

    // ---------- Load Engineering summary ----------

    async function loadEngineeringSummary() {
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
                    `
          disposition,
          customer_notify,
          disposition_notes,
          drawing_update_required,
          original_rev,
          updated_rev,
          engineer_name,
          revision_date,
          signature_date,
          signature
        `
                )
                .eq("ncr_id", ncrId)
                .limit(1);

            if (error) {
                console.error("loadEngineeringSummary error:", error);
                return;
            }
            if (!data || !data.length) {
                return;
            }

            const row = data[0];

            const mapping = {
                disposition: row.disposition || "",
                customer_notify: row.customer_notify || "",
                disposition_notes: row.disposition_notes || "",
                drawing_update_required: row.drawing_update_required || "",
                original_rev: row.original_rev || "",
                updated_rev: row.updated_rev || "",
                engineer_name: row.engineer_name || "",
                revision_date: row.revision_date ? fmtDate(row.revision_date) : "",
                signature_date: row.signature_date ? fmtDate(row.signature_date) : "",
                signature: row.signature || ""
            };

            Q(
                'input[data-source="engineering"], textarea[data-source="engineering"]'
            ).forEach((el) => {
                const field = el.dataset.field;
                if (
                    field &&
                    Object.prototype.hasOwnProperty.call(mapping, field)
                ) {
                    el.value = String(mapping[field] ?? "");
                }
            });

            Q(
                '[data-source="engineering"]:not(input):not(textarea)'
            ).forEach((el) => {
                const field = el.dataset.field;
                if (
                    field &&
                    Object.prototype.hasOwnProperty.call(mapping, field)
                ) {
                    el.textContent = String(mapping[field] ?? "");
                }
            });
        } catch (err) {
            console.error("Unexpected error loading engineering summary:", err);
        }
    }

    // ---------- Operations form: read / validate / load / save ----------

    function readOpsForm() {
        return {
            opsDecision: readRadio("opsDecision") || null,
            carRaised: readRadio("carRaised") || null,
            carNumber: q("#carNumber")?.value.trim() || null,
            followReq: readRadio("followReq") || null,
            followupType: q("#followupType")?.value.trim() || null,
            followupDate: q("#followupDate")?.value || null,
            reinspectedAcceptable: readRadio("reinspectedAcceptable") || null,
            newNcrNumber: q("#newNcrNumber")?.value.trim() || null,
            opsManager: q("#opsManager")?.value.trim() || null,
            opsDate: q("#opsDate")?.value || null,
            inspectorName: q("#inspectorName")?.value.trim() || null,
            inspectorDate: q("#inspectorDate")?.value || null,
            ncrClosed: q("#ncrClosed")?.checked || false,
            qualityDeptDate: q("#qualityDeptDate")?.value || null
        };
    }

    function validateOpsForm(model) {
        clearAllErrors();
        let valid = true;

        const anyOpsDecision = q("input[name='opsDecision']");
        if (!model.opsDecision && anyOpsDecision) {
            showFieldError(anyOpsDecision, "Please select Purchasing's decision.");
            valid = false;
        } else if (anyOpsDecision) {
            clearFieldError(anyOpsDecision);
        }

        const anyCar = q("input[name='carRaised']");
        if (!model.carRaised && anyCar) {
            showFieldError(anyCar, "Please indicate if a CAR was raised.");
            valid = false;
        } else if (anyCar) {
            clearFieldError(anyCar);
        }

        if (model.carRaised === "Yes") {
            const carInput = q("#carNumber");
            if (!model.carNumber) {
                showFieldError(carInput, "Please enter the CAR number.");
                valid = false;
            } else {
                clearFieldError(carInput);
            }
        }

        const anyFollow = q("input[name='followReq']");
        if (!model.followReq && anyFollow) {
            showFieldError(anyFollow, "Please indicate if follow-up is required.");
            valid = false;
        } else if (anyFollow) {
            clearFieldError(anyFollow);
        }

        if (model.followReq === "Yes") {
            const typeEl = q("#followupType");
            const dateEl = q("#followupDate");
            if (!model.followupType) {
                showFieldError(typeEl, "Please enter the follow-up type.");
                valid = false;
            } else {
                clearFieldError(typeEl);
            }
            if (!model.followupDate) {
                showFieldError(dateEl, "Please choose the follow-up date.");
                valid = false;
            } else {
                clearFieldError(dateEl);
            }
        }

        const anyReinsp = q("input[name='reinspectedAcceptable']");
        if (!model.reinspectedAcceptable && anyReinsp) {
            showFieldError(anyReinsp, "Please indicate if the item is acceptable.");
            valid = false;
        } else if (anyReinsp) {
            clearFieldError(anyReinsp);
        }

        if (model.reinspectedAcceptable === "No") {
            const newNcrEl = q("#newNcrNumber");
            if (!model.newNcrNumber) {
                showFieldError(newNcrEl, "A new NCR number will be generated.");
                valid = false;
            } else {
                clearFieldError(newNcrEl);
            }
        }

        return valid;
    }

    async function loadOperationsForm() {
        if (!window.NCR?.auth?.client) {
            return;
        }
        const client = window.NCR.auth.client;
        const ncrId = readQueryId();
        if (!ncrId) return;

        try {
            const { data, error } = await client
                .from("ncr_operations")
                .select(
                    `
          ops_decision,
          car_raised,
          car_number,
          followup_required,
          followup_type,
          followup_date,
          reinspected_acceptable,
          new_ncr_number,
          ops_manager,
          ops_date,
          inspector_name,
          inspector_date,
          ncr_closed,
          quality_dept_date,
          status
        `
                )
                .eq("ncr_id", ncrId)
                .limit(1);

            if (error) {
                console.error("loadOperationsForm error:", error);
                return;
            }
            if (!data || !data.length) return;

            const row = data[0];

            const setRadio = (name, value) => {
                if (!value) return;
                const el = q(`input[name="${name}"][value="${value}"]`);
                if (el) el.checked = true;
            };

            setRadio("opsDecision", row.ops_decision);
            setRadio("carRaised", row.car_raised);
            setRadio("followReq", row.followup_required);
            setRadio("reinspectedAcceptable", row.reinspected_acceptable);

            if (q("#carNumber")) q("#carNumber").value = row.car_number || "";
            if (q("#followupType"))
                q("#followupType").value = row.followup_type || "";
            if (q("#followupDate"))
                q("#followupDate").value = row.followup_date
                    ? fmtDate(row.followup_date)
                    : "";
            if (q("#newNcrNumber"))
                q("#newNcrNumber").value = row.new_ncr_number || "";
            if (q("#opsManager")) q("#opsManager").value = row.ops_manager || "";
            if (q("#opsDate"))
                q("#opsDate").value = row.ops_date ? fmtDate(row.ops_date) : "";
            if (q("#inspectorName"))
                q("#inspectorName").value = row.inspector_name || "";
            if (q("#inspectorDate"))
                q("#inspectorDate").value = row.inspector_date
                    ? fmtDate(row.inspector_date)
                    : "";
            if (q("#ncrClosed")) q("#ncrClosed").checked = !!row.ncr_closed;
            if (q("#qualityDeptDate"))
                q("#qualityDeptDate").value = row.quality_dept_date
                    ? fmtDate(row.quality_dept_date)
                    : "";

            const evt = new Event("change");
            q("#carYes")?.dispatchEvent(evt);
            q("#carNo")?.dispatchEvent(evt);
            q("#followupYes")?.dispatchEvent(evt);
            q("#followupNo")?.dispatchEvent(evt);
            q("#reinspectYes")?.dispatchEvent(evt);
            q("#reinspectNo")?.dispatchEvent(evt);
        } catch (err) {
            console.error("Unexpected error loading operations:", err);
        }
    }

    // 🔒 Update/insert operations row
    async function upsertOperations(statusForRow, markClosed = false) {
        const client = window.NCR.auth.client;
        const ncrId = readQueryId();
        const m = readOpsForm();

        const payload = {
            ncr_id: Number(ncrId),
            status: statusForRow,
            ops_decision: m.opsDecision,
            car_raised: m.carRaised,
            car_number: m.carNumber,
            followup_required: m.followReq,
            followup_type: m.followupType,
            followup_date: m.followupDate || null,
            reinspected_acceptable: m.reinspectedAcceptable,
            new_ncr_number: m.newNcrNumber,
            ops_manager: m.opsManager,
            ops_date: m.opsDate || null,
            inspector_name: m.inspectorName,
            inspector_date: m.inspectorDate || null,
            ncr_closed: markClosed ? true : m.ncrClosed,
            quality_dept_date: m.qualityDeptDate || null
        };

        const { error } = await client
            .from("ncr_operations")
            .upsert(payload, { onConflict: "ncr_id", ignoreDuplicates: false });

        if (error) {
            console.error("upsertOperations error:", error);
            throw error;
        }

        return true;
    }

    // ---------- Wiring up page ----------

    document.addEventListener("DOMContentLoaded", async () => {
        // Require login
        if (!window.NCR?.auth?.requireLogin) {
            console.error("Auth module not loaded, redirecting to login.");
            window.location.href = "login.html";
            return;
        }
        const session = await window.NCR.auth.requireLogin();
        if (!session) return;
        currentSession = session;

        prefillOpsManager();

        await loadQualitySummary();
        await loadEngineeringSummary();
        await loadOperationsForm();

        // ====== Inline UI behaviour: CAR / Follow-up / New NCR ======
        const carYes = q("#carYes");
        const carNo = q("#carNo");
        const carInput = q("#carNumber");

        const followYes = q("#followupYes");
        const followNo = q("#followupNo");
        const followContainer = q("#followupContainer");
        const followType = q("#followupType");
        const followDate = q("#followupDate");

        const reinspectYes = q("#reinspectYes");
        const reinspectNo = q("#reinspectNo");
        const newNcrGroup = q("#newNcrGroup");
        const newNcrInput = q("#newNcrNumber");

        // Make new NCR field read-only always
        if (newNcrInput) {
            newNcrInput.readOnly = true;
        }

        function updateCarField() {
            if (!carInput) return;
            if (carYes && carYes.checked) {
                carInput.classList.remove("hidden-field");
            } else {
                carInput.classList.add("hidden-field");
                carInput.value = "";
            }
        }

        function updateFollowDetails() {
            if (!followContainer) return;
            if (followYes && followYes.checked) {
                followContainer.classList.remove("hidden-field");
            } else {
                followContainer.classList.add("hidden-field");
                if (followType) followType.value = "";
                if (followDate) followDate.value = "";
            }
        }

        async function updateNewNcrVisibility() {
            if (!newNcrGroup || !newNcrInput) return;

            if (reinspectNo && reinspectNo.checked) {
                newNcrGroup.classList.remove("d-none");

                // Only generate if the field is empty (so we don't overwrite a saved value)
                if (!newNcrInput.value || newNcrInput.value.trim() === "") {
                    try {
                        const uniqueNo = await generateUniqueNcrNo();
                        newNcrInput.value = uniqueNo;
                    } catch (err) {
                        console.error("Failed to generate unique NCR number:", err);
                        // leave it empty – validation will catch if needed
                    }
                }
                newNcrInput.readOnly = true;
            } else {
                newNcrGroup.classList.add("d-none");
                newNcrInput.value = "";
                newNcrInput.readOnly = true;
            }
        }

        carYes?.addEventListener("change", updateCarField);
        carNo?.addEventListener("change", updateCarField);
        followYes?.addEventListener("change", updateFollowDetails);
        followNo?.addEventListener("change", updateFollowDetails);
        reinspectYes?.addEventListener("change", () => {
            updateNewNcrVisibility();
        });
        reinspectNo?.addEventListener("change", () => {
            updateNewNcrVisibility();
        });

        updateCarField();
        updateFollowDetails();
        updateNewNcrVisibility();
        // ====== End inline UI behaviour ======

        // Save draft
        const btnSave = q("#opsBtnSave");
        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                const ok = await showConfirmModal(
                    "Save Draft?",
                    "Save your operations section as a draft?",
                    "Save Draft"
                );
                if (!ok) return;

                const prev = btnSave.innerHTML;
                btnSave.disabled = true;
                btnSave.innerHTML =
                    '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

                try {
                    await upsertOperations("draft", false);
                    showSuccessModal(
                        "Draft Saved",
                        "Your operations draft has been saved."
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

        // Review & Submit (CLOSE NCR + redirect to view-ncr)
        const btnReview = q("#opsBtnGoReview");
        if (btnReview) {
            btnReview.addEventListener("click", async (e) => {
                e.preventDefault();
                const model = readOpsForm();
                if (!validateOpsForm(model)) {
                    return;
                }

                const ok = await showConfirmModal(
                    "Close NCR?",
                    "Submitting this operations review will close the NCR.",
                    "Close NCR"
                );
                if (!ok) return;

                const prev = btnReview.innerHTML;
                btnReview.disabled = true;
                btnReview.innerHTML =
                    '<span class="spinner-border spinner-border-sm me-1"></span> Submitting…';

                try {
                    // 1) Save operations row with ncr_closed = true
                    await upsertOperations("submitted", true);

                    // 2) Close the main NCR
                    await closeNcrInOperations();

                    // 3) Notify NCR + Quality that this NCR is closed
                    const id = readQueryId();
                    await notifyNcrDeptClosed(id);

                    // 4) Go to the read-only view page
                    showSuccessModal(
                        "NCR Closed",
                        "The operations review has been recorded and this NCR is now closed.",
                        () => {
                            window.location.href = `view-ncr.html?id=${encodeURIComponent(
                                id
                            )}`;
                        }
                    );
                } catch (e2) {
                    console.error(e2);
                    showFailModal(
                        "Submit Failed",
                        e2.message || "Failed to submit operations review."
                    );
                } finally {
                    btnReview.disabled = false;
                    btnReview.innerHTML =
                        'Review &amp; Submit <i class="fa-solid fa-arrow-right-long ms-1"></i>';
                }
            });
        }

        // Sign out link
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
                if (
                    window.NCR?.auth &&
                    typeof window.NCR.auth.signOut === "function"
                ) {
                    await window.NCR.auth.signOut();
                } else {
                    window.location.href = "login.html";
                }
            });
        }
    });
})();
