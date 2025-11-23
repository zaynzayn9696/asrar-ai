// src/api/billing.js
import { API_BASE } from "../apiBase";

export async function createCheckoutSession() {
  const res = await fetch(`${API_BASE}/api/billing/create-checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error || body?.message || "Failed to create checkout");
    error.status = res.status;
    error.response = res;
    error.body = body;
    throw error;
  }
  return res.json(); // { url }
}
