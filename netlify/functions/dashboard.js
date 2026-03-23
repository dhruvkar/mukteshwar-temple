// Mukteshwar Temple — Batch Dashboard
// Real-time view of all batches, headcounts, and guest details
// Pulls live from GHL API on every page load

import { getStore } from "@netlify/blobs";

const GHL_API = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'zd0Ap2ILf3AkM2ita9RX';
const PIPELINE_ID = 'P5JDbGjoehBLTgTP9ge5';
const BATCH_CAP = 30;

// Custom field IDs
const CF = {
  arrival: 'L66A6SLllDUzKGA4SdQc',
  departure: 'AdNXERkDqaJkWAjbRgvk',
  numAdults: 'MsxVxmHe5epiNlijCeFq',
  numChildren: 'nHviMt93RWSVMQsczyxf',
  childrenDetails: 'Yd4quWOkEO5ydqs2dVGk',
  bookingRef: 'rDRkeA9AMZVdnEjxzbkE',
  isPrimary: 'ltj6GB9X29ErcRAYzAos',
  gender: 'y216f4IEtdZsQYFw2i4m',
};

// 2026 Batch schedule: [arrival, departure] pairs grouped by month
// Each month can have 2 batches (Batch 1, Batch 2)
const BATCH_SCHEDULE = [
  { arrival: '2026-04-23', departure: '2026-04-26', label: 'April Batch 1' },
  { arrival: '2026-04-27', departure: '2026-04-30', label: 'April Batch 2' },
  { arrival: '2026-05-22', departure: '2026-05-25', label: 'May Batch 1' },
  { arrival: '2026-05-28', departure: '2026-05-31', label: 'May Batch 2' },
  { arrival: '2026-06-19', departure: '2026-06-22', label: 'June Batch 1' },
  { arrival: '2026-06-24', departure: '2026-06-27', label: 'June Batch 2' },
  { arrival: '2026-07-24', departure: '2026-07-27', label: 'July Batch 1' },
  { arrival: '2026-07-30', departure: '2026-08-02', label: 'July Batch 2' },
  { arrival: '2026-08-21', departure: '2026-08-24', label: 'August Batch 1' },
  { arrival: '2026-08-28', departure: '2026-08-31', label: 'August Batch 2' },
  { arrival: '2026-09-18', departure: '2026-09-21', label: 'September Batch 1' },
  { arrival: '2026-10-03', departure: '2026-10-06', label: 'October Batch 1' },
  { arrival: '2026-10-23', departure: '2026-10-26', label: 'October Batch 2' },
  { arrival: '2026-11-20', departure: '2026-11-23', label: 'November Batch 1' },
  { arrival: '2026-11-27', departure: '2026-11-30', label: 'November Batch 2' },
  { arrival: '2026-12-20', departure: '2026-12-23', label: 'December Batch 1' },
  { arrival: '2026-12-27', departure: '2026-12-30', label: 'December Batch 2' },
];

// Pipeline stages
const STAGES = {
  '86b0364d-2494-4f88-9e15-8cff9c0888d0': { name: 'New Request', color: '#f59e0b', icon: '🆕' },
  '0da1ffaf-e62f-4560-9107-1cec50571b31': { name: 'Under Review', color: '#3b82f6', icon: '🔍' },
  'e1ccf89d-aa6e-4ad6-8888-319a69724e01': { name: 'Approved', color: '#10b981', icon: '✅' },
  '92a9d8e9-1fe9-4657-95bd-a4765bda04f6': { name: 'Waitlisted', color: '#8b5cf6', icon: '⏳' },
  '269e08c7-fcff-42d0-a025-7036a3e11177': { name: 'Rejected', color: '#ef4444', icon: '❌' },
};

