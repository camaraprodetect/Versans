'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeTrackingNumber,
  get17TrackRealTimeInfo,
  trackingDiagnosticsFromRaw
} = require('../lib/shipping.js');

function acceptedPayload(number, carrier) {
  return {
    code: 0,
    data: {
      accepted: [{
        number,
        carrier,
        track_info: {
          latest_status: { status: 'InTransit', sub_status: 'InTransit_PickedUp' },
          latest_event: {
            time_utc: '2026-09-23T01:00:00Z',
            description: 'Shipment picked up',
            location: 'Shenzhen'
          },
          tracking: {
            providers: [{
              provider: { key: carrier, name: 'Test Carrier', homepage: 'https://carrier.example', country: 'CN' },
              service_type: 'Tracked Parcel',
              latest_sync_status: 'Success',
              latest_sync_time: '2026-09-23T01:01:00Z',
              provider_tips: null,
              events: []
            }]
          }
        }
      }],
      rejected: []
    }
  };
}

async function withMockFetch(fn) {
  const originalFetch = global.fetch;
  const originalKey = process.env.VERSANS_17TRACK_API_KEY;
  const calls = [];
  process.env.VERSANS_17TRACK_API_KEY = 'test-key';
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    return { ok: true, status: 200, json: async () => acceptedPayload(body[0].number, body[0].carrier || 3011) };
  };
  try { return await fn(calls); }
  finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.VERSANS_17TRACK_API_KEY;
    else process.env.VERSANS_17TRACK_API_KEY = originalKey;
  }
}

test('17TRACK Standard refresh sends the v2.4 literal cacheLevel', async () => {
  await withMockFetch(async (calls) => {
    const result = await get17TrackRealTimeInfo('RR123456789CN', 3011, { instant: false, skipAutoCarrierFallback: true });
    assert.equal(result.number, 'RR123456789CN');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body[0].cacheLevel, 'Standard');
  });
});

test('17TRACK Instant refresh is explicit and sends Instant', async () => {
  await withMockFetch(async (calls) => {
    await get17TrackRealTimeInfo('RR123456789CN', 3011, { instant: true, skipAutoCarrierFallback: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body[0].cacheLevel, 'Instant');
  });
});

test('tracking number normalization follows 17TRACK 50 character maximum', () => {
  assert.equal(normalizeTrackingNumber(' A B-C '), 'AB-C');
  assert.equal(normalizeTrackingNumber('A'.repeat(70)).length, 50);
});

test('raw 17TRACK diagnostics expose provider sync and last-mile information', () => {
  const raw = JSON.stringify({
    number: 'RR123456789CN',
    carrier: 3011,
    local_number: 'LOCAL123',
    local_provider: 'Israel Post',
    local_key: 3011,
    track_info: {
      tracking: {
        providers: [{
          provider: { key: 3011, name: 'China Post', homepage: 'https://example.test', country: 'CN' },
          service_type: 'Registered Mail',
          latest_sync_status: 'Success',
          latest_sync_time: '2026-09-23T01:00:00Z',
          provider_tips: 'Carrier notice',
          events: [{ description: 'one' }]
        }]
      }
    }
  });
  const diagnostics = trackingDiagnosticsFromRaw(raw, 3011);
  assert.equal(diagnostics.providerName, 'China Post');
  assert.equal(diagnostics.syncStatus, 'Success');
  assert.equal(diagnostics.serviceType, 'Registered Mail');
  assert.equal(diagnostics.providerTip, 'Carrier notice');
  assert.equal(diagnostics.localTrackingNumber, 'LOCAL123');
});

test('storefront keeps the VerSans WhatsApp support number configured', () => {
  const root = path.resolve(__dirname, '..');
  const config = fs.readFileSync(path.join(root, 'assets/config.js'), 'utf8');
  const customerService = fs.readFileSync(path.join(root, 'assets/customer-service.js'), 'utf8');
  assert.equal(config.includes("whatsapp: '972553026389'") || config.includes("whatsapp:  '972553026389'"), true, 'Current WhatsApp support number must stay configured');
  assert.equal(customerService.includes("'https://wa.me/' + number"), true, 'WhatsApp support link must keep using the configured number');
  assert.equal(customerService.includes('injectFooterLink()'), true, 'Footer WhatsApp support entry must stay enabled');
  assert.equal(customerService.includes('createFloatingBubble()'), true, 'Floating WhatsApp support bubble must stay enabled');
});

test('admin includes standalone 17TRACK lookup that does not require an order', () => {
  const root = path.resolve(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'assets/admin.js'), 'utf8');
  assert.equal(server.includes("pathname === '/api/admin/tracking/lookup'"), true);
  assert.equal(server.includes('linkedToOrder: false'), true);
  assert.equal(server.includes('persisted: false'), true);
  assert.equal(admin.includes('בדיקת 17TRACK ללא הזמנה'), true);
  assert.equal(admin.includes('לא שומרת חבילה ולא מחברת אותה ללקוח'), true);
});
