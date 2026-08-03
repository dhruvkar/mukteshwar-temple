// Mukteshwar Temple Booking → GHL Contacts + Opportunities
// Each adult gets a contact + opportunity. Children stored as text on primary guest's opp.
// Token from the GHL_PRIVATE_INTEGRATION_KEY_MUKTESHWAR env var (Private Integration Token)

const GHL_API = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'dSWmgHWU494I2VfCfwqq';
const PIPELINE_ID = 'pquTLFgUZZ3vmHqVp6to';
const STAGE_NEW_REQUEST = '5d066675-3820-4c1f-8f3d-3ac18dbff57b';

const CF = {
  gender: '1lEjwPbDTq9RBKwYW9NT',
  nationality: 'E2n191lQPA6efn3Nay7n',
  ishaPrograms: 'tiyqv4CA4ft7pfnOeaHT',
  referralSource: 'plAlRc0tvLEA7k2y1a7H',
  relationship: 'hmQO9dhZ5K9I20osgljG',
  arrival: '6KIa8gSjKA4Os9kgaCt6',
  departure: 'tcElwq52alPZh0rG4qPe',
  numAdults: 'eWXkNgl0DWMlXdEw2XPV',
  numChildren: 'V04mnj2xWPa7jgBR4pl0',
  childrenDetails: 'GY9NgtWmfQC1gQMIwxO0',
  bookingRef: 'xrNAeSv6YhCVR5wZlSB7',
  isPrimary: 'kBbdgkHyvVzi3MWbcT8x',
};

async function ghl(path, method, body, token) {
  const res = await fetch(`${GHL_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = JSON.parse(text);
  if (!res.ok) {
    // Handle duplicate contact — GHL returns existing contactId in meta
    if (res.status === 400 && data.meta?.contactId) {
      return { contact: { id: data.meta.contactId }, duplicate: true };
    }
    throw new Error(`GHL ${res.status}: ${text}`);
  }
  return data;
}

function formatDateForGHL(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const mon = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  const dow = days[d.getUTCDay()];
  return `${mon} ${day}, ${year} (${dow})`;
}

function generateBookingRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MUK-${ts}-${rand}`;
}

function formatChildrenDetails(children) {
  if (!children || !children.length) return '';
  return children.map((c, i) =>
    `Child ${i + 1}: ${c.firstName} ${c.lastName} (${c.gender || 'N/A'}, DOB: ${c.dob || 'N/A'}, Relation: ${c.relationship || 'N/A'})`
  ).join('\n');
}

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // GHL Private Integration Token from env
  const token = process.env.GHL_PRIVATE_INTEGRATION_KEY_MUKTESHWAR;
  if (!token) {
    console.error('Missing GHL_PRIVATE_INTEGRATION_KEY_MUKTESHWAR env var');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { arrival, departure, numAdults, numChildren, adults, children, specialNotes } = data;

  if (!adults || !adults.length || !arrival || !departure) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
  }

  const bookingRef = generateBookingRef();
  const childrenText = formatChildrenDetails(children);
  const results = [];

  try {
    for (let i = 0; i < adults.length; i++) {
      const adult = adults[i];
      const isPrimary = i === 0;

      const contactBody = {
        locationId: LOCATION_ID,
        firstName: adult.firstName,
        lastName: adult.lastName,
        email: adult.email || undefined,
        phone: adult.mobile || undefined,
        dateOfBirth: adult.dob || undefined,
        customFields: [
          { id: CF.gender, value: adult.gender },
          { id: CF.nationality, value: adult.nationality },
          { id: CF.ishaPrograms, value: (adult.programs || []).join(', ') },
          { id: CF.referralSource, value: adult.referral },
          { id: CF.relationship, value: adult.relationship || (isPrimary ? 'Primary' : '') },
        ].filter(f => f.value),
      };

      Object.keys(contactBody).forEach(k => contactBody[k] === undefined && delete contactBody[k]);

      const contact = await ghl('/contacts/', 'POST', contactBody, token);
      const contactId = contact.contact?.id;

      if (!contactId) {
        console.error('Failed to create contact for', adult.firstName, adult.lastName, JSON.stringify(contact));
        continue;
      }

      const oppBody = {
        pipelineId: PIPELINE_ID,
        pipelineStageId: STAGE_NEW_REQUEST,
        locationId: LOCATION_ID,
        contactId,
        name: `${adult.firstName} ${adult.lastName} — ${arrival}`,
        status: 'open',
        customFields: [
          { id: CF.arrival, value: formatDateForGHL(arrival) },
          { id: CF.departure, value: formatDateForGHL(departure) },
          { id: CF.numAdults, value: String(numAdults) },
          { id: CF.numChildren, value: String(numChildren || 0) },
          { id: CF.bookingRef, value: bookingRef },
          { id: CF.isPrimary, value: isPrimary ? 'Yes' : 'No' },
        ],
      };

      if (isPrimary) {
        if (childrenText) {
          oppBody.customFields.push({ id: CF.childrenDetails, value: childrenText });
        }
        if (specialNotes) {
          oppBody.name += ` [Notes: ${specialNotes.substring(0, 100)}]`;
        }
      }

      let opp;
      try {
        opp = await ghl('/opportunities/', 'POST', oppBody, token);
      } catch (oppErr) {
        // Duplicate opportunity for this contact — search for existing one and update it
        console.log('Opp create failed, searching existing:', oppErr.message);
        const search = await ghl(`/opportunities/search?location_id=${LOCATION_ID}&contact_id=${contactId}&pipeline_id=${PIPELINE_ID}`, 'GET', null, token);
        const existing = search.opportunities?.[0];
        if (existing) {
          // Update existing opportunity with new batch/booking info
          opp = await ghl(`/opportunities/${existing.id}`, 'PUT', {
            pipelineStageId: STAGE_NEW_REQUEST,
            name: oppBody.name,
            status: 'open',
            customFields: oppBody.customFields,
          }, token);
          opp = { opportunity: { id: existing.id } };
        } else {
          console.error('Could not find or create opportunity for', contactId);
          continue;
        }
      }
      results.push({
        adult: `${adult.firstName} ${adult.lastName}`,
        contactId,
        oppId: opp.opportunity?.id,
        isPrimary,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      bookingRef,
      message: `Booking request submitted for ${results.length} guest(s). Reference: ${bookingRef}`,
      guests: results,
    }), { status: 200, headers });
  } catch (err) {
    console.error('Booking submission error:', err.message);
    return new Response(JSON.stringify({
      error: 'Failed to submit booking. Please try again or contact us directly.',
    }), { status: 500, headers });
  }
};

export const config = {
  path: "/.netlify/functions/submit-booking",
};
