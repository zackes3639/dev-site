import type { CreateDailyInputRequest } from "@briefly/contracts";

const form = document.querySelector<HTMLFormElement>("#daily-input-form");
const output = document.querySelector<HTMLElement>("#output");
const apiBase = import.meta.env.VITE_BRIEFLY_API_BASE ?? "";
const token = import.meta.env.VITE_ADMIN_BEARER_TOKEN ?? "";

if (!form || !output) {
  throw new Error("Missing required DOM nodes.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload: CreateDailyInputRequest = {
    input_date: String(formData.get("input_date") ?? ""),
    bullets: [
      String(formData.get("bullet_1") ?? ""),
      String(formData.get("bullet_2") ?? ""),
      String(formData.get("bullet_3") ?? "")
    ]
  };

  if (!apiBase) {
    output.textContent = "Set VITE_BRIEFLY_API_BASE before using the form.";
    return;
  }

  const response = await fetch(`${apiBase}/v1/daily-inputs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  output.textContent = JSON.stringify({ status: response.status, data }, null, 2);
});
