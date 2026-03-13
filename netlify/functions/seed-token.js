// One-time function: seeds the initial GHL tokens into Netlify Blobs
// Call once with POST body containing accessToken and refreshToken
// Protected by a simple secret key

import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SEED_SECRET || 'muk-seed-2026'}`) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const data = await req.json();
    if (!data.accessToken || !data.refreshToken) {
      return new Response('Need accessToken and refreshToken', { status: 400 });
    }

    const store = getStore("ghl-tokens");
    await store.setJSON("mukteshwar", {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      seededAt: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, message: 'Tokens seeded' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};
