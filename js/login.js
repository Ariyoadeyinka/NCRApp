(function () {
    const SUPABASE_URL = "https://iijnoqzobocnoqxzgcdy.supabase.co";
    const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpam5vcXpvYm9jbm9xeHpnY2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MTQyODgsImV4cCI6MjA3NTE5MDI4OH0.QL4Ayy5pMcstbmdO4lFsoLP9Qo9KlYemn7FDWPwAHLU";

    if (!window.supabase) {
        console.error("Supabase JS not loaded. Check the <script> tag.");
        return;
    }

    const { createClient } = window.supabase;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    async function loadAndStoreRoles(profileId) {
        try {
            const { data, error } = await client
                .from("profile_roles")
                .select("roles(code)")
                .eq("profile_id", profileId);

            if (error) {
                console.error("Error loading roles:", error);
                localStorage.removeItem("cf_roles");
                localStorage.removeItem("cf_role");
                return;
            }

            const codes = Array.from(
                new Set(
                    (data || [])
                        .map((row) => row.roles && row.roles.code && row.roles.code.toLowerCase())
                        .filter(Boolean)
                )
            );

            localStorage.setItem("cf_roles", JSON.stringify(codes));

            const priority = ["admin", "engineering", "quality", "operations"];
            const primary =
                priority.find((r) => codes.includes(r)) || (codes[0] || "");
            localStorage.setItem("cf_role", primary);

            console.log("User roles loaded:", codes, "primary:", primary);
        } catch (err) {
            console.error("Unexpected error loading roles:", err);
            localStorage.removeItem("cf_roles");
            localStorage.removeItem("cf_role");
        }
    }

    window.NCR = window.NCR || {};
    window.NCR.auth = {
        client,

        async getSession() {
            const { data, error } = await client.auth.getSession();
            if (error) {
                console.error("getSession error:", error);
                return null;
            }
            return data.session || null;
        },

        async requireLogin() {
            const { data, error } = await client.auth.getSession();
            if (error) {
                console.error("requireLogin error:", error);
            }

            if (data && data.session) {
                return data.session;
            }

            const path = window.location.pathname.toLowerCase();
            if (!path.includes("login")) {
                const params = new URLSearchParams();
                params.set("redirect", window.location.href);
                window.location.href = `index.html?${params.toString()}`;
            }

            return null;
        },

        async signOut() {
            try {
                await client.auth.signOut();
            } catch (err) {
                console.error("signOut error:", err);
            } finally {
                localStorage.removeItem("cf_roles");
                localStorage.removeItem("cf_role");
                window.location.href = "index.html";
            }
        },
    };

    document.addEventListener("DOMContentLoaded", function () {
        const form = document.querySelector(".auth-form");
        const params = new URLSearchParams(window.location.search);
        const hasRedirectParam = params.has("redirect");

        const signOutLink = document.querySelector('a[href="#logout"]');
        if (signOutLink) {
            signOutLink.addEventListener("click", async (event) => {
                event.preventDefault();
                const ok = confirm("Sign out of Crossfire NCR?");
                if (!ok) return;

                if (
                    window.NCR &&
                    window.NCR.auth &&
                    typeof window.NCR.auth.signOut === "function"
                ) {
                    await window.NCR.auth.signOut();
                } else {
                    window.location.href = "index.html";
                }
            });
        }

        if (!form) {
            (async () => {
                const session = await window.NCR.auth.requireLogin();
                if (!session) return;

                await loadAndStoreRoles(session.user.id);
            })();
            return;
        }


        if (hasRedirectParam) {
            window.NCR.auth.getSession().then(async (session) => {
                if (session) {
                    await loadAndStoreRoles(session.user.id);
                    const redirect = params.get("redirect") || "dashboard.html";
                    window.location.href = redirect;
                }
            });
        }

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const submitBtn = form.querySelector(".btn-primary");
        const toggleBtn = document.querySelector(".password-toggle");
        const forgotBtn = document.querySelector(".link-button");

        let errorBox = document.getElementById("auth-error");
        if (!errorBox) {
            errorBox = document.createElement("div");
            errorBox.id = "auth-error";
            errorBox.className = "auth-error";
            errorBox.style.marginTop = "0.75rem";
            errorBox.style.color = "#f97373";
            errorBox.style.fontSize = "0.85rem";
            form.appendChild(errorBox);
        }

        if (toggleBtn && passwordInput) {
            toggleBtn.addEventListener("click", () => {
                const isPassword = passwordInput.type === "password";
                passwordInput.type = isPassword ? "text" : "password";
                toggleBtn.setAttribute(
                    "aria-label",
                    isPassword ? "Hide password" : "Show password"
                );
            });
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            errorBox.style.color = "#f97373";
            errorBox.textContent = "";

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                errorBox.textContent = "Please enter your email and password.";
                return;
            }

            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Signing in...";

            try {
                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    console.error("Login error:", error);
                    errorBox.textContent = error.message || "Unable to sign in.";
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    return;
                }

                if (data && data.user) {
                    await loadAndStoreRoles(data.user.id);
                }

                const redirect = params.get("redirect") || "dashboard.html";
                window.location.href = redirect;
            } catch (err) {
                console.error("Unexpected login error:", err);
                errorBox.textContent = "Something went wrong. Please try again.";
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });

        if (forgotBtn) {
            forgotBtn.addEventListener("click", async () => {
                const email = emailInput.value.trim();
                if (!email) {
                    errorBox.style.color = "#f97373";
                    errorBox.textContent = "Enter your email first to reset password.";
                    return;
                }

                errorBox.textContent = "";
                forgotBtn.disabled = true;
                const originalText = forgotBtn.textContent;
                forgotBtn.textContent = "Sending reset link...";

                try {
                    const { error } = await client.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + "/reset-password.html",
                    });

                    if (error) {
                        console.error("Reset password error:", error);
                        errorBox.style.color = "#f97373";
                        errorBox.textContent =
                            error.message || "Could not send reset instructions.";
                    } else {
                        errorBox.style.color = "#4ade80";
                        errorBox.textContent = "Reset email sent. Check your inbox.";
                    }
                } catch (err) {
                    console.error("Unexpected reset error:", err);
                    errorBox.style.color = "#f97373";
                    errorBox.textContent = "Something went wrong. Please try again.";
                } finally {
                    forgotBtn.disabled = false;
                    forgotBtn.textContent = originalText;
                }
            });
        }
    });
})();
