// js/ncr-notify.js
(function () {
    const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
    const SUPABASE_ANON =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

    function withApiKeyInUrl(url) {
        try {
            const u = new URL(url, location.origin);
            if (!u.searchParams.get("apikey")) {
                u.searchParams.set("apikey", SUPABASE_ANON);
            }
            return u.toString();
        } catch {
            const sep = url.includes("?") ? "&" : "?";
            return `${url}${sep}apikey=${encodeURIComponent(SUPABASE_ANON)}`;
        }
    }

    async function postJson(url, payload) {
        const finalUrl = withApiKeyInUrl(url);
        const res = await fetch(finalUrl, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON,
                Authorization: `Bearer ${SUPABASE_ANON}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const msg = await res.text().catch(() => "");
            console.warn("Notif insert error:", msg);
        }
    }

    window.NCR = window.NCR || {};
    window.NCR.createNcrNotification = async function ({
        ncrId,
        type,
        recipientRole,
        message,
        link,
    }) {
        if (!ncrId || !type || !recipientRole || !message) return;
        await postJson(`${SUPABASE_URL}/rest/v1/ncr_notifications`, {
            ncr_id: Number(ncrId),
            type,
            recipient_role: recipientRole,
            message,
            link: link || null,
            read: false,
        });
    };
})();
