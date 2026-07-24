console.log("Zack's builder site loaded");

(function () {
  const navbar = document.querySelector(".navbar");
  const hotbar = document.querySelector(".hotbar");
  const navContact = document.querySelector(".nav-contact");
  const pageBody = document.body;

  if (!navbar) return;

  const compactEnterThreshold = 220;
  const compactExitThreshold = 24;
  const transitionDurationMs = 360;
  let isCompact = window.scrollY > compactEnterThreshold;
  let transitionTimer;

  function triggerTransitionState() {
    pageBody.classList.add("navbar-transitioning");
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      pageBody.classList.remove("navbar-transitioning");
    }, transitionDurationMs);
  }

  function setCompactNavbar(isCompact) {
    if (navbar.classList.contains("navbar-compact") === isCompact) {
      return;
    }

    navbar.classList.toggle("navbar-compact", isCompact);
    pageBody.classList.toggle("navbar-compact-active", isCompact);
    triggerTransitionState();
  }

  function syncNavbarState() {
    const scrollY = window.scrollY;

    if (!isCompact && scrollY > compactEnterThreshold) {
      isCompact = true;
      setCompactNavbar(true);
      return;
    }

    if (isCompact && scrollY < compactExitThreshold) {
      isCompact = false;
      setCompactNavbar(false);
    }
  }

  if (hotbar) {
    hotbar.classList.remove("hide", "closed");
    hotbar.removeAttribute("aria-hidden");
  }

  // Compact mode changes only the navbar shell. Its links and CTA stay
  // available to pointer, keyboard, and assistive-technology users.
  if (navContact) navContact.removeAttribute("aria-hidden");

  setCompactNavbar(isCompact);
  syncNavbarState();
  window.addEventListener("scroll", syncNavbarState, { passive: true });
})();

/* Mobile nav drawer.
 * Builds a compact menu button + accessible drawer from the existing
 * .hotbar links and public CTA so the navbar never has to horizontally scroll
 * on small screens. Progressive enhancement: if this never runs, the original
 * .hotbar stays as the fallback nav. */
(function () {
  const navbar = document.querySelector(".navbar");
  const hotbar = document.querySelector(".hotbar");
  if (!navbar || !hotbar) return;

  const body = document.body;
  const MOBILE_MAX = 760;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "nav-drawer");

  const toggleLabel = document.createElement("span");
  toggleLabel.className = "nav-toggle-label";
  toggleLabel.textContent = "Menu";

  const toggleBars = document.createElement("span");
  toggleBars.className = "nav-toggle-bars";
  toggleBars.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i += 1) {
    toggleBars.appendChild(document.createElement("span"));
  }

  toggle.appendChild(toggleLabel);
  toggle.appendChild(toggleBars);

  const drawer = document.createElement("div");
  drawer.className = "nav-drawer";
  drawer.id = "nav-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "nav-drawer-title");
  drawer.hidden = true;

  const drawerHeader = document.createElement("div");
  drawerHeader.className = "nav-drawer-header";

  const drawerTitle = document.createElement("p");
  drawerTitle.className = "nav-drawer-title";
  drawerTitle.id = "nav-drawer-title";
  drawerTitle.textContent = "Menu";

  const drawerClose = document.createElement("button");
  drawerClose.type = "button";
  drawerClose.className = "nav-drawer-close";
  drawerClose.setAttribute("aria-label", "Close menu");
  drawerClose.textContent = "Close";

  drawerHeader.appendChild(drawerTitle);
  drawerHeader.appendChild(drawerClose);

  const list = document.createElement("nav");
  list.className = "nav-drawer-list";
  list.setAttribute("aria-label", "Primary navigation");

  hotbar.querySelectorAll("a").forEach(function (source) {
    const link = document.createElement("a");
    link.className = "nav-drawer-link";
    link.href = source.getAttribute("href");
    link.textContent = source.textContent.trim();
    if (
      source.getAttribute("aria-current") === "page" ||
      source.classList.contains("hot-btn-active")
    ) {
      link.classList.add("nav-drawer-link-active");
      link.setAttribute("aria-current", "page");
    }
    list.appendChild(link);
  });

  // Surface the Subscribe CTA inside the drawer on mobile.
  const ctaSource = document.querySelector(".nav-cta");
  if (ctaSource) {
    const cta = document.createElement("a");
    cta.className = "nav-drawer-link nav-drawer-cta";
    cta.href = ctaSource.getAttribute("href");
    cta.textContent = ctaSource.textContent.trim();
    list.appendChild(cta);
  }

  drawer.appendChild(drawerHeader);
  drawer.appendChild(list);

  const backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.hidden = true;

  navbar.appendChild(toggle);
  body.appendChild(drawer);
  body.appendChild(backdrop);
  body.classList.add("has-drawer");

  let lastFocus = null;
  let closeTimer;

  function focusables() {
    return drawer.querySelectorAll('a[href], button:not([disabled])');
  }

  function isOpen() {
    return body.classList.contains("nav-drawer-open");
  }

  function openDrawer() {
    window.clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    void drawer.offsetWidth; // force reflow so the open transition runs
    body.classList.add("nav-drawer-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-hidden", "true");
    toggle.setAttribute("tabindex", "-1");
    drawerClose.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeDrawer(restoreFocus) {
    if (!isOpen()) return;
    body.classList.remove("nav-drawer-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.removeAttribute("aria-hidden");
    toggle.removeAttribute("tabindex");
    toggle.setAttribute("aria-label", "Open menu");
    document.removeEventListener("keydown", onKeydown);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () {
      if (!isOpen()) {
        drawer.hidden = true;
        backdrop.hidden = true;
      }
    }, 240);
    if (
      restoreFocus !== false &&
      lastFocus &&
      typeof lastFocus.focus === "function"
    ) {
      lastFocus.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      closeDrawer();
      return;
    }
    if (e.key === "Tab") {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  toggle.addEventListener("click", function () {
    if (isOpen()) closeDrawer();
    else openDrawer();
  });

  drawerClose.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  list.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeDrawer();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > MOBILE_MAX) closeDrawer(false);
  });
})();
