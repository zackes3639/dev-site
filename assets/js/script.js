console.log("Zack's builder site loaded");

(function () {
  const navbar = document.querySelector(".navbar");
  const hotbar = document.querySelector(".hotbar");
  const navContact = document.querySelector(".nav-contact");
  const pageBody = document.body;

  if (!navbar) return;

  const compactEnterThreshold = 220;
  const compactExitThreshold = 24;
  const transitionDurationMs = 1080;
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

    [hotbar].forEach((element) => {
      if (!element) return;

      if (isCompact) {
        element.removeAttribute("aria-hidden");
      } else {
        element.removeAttribute("aria-hidden");
      }
    });

    if (navContact) {
      if (isCompact) {
        navContact.setAttribute("aria-hidden", "true");
      } else {
        navContact.removeAttribute("aria-hidden");
      }
    }
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

  setCompactNavbar(isCompact);
  syncNavbarState();
  window.addEventListener("scroll", syncNavbarState, { passive: true });
})();