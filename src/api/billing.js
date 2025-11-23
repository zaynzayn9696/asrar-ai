// src/api/billing.js
import { API_BASE } from "../apiBase";

export async function createCheckoutSession() {
  const res = await fetch(`${API_BASE}/api/billing/create-checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || "Failed to create checkout");
  }
  return res.json(); // { url }
}
