const titleMap = {
            "dashboard": "Dashboard",
            "reports": "Reports",
            "product-a": "Product A",
            "product-b": "Product B",
            "products": "Products",
            "profile": "Profile",
            "settings": "Settings",
            "new": "Create New"
        };

        const pageTitleEl = document.getElementById("pageTitle");
        const navButtons = document.querySelectorAll('[data-view]');

        function setActive(view) {
            navButtons.forEach(btn => {
                const isActive = btn.getAttribute('data-view') === view;
                // Toggle Bootstrap button styles (like your Tailwind default/ghost)
                btn.classList.toggle('btn-primary', isActive);
                btn.classList.toggle('btn-outline-secondary', !isActive);
                btn.setAttribute('aria-current', isActive ? 'page' : 'false');
            });
            if (titleMap[view]) pageTitleEl.textContent = titleMap[view];
        }

        function initFromLocation() {
            const hash = (location.hash || "#dashboard").replace("#", "");
            setActive(hash);
        }

        // Clicks on nav items should set active view + hash
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = btn.getAttribute('data-view');
                if (view) {
                    // allow normal navigation if it's a real page; if SPA-ish, update hash:
                    if (btn.getAttribute('href')?.startsWith('#')) {
                        e.preventDefault();
                        location.hash = view;
                        setActive(view);
                    }
                }
            });
        });

        window.addEventListener('hashchange', initFromLocation);
        initFromLocation();

        // Optional keyboard shortcut hint (Alt+ first letter)
        document.addEventListener('keydown', (e) => {
            if (!e.altKey) return;
            const key = e.key.toLowerCase();
            const candidate = Array.from(navButtons).find(b => {
                const view = (b.getAttribute('data-view') || "").toLowerCase();
                return view.startsWith(key);
            });
            if (candidate) candidate.click();
        });
        ();