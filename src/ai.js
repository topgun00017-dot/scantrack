// Claude API calls: receipt extraction (vision) and the assistant's tool-use loop.
// NOTE: calling the API straight from the phone with a key stored on-device is fine
// for testing in Expo Go. For a production release, route these calls through your
// own backend so the key never ships inside the app.
import { CATEGORY_KEYS, normalizeCategory } from './categories';
import { today } from './utils';
import { isWeb, capability, base64ToBlob } from './platform';

// In the web build (claude.ai artifact) Claude is reached through the viewer's own
// account via the `sample` capability, so no API key is needed there.
export async function webSample() {
  return isWeb ? capability('sample') : null;
}

function sampleError(e) {
  const c = e?.code;
  if (c === 'not_granted') return new Error('Claude access was not allowed for this page.');
  if (c === 'rate_limited') return new Error('Too many requests right now. Try again in a moment.');
  if (c === 'images_unavailable') return new Error('This view cannot send images to Claude.');
  if (c === 'invalid_json') return new Error('Could not read the receipt. Try a clearer photo.');
  return new Error(e?.message || 'Claude could not answer. Try again.');
}

const API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(settings, body) {
  if (!settings.apiKey) throw new Error('NO_KEY');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: settings.model || 'claude-sonnet-5-5', max_tokens: 2048, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `API error ${res.status}`);
  return json;
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Could not read the receipt. Try a clearer photo.');
  return JSON.parse(m[0]);
}

// ---------- 1. Scan receipts: capture every line, tax and total ----------
export async function extractReceipt(settings, base64, mimeType = 'image/jpeg') {
  const prompt = `You are a receipt-reading engine. Read this receipt image and return ONLY JSON:
{
  "merchant": string,
  "date": "YYYY-MM-DD" (use ${today()} if unreadable),
  "currency": ISO code (default "${settings.currency}"),
  "subtotal": number,
  "tax": number (SST/GST/VAT total, 0 if none),
  "total": number,
  "payment_method": string ("Cash", "Card", "E-wallet", etc., "" if unknown),
  "category": one of ${JSON.stringify(CATEGORY_KEYS)},
  "line_items": [{"description": string, "qty": number, "amount": number}],
  "confidence": "high" | "low"
}
Capture every line item. Amounts are plain numbers without currency symbols.`;

  let d;
  const sample = await webSample();
  if (sample) {
    try {
      d = await sample.json(`The attached image is a photo of a purchase receipt. ${prompt}`, { images: [base64ToBlob(base64, mimeType)] });
    } catch (e) {
      throw sampleError(e);
    }
  } else {
    const json = await callClaude(settings, {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });
    d = parseJSON(json.content.filter((c) => c.type === 'text').map((c) => c.text).join(''));
  }
  d = d || {};
  const items = (d.line_items || []).map((i) => ({
    description: String(i.description || ''),
    qty: Number(i.qty) || 1,
    amount: Number(i.amount) || 0,
  }));
  return {
    merchant: d.merchant || 'Unknown merchant',
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : today(),
    currency: d.currency || settings.currency,
    subtotal: Number(d.subtotal) || 0,
    tax: Number(d.tax) || 0,
    total: Number(d.total) || 0,
    paymentMethod: d.payment_method || '',
    category: normalizeCategory(d.category, d.merchant, items),
    lineItems: items,
    status: d.confidence === 'low' || !Number(d.total) ? 'needs_review' : 'processed',
  };
}

// ---------- 2. Assistant (find, tag, categorise, reconcile) ----------
export const AGENT_TOOLS = [
  {
    name: 'search_receipts',
    description: 'Find receipts. All filters optional. Returns id, merchant, date, total, tax, category, tags, status.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text matched against merchant, items, notes, tags' },
        category: { type: 'string', enum: CATEGORY_KEYS },
        tag: { type: 'string' },
        from: { type: 'string', description: 'YYYY-MM-DD inclusive' },
        to: { type: 'string', description: 'YYYY-MM-DD inclusive' },
        min: { type: 'number' },
        max: { type: 'number' },
      },
    },
  },
  {
    name: 'update_receipts',
    description: 'Change category, add/remove tags, or mark reviewed on one or more receipts.',
    input_schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        category: { type: 'string', enum: CATEGORY_KEYS },
        add_tags: { type: 'array', items: { type: 'string' } },
        remove_tags: { type: 'array', items: { type: 'string' } },
        mark_reviewed: { type: 'boolean' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'spending_summary',
    description: 'Totals by category for a date range.',
    input_schema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
  },
  {
    name: 'reconcile',
    description: 'Check the archive for duplicates, uncategorised receipts, missing totals, missing images and receipts needing review.',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } },
  },
];

export async function agentTurn(settings, history, runTool) {
  const system = agentSystem(settings);
  const sample = await webSample();
  if (sample) return agentTurnWeb(sample, system, history, runTool);
  let messages = [...history];
  return agentTurnAPI(settings, system, messages, runTool);
}

async function agentTurnWeb(sample, system, history, runTool) {
  const actions = [];
  const tools = AGENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
    execute: (input) => {
      const out = runTool(t.name, input || {});
      if (out?.action) actions.push(out.action);
      return out?.data ?? out;
    },
  }));
  const turns = [{ role: 'user', content: system }, ...history.map((m) => ({ role: m.role, content: String(m.content) }))];
  try {
    const { text } = await sample(turns, { tools });
    return { text: text.trim(), actions };
  } catch (e) {
    if (e?.code === 'tools_unavailable') {
      throw new Error('This view cannot run the assistant tools.');
    }
    throw sampleError(e);
  }
}

function agentSystem(settings) {
  return `You are the ScanTrack assistant inside a receipt & expense app. Today is ${today()}. Default currency ${settings.currency}.
Use the tools to find, tag, categorise and reconcile receipts. Never invent receipts or numbers; only report what tools return.
When you change data, say exactly what you changed. Keep replies short and mobile-friendly (plain text, short lists).`;
}

async function agentTurnAPI(settings, system, messages, runTool) {
  const actions = [];
  for (let step = 0; step < 6; step++) {
    const res = await callClaude(settings, { system, tools: AGENT_TOOLS, messages });
    messages = [...messages, { role: 'assistant', content: res.content }];
    const uses = res.content.filter((c) => c.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || uses.length === 0) {
      const text = res.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
      return { text, messages, actions };
    }
    const results = uses.map((u) => {
      let out;
      try {
        out = runTool(u.name, u.input || {});
        if (out?.action) actions.push(out.action);
      } catch (e) {
        out = { error: String(e.message || e) };
      }
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out?.data ?? out) };
    });
    messages = [...messages, { role: 'user', content: results }];
  }
  return { text: 'I ran out of steps on that one — try a narrower question.', messages, actions };
}
