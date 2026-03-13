// Scheduled function: refreshes GHL OAuth token every 12h
// Reads refresh_token from Blobs, refreshes, stores new tokens back
// Env vars needed: GHL_CLIENT_ID, GHL_CLIENT_SECRET (both small, fit in 4KB)

import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore("ghl-tokens");

  let stored;
  try {
    stored = await store.get("mukteshwar", { type: "json" });
  } catch (err) {
    console.error("Failed to read from Blobs:", err.message);
    return new Response("Blob read failed", { status: 500 });
  }

  if (!stored?.refreshToken) {
    console.error("No refresh token in Blobs. Run seed-token first.");
    return new Response("No refresh token", { status: 500 });
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing GHL_CLIENT_ID or GHL_CLIENT_SECRET env vars");
    return new Response("Missing credentials", { status: 500 });
  }

  try {
    const res = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Token refresh failed:", res.status, text);
      return new Response(`Refresh failed: ${res.status}`, { status: 500 });
    }

    const data = await res.json();

    await store.setJSON("mukteshwar", {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      refreshedAt: new Date().toISOString(),
    });

    console.log("Token refreshed at", new Date().toISOString());
    return new Response("OK");
  } catch (err) {
    console.error("Refresh error:", err.message);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};

export const config = {
  schedule: "@every 12h",
};
