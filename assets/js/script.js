console.log("Zack's builder site loaded");

(function () {
  const navbar = document.querySelector(".navbar");
  const hotbar = document.querySelector(".hotbar");
  const navContact = document.querySelector(".nav-contact");

  if (!navbar) return;

  const compactThreshold = 36;

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

  function syncNavbarState() {
    setCompactNavbar(window.scrollY > compactThreshold);
  }

  if (!hotbar) return;

  hotbar.classList.remove("hide", "closed");
  hotbar.removeAttribute("aria-hidden");

  syncNavbarState();
  window.addEventListener("scroll", syncNavbarState, { passive: true });
})();