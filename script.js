console.log("Zack's builder site loaded");

// Keep hotbar always visible (no hide, no close, no state issues)
(function () {
  const hotbar = document.querySelector(".hotbar");
  if (!hotbar) return;

  // Force visible state
  hotbar.classList.remove("hide", "closed");
  hotbar.removeAttribute("aria-hidden");
})();