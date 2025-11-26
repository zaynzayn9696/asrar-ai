// src/api/billing.js
import { API_BASE } from "../apiBase";
import { TOKEN_KEY } from "../hooks/useAuth";

export async function createCheckoutSession() {
  // Get token from localStorage (same pattern as other authenticated API calls)
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  // Build headers with Authorization Bearer token
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}/api/billing/create-checkout`, {
    method: "POST",
    credentials: "include", // Send cookies when available
    headers,
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

export async function getSubscriptionDetails() {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/billing/subscription`, {
    method: "GET",
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error || body?.message || "Failed to load subscription");
    error.status = res.status;
    error.response = res;
    error.body = body;
    throw error;
  }
  return res.json();
}

export async function cancelSubscriptionAtPeriodEnd() {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/billing/cancel`, {
    method: "POST",
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error || body?.message || "Failed to cancel subscription");
    error.status = res.status;
    error.response = res;
    error.body = body;
    throw error;
  }
  return res.json();
}
