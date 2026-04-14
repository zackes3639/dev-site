console.log("Zack's builder site loaded");

// Keep hotbar always visible
(function () {
  const hotbar = document.querySelector(".hotbar");
  if (!hotbar) return;

  hotbar.classList.remove("hide", "closed");
  hotbar.removeAttribute("aria-hidden");
})();