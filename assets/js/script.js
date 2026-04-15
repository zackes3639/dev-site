console.log("Zack's builder site loaded");

(function () {
  const navbar = document.querySelector(".navbar");
  const hotbar = document.querySelector(".hotbar");
  const navContact = document.querySelector(".nav-contact");

  if (!navbar) return;

  const compactThreshold = 56;
  const hideThreshold = 112;
  const directionThreshold = 6;
  let lastScrollY = window.scrollY;

  function setCompactNavbar(isCompact) {
    navbar.classList.toggle("navbar-compact", isCompact);

    [hotbar, navContact].forEach((element) => {
      if (!element) return;

      if (isCompact) {
        element.setAttribute("aria-hidden", "true");
      } else {
        element.removeAttribute("aria-hidden");
      }
    });
  }

  function setNavbarHidden(isHidden) {
    navbar.classList.toggle("navbar-hidden", isHidden);
  }

  function syncNavbarState() {
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY;
    const isNearTop = currentScrollY <= compactThreshold;

    if (isNearTop) {
      setCompactNavbar(false);
      setNavbarHidden(false);
      lastScrollY = currentScrollY;
      return;
    }

    setCompactNavbar(true);

    if (scrollDelta > directionThreshold && currentScrollY > hideThreshold) {
      setNavbarHidden(true);
    } else if (scrollDelta < -directionThreshold) {
      setNavbarHidden(false);
    }

    lastScrollY = currentScrollY;
  }

  if (hotbar) {
    hotbar.classList.remove("hide", "closed");
    hotbar.removeAttribute("aria-hidden");
  }

  syncNavbarState();
  window.addEventListener("scroll", syncNavbarState, { passive: true });
})();