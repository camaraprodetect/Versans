'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  get17TrackInfo,
  get17TrackRealTimeInfo,
  extractTrackingUpdate
} = require('../lib/shipping.js');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

const TRACKING = 'DSVPH005510303';

function notFound17Track() {
  return {
    code: 0,
    data: {
      accepted: [{
        number: TRACKING,
        carrier: 100298,
        track_info: {
          latest_status: { status: 'NotFound', sub_status: 'NotFound_Other' },
          tracking: { providers: [] }
        }
      }]
    }
  };
}

function cainiaoHistory() {
  return {
    success: true,
    module: [{
      mailNo: TRACKING,
      mailNoSource: 'INTERNAL',
      originCountry: 'CN',
      destCountry: 'IL',
      status: 'TRANSPORT',
      statusDesc: 'In transit',
      detailList: [
        {
          actionCode: 'CC_IM_START',
          desc: 'Package handed over to customs for clearance',
          descTitle: '',
          standerdDesc: '',
          time: Date.parse('2026-09-19T13:16:11Z'),
          timeStr: '2026-09-19 16:16:11',
          timeZone: 'GMT+03:00'
        },
        {
          actionCode: 'GTMS_ACCEPT',
          desc: 'Shipment accepted by the carrier',
          descTitle: '',
          standerdDesc: '',
          time: Date.parse('2026-09-17T13:34:48Z'),
          timeStr: '2026-09-17 21:34:48',
          timeZone: 'GMT+08:00'
        }
      ]
    }]
  };
}

test('falls back to Cainiao history when 17TRACK returns NotFound', async () => {
  const originalFetch = global.fetch;
  const oldToken = process.env.VERSANS_17TRACK_API_KEY;
  const oldFallback = process.env.VERSANS_CAINIAO_FALLBACK;
  process.env.VERSANS_17TRACK_API_KEY = 'test-token';
  process.env.VERSANS_CAINIAO_FALLBACK = '1';
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('api.17track.net')) return jsonResponse(notFound17Track());
    if (String(url).includes('global.cainiao.com/global/detail.json')) return jsonResponse(cainiaoHistory());
    throw new Error('unexpected fetch ' + url);
  };

  try {
    const entry = await get17TrackInfo(TRACKING, 100298, { destinationCountry: 'IL' });
    assert.equal(entry.source, 'cainiao');
    assert.equal(entry.track_info.tracking.providers[0].provider.name, 'Cainiao / AliExpress');
    assert.equal(entry.track_info.tracking.providers[0].events.length, 2);

    const update = extractTrackingUpdate(entry);
    assert.equal(update.status, 'arrived_country');
    assert.equal(update.providerStatus, 'InTransit');
    assert.equal(update.subStatus, 'InTransit_Arrival');
    assert.equal(update.latestEvent, 'Package handed over to customs for clearance');
    assert.match(update.rawJson, /"source":"cainiao"/);
    assert.ok(calls.some((url) => url.includes('global.cainiao.com/global/detail.json')));
  } finally {
    global.fetch = originalFetch;
    if (oldToken == null) delete process.env.VERSANS_17TRACK_API_KEY; else process.env.VERSANS_17TRACK_API_KEY = oldToken;
    if (oldFallback == null) delete process.env.VERSANS_CAINIAO_FALLBACK; else process.env.VERSANS_CAINIAO_FALLBACK = oldFallback;
  }
});

test('real-time refresh also uses Cainiao fallback after empty 17TRACK responses', async () => {
  const originalFetch = global.fetch;
  const oldToken = process.env.VERSANS_17TRACK_API_KEY;
  process.env.VERSANS_17TRACK_API_KEY = 'test-token';
  global.fetch = async (url) => {
    if (String(url).includes('api.17track.net')) return jsonResponse(notFound17Track());
    if (String(url).includes('global.cainiao.com/global/detail.json')) return jsonResponse(cainiaoHistory());
    throw new Error('unexpected fetch ' + url);
  };

  try {
    const entry = await get17TrackRealTimeInfo(TRACKING, 100298, { destinationCountry: 'IL' });
    assert.equal(entry.source, 'cainiao');
    assert.equal(extractTrackingUpdate(entry).status, 'arrived_country');
  } finally {
    global.fetch = originalFetch;
    if (oldToken == null) delete process.env.VERSANS_17TRACK_API_KEY; else process.env.VERSANS_17TRACK_API_KEY = oldToken;
  }
});