async function ghlGet(path, token) {
  const res = await fetch(`${GHL_API}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': '2021-07-28',
    },
  });
  if (!res.ok) throw new Error(`GHL ${res.status}: ${await res.text()}`);
  return res.json();
}

function getCF(customFields, cfId) {
  const f = customFields?.find(c => c.id === cfId);
  return f?.fieldValueString || f?.value || '';
}

function parseArrivalDate(val) {
  // Handle both "Apr 23, 2026 (Wed)" and "2026-04-23" formats
  if (!val) return null;
  if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(val + 'T00:00:00Z');
  const clean = val.replace(/\s*\(.*\)/, '');
  const d = new Date(clean);
  return isNaN(d) ? null : d;
}

function formatDate(d) {
  if (!d) return '?';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} (${days[d.getUTCDay()]})`;
}

function toISODate(d) {
  if (!d) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function getBatchLabel(arrivalDate) {
  if (!arrivalDate) return null;
  const iso = toISODate(arrivalDate);
  const match = BATCH_SCHEDULE.find(b => b.arrival === iso);
  return match ? match.label : null;
}

function batchKey(arrival, departure) {
  return `${arrival || '?'}|${departure || '?'}`;
}

export default async (req) => {
  // Simple auth via query param
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (key !== process.env.DASHBOARD_KEY) {
    return new Response('🔒 Access denied', { status: 401, headers: { 'Content-Type': 'text/plain' } });
  }

  // Get GHL token
  let token;
  try {
    const store = getStore("ghl-tokens");
    const stored = await store.get("mukteshwar", { type: "json" });
    token = stored?.accessToken;
    if (!token) throw new Error("No token");
  } catch (err) {
    return new Response(`Token error: ${err.message}`, { status: 500 });
  }

  // Fetch all opportunities (paginate if needed)
  let allOpps = [];
  let startAfterId = '';
  let hasMore = true;

  while (hasMore) {
    const searchUrl = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${PIPELINE_ID}&limit=100${startAfterId ? `&startAfterId=${startAfterId}` : ''}`;
    const data = await ghlGet(searchUrl, token);
    const opps = data.opportunities || [];
    allOpps = allOpps.concat(opps);

    if (opps.length < 100) {
      hasMore = false;
    } else {
      startAfterId = opps[opps.length - 1].id;
    }
  }

  // Fetch contact details for gender (batch all unique contact IDs)
  const contactIds = [...new Set(allOpps.map(o => o.contactId).filter(Boolean))];
  const contactMap = {};
  for (const cid of contactIds) {
    try {
      const cdata = await ghlGet(`/contacts/${cid}`, token);
      const c = cdata.contact || {};
      const cfs = c.customFields || [];
      const genderCf = cfs.find(f => f.id === CF.gender);
      contactMap[cid] = {
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        email: c.email || '',
        phone: c.phone || '',
        gender: genderCf?.value || genderCf?.fieldValueString || '?',
      };
    } catch {
      contactMap[cid] = { name: '?', gender: '?', email: '', phone: '' };
    }
  }

  // Group by batch (arrival+departure)
  const batches = {};

  for (const opp of allOpps) {
    if (opp.status === 'lost' || opp.status === 'abandoned') continue;

    const cfs = opp.customFields || [];
    const arrivalRaw = getCF(cfs, CF.arrival);
    const departureRaw = getCF(cfs, CF.departure);
    const arrival = parseArrivalDate(arrivalRaw);
    const departure = parseArrivalDate(departureRaw);
    const key = batchKey(arrivalRaw, departureRaw);

    if (!batches[key]) {
      const label = getBatchLabel(arrival);
      batches[key] = {
        arrival,
        arrivalStr: formatDate(arrival),
        departure,
        departureStr: formatDate(departure),
        label: label || `${formatDate(arrival)} batch`,
        guests: [],
        childrenCount: 0,
        childrenDetails: [],
      };
    }

    const contact = contactMap[opp.contactId] || { name: '?', gender: '?' };
    const stage = STAGES[opp.pipelineStageId] || { name: '?', color: '#666', icon: '❓' };
    const isPrimary = getCF(cfs, CF.isPrimary) === 'Yes';
    const childCount = parseInt(getCF(cfs, CF.numChildren) || '0') || 0;
    const childDetails = getCF(cfs, CF.childrenDetails);

    batches[key].guests.push({
      name: contact.name,
      gender: contact.gender,
      email: contact.email,
      phone: contact.phone,
      stage,
      isPrimary,
      bookingRef: getCF(cfs, CF.bookingRef),
      oppId: opp.id,
    });

    if (isPrimary && childCount > 0) {
      batches[key].childrenCount += childCount;
      if (childDetails) {
        batches[key].childrenDetails.push(childDetails);
      }
    }
  }

  // Sort batches by arrival date
  const sortedBatches = Object.values(batches).sort((a, b) => {
    if (!a.arrival) return 1;
    if (!b.arrival) return -1;
    return a.arrival - b.arrival;
  });

  const now = new Date();

  // Render HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mukteshwar — Batch Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8f6f3;
      color: #2d2a26;
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-family: 'Georgia', serif;
      font-size: 1.6rem;
      color: #5c4a3a;
      margin-bottom: 0.3rem;
    }
    .subtitle {
      color: #8a7968;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .batch {
      background: white;
      border-radius: 12px;
      padding: 1.2rem 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border-left: 4px solid #c9a96e;
    }
    .batch.past {
      opacity: 0.5;
      border-left-color: #ccc;
    }
    .batch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.8rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .batch-dates {
      font-weight: 600;
      font-size: 1.1rem;
      color: #5c4a3a;
    }
    .batch-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #666;
    }
    .stat { display: flex; align-items: center; gap: 0.3rem; }
    .capacity-bar {
      width: 100%;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      margin-bottom: 0.8rem;
      overflow: hidden;
    }
    .capacity-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .fill-green { background: #10b981; }
    .fill-yellow { background: #f59e0b; }
    .fill-red { background: #ef4444; }
    .guest-list { list-style: none; }
    .guest {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0;
      font-size: 0.9rem;
      border-bottom: 1px solid #f0ece7;
    }
    .guest:last-child { border-bottom: none; }
    .guest-name { flex: 1; }
    .badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-weight: 500;
      white-space: nowrap;
    }
    .gender-icon { font-size: 0.85rem; }
    .children-note {
      margin-top: 0.5rem;
      padding: 0.5rem 0.8rem;
      background: #fef9ef;
      border-radius: 6px;
      font-size: 0.82rem;
      color: #8a7968;
    }
    .spots-remaining {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .spots-ok { color: #10b981; }
    .spots-low { color: #f59e0b; }
    .spots-full { color: #ef4444; }
    .empty-state {
      text-align: center;
      color: #aaa;
      padding: 3rem;
      font-style: italic;
    }
    .refresh-note {
      text-align: center;
      color: #bbb;
      font-size: 0.75rem;
      margin-top: 1.5rem;
    }
    @media (max-width: 600px) {
      body { padding: 1rem; }
      .batch { padding: 1rem; }
      .batch-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <h1>🙏 Mukteshwar Batch Dashboard</h1>
  <p class="subtitle">Live data from GHL — ${allOpps.length} guest record${allOpps.length !== 1 ? 's' : ''} across ${sortedBatches.length} batch${sortedBatches.length !== 1 ? 'es' : ''}</p>

  ${sortedBatches.length === 0 ? '<div class="empty-state">No bookings yet</div>' : ''}

  ${sortedBatches.map(batch => {
    const isPast = batch.departure && batch.departure < now;
    const adultCount = batch.guests.length;
    const totalHeadcount = adultCount + batch.childrenCount;
    const spotsLeft = BATCH_CAP - totalHeadcount;
    const pct = Math.min(100, Math.round((totalHeadcount / BATCH_CAP) * 100));
    const fillClass = pct >= 90 ? 'fill-red' : pct >= 60 ? 'fill-yellow' : 'fill-green';
    const spotsClass = spotsLeft <= 0 ? 'spots-full' : spotsLeft <= 5 ? 'spots-low' : 'spots-ok';

    const males = batch.guests.filter(g => g.gender === 'Male').length;
    const females = batch.guests.filter(g => g.gender === 'Female').length;

    return `
    <div class="batch ${isPast ? 'past' : ''}">
      <div class="batch-header">
        <div class="batch-dates">${batch.label}<span style="font-weight:400;font-size:0.85rem;color:#8a7968;margin-left:0.5rem">${batch.arrivalStr} → ${batch.departureStr}</span></div>
        <div class="batch-stats">
          <span class="stat">👤 ${adultCount} adult${adultCount !== 1 ? 's' : ''}</span>
          ${batch.childrenCount > 0 ? `<span class="stat">👶 ${batch.childrenCount} child${batch.childrenCount !== 1 ? 'ren' : ''}</span>` : ''}
          <span class="stat">${males > 0 ? `♂${males}` : ''} ${females > 0 ? `♀${females}` : ''}</span>
          <span class="spots-remaining ${spotsClass}">${spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'FULL'}</span>
        </div>
      </div>
      <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
      <ul class="guest-list">
        ${batch.guests.map(g => `
          <li class="guest">
            <span class="gender-icon">${g.gender === 'Male' ? '♂' : g.gender === 'Female' ? '♀' : '?'}</span>
            <span class="guest-name">${g.name}${g.isPrimary ? ' ⭐' : ''}</span>
            <span class="badge" style="background:${g.stage.color}20;color:${g.stage.color}">${g.stage.icon} ${g.stage.name}</span>
          </li>
        `).join('')}
      </ul>
      ${batch.childrenDetails.length > 0 ? `
        <div class="children-note">
          <strong>Children:</strong><br>${batch.childrenDetails.join('<br>')}
        </div>
      ` : ''}
    </div>`;
  }).join('')}

  <p class="refresh-note">Last refreshed: ${now.toISOString().replace('T', ' ').substring(0, 19)} UTC — Reload page for latest data</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

export const config = {
  path: "/dashboard",
};
