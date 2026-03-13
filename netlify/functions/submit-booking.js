// Mukteshwar Temple Booking → GHL Contacts + Opportunities
// Each adult gets a contact + opportunity. Children stored as text on primary guest's opp.

const GHL_API = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'zd0Ap2ILf3AkM2ita9RX';
const PIPELINE_ID = 'P5JDbGjoehBLTgTP9ge5';
const STAGE_NEW_REQUEST = '86b0364d-2494-4f88-9e15-8cff9c0888d0';

// Custom field IDs
const CF = {
  // Contact fields
  gender: 'y216f4IEtdZsQYFw2i4m',
  nationality: 'iy56xAcEjv5YHxFR1osZ',
  ishaPrograms: 'Vk5IngohyTwRKrXncBJs',
  referralSource: 'agTawIG7DXvWBvI36CDU',
  relationship: 'sSjPovxKA1T1lKZY8Xkc',
  // Opportunity fields
  arrival: 'L66A6SLllDUzKGA4SdQc',
  departure: 'AdNXERkDqaJkWAjbRgvk',
  numAdults: 'MsxVxmHe5epiNlijCeFq',
  numChildren: 'nHviMt93RWSVMQsczyxf',
  childrenDetails: 'Yd4quWOkEO5ydqs2dVGk',
  bookingRef: 'rDRkeA9AMZVdnEjxzbkE',
  isPrimary: 'ltj6GB9X29ErcRAYzAos',
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
  if (!res.ok) throw new Error(`GHL ${res.status}: ${text}`);
  return JSON.parse(text);
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // GHL tokens are >5000 chars, split across 2 env vars (Netlify 5000 char limit)
  const tokenA = process.env.GHL_TOKEN_A || '';
  const tokenB = process.env.GHL_TOKEN_B || '';
  const token = tokenA + tokenB;
  if (!token) {
    console.error('GHL_TOKEN_A/B not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { arrival, departure, numAdults, numChildren, adults, children, specialNotes } = data;

  if (!adults || !adults.length || !arrival || !departure) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const bookingRef = generateBookingRef();
  const childrenText = formatChildrenDetails(children);
  const results = [];

  try {
    for (let i = 0; i < adults.length; i++) {
      const adult = adults[i];
      const isPrimary = i === 0;

      // 1. Create or update contact
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

      // Remove undefined fields
      Object.keys(contactBody).forEach(k => contactBody[k] === undefined && delete contactBody[k]);

      const contact = await ghl('/contacts/', 'POST', contactBody, token);
      const contactId = contact.contact?.id;

      if (!contactId) {
        console.error('Failed to create contact for', adult.firstName, adult.lastName, JSON.stringify(contact));
        continue;
      }

      // 2. Create opportunity
      const oppBody = {
        pipelineId: PIPELINE_ID,
        pipelineStageId: STAGE_NEW_REQUEST,
        locationId: LOCATION_ID,
        contactId,
        name: `${adult.firstName} ${adult.lastName} — ${arrival}`,
        status: 'open',
        customFields: [
          { id: CF.arrival, value: arrival },
          { id: CF.departure, value: departure },
          { id: CF.numAdults, value: String(numAdults) },
          { id: CF.numChildren, value: String(numChildren || 0) },
          { id: CF.bookingRef, value: bookingRef },
          { id: CF.isPrimary, value: isPrimary ? 'Yes' : 'No' },
        ],
      };

      // Only add children details + special notes to primary guest's opp
      if (isPrimary) {
        if (childrenText) {
          oppBody.customFields.push({ id: CF.childrenDetails, value: childrenText });
        }
        if (specialNotes) {
          // Add special notes to opp description/notes
          oppBody.name += ` [Notes: ${specialNotes.substring(0, 100)}]`;
        }
      }

      const opp = await ghl('/opportunities/', 'POST', oppBody, token);
      results.push({
        adult: `${adult.firstName} ${adult.lastName}`,
        contactId,
        oppId: opp.opportunity?.id,
        isPrimary,
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bookingRef,
        message: `Booking request submitted for ${results.length} guest(s). Reference: ${bookingRef}`,
        guests: results,
      }),
    };
  } catch (err) {
    console.error('Booking submission error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to submit booking. Please try again or contact us directly.' }),
    };
  }
};
