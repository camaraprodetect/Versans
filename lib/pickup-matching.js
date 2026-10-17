'use strict';

// Locality-center proximity is only a shortlist hint; it is NEVER proof that
// two tracking IDs belong to the same parcel. No customer address is sent to
// an external geocoding service. Admin must select/confirm before dispatch.
const CITIES = [
  ['ראשון לציון',31.9710,34.7894,['ראשלצ','ראשל"צ','rishon lezion','rishon letsiyon']],
  ['חולון',32.0158,34.7738,['holon']],
  ['בת ים',32.0132,34.7480,['bat yam']],
  ['תל אביב',32.0809,34.7806,['תל אביב יפו','תל אביב-יפו','tel aviv','tel aviv yafo']],
  ['יפו',32.0500,34.7550,['jaffa','yafo']],
  ['רמת גן',32.0684,34.8248,['ramat gan']],
  ['גבעתיים',32.0697,34.8110,['givatayim']],
  ['אזור',32.0230,34.8100,['azor']],
  ['באר יעקב',31.9416,34.8350,['beer yaakov']],
  ['נס ציונה',31.9293,34.7990,['ness ziona','nes ziona']],
  ['רחובות',31.8948,34.8093,['rehovot']],
  ['רמלה',31.9280,34.8656,['ramla']],
  ['לוד',31.9510,34.8950,['lod']],
  ['יהוד',32.0331,34.8910,['yehud']],
  ['אור יהודה',32.0292,34.8592,['or yehuda']],
  ['קריית אונו',32.0643,34.8577,['קרית אונו','kiryat ono']],
  ['גני תקווה',32.0605,34.8731,['ganei tikva']],
  ['פתח תקווה',32.0871,34.8875,['פתח תקוה','petah tikva','petach tikva']],
  ['בני ברק',32.0836,34.8340,['bnei brak']],
  ['גבעת שמואל',32.0780,34.8490,['givat shmuel']],
  ['רמת השרון',32.1472,34.8392,['ramat hasharon']],
  ['הרצליה',32.1664,34.8430,['herzliya']],
  ['כפר סבא',32.1743,34.9070,['kfar saba']],
  ['הוד השרון',32.1500,34.8880,['hod hasharon']],
  ['רעננה',32.1840,34.8700,['raanana']],
  ['ראש העין',32.0956,34.9566,['rosh haayin']],
  ['שוהם',31.9960,34.9450,['shoham']],
  ['מודיעין',31.8969,35.0108,['מודיעין מכבים רעות','modiin']],
  ['נתניה',32.3215,34.8532,['netanya']],
  ['חדרה',32.4340,34.9196,['hadera']],
  ['אשדוד',31.8014,34.6435,['ashdod']],
  ['אשקלון',31.6626,34.5595,['ashkelon']],
  ['באר שבע',31.2518,34.7913,['beer sheva','beersheba']],
  ['ירושלים',31.7683,35.2137,['jerusalem']],
  ['בית שמש',31.7470,34.9880,['beit shemesh']],
  ['חיפה',32.8130,34.9993,['haifa']],
  ['קריית אתא',32.8000,35.1000,['קרית אתא']],
  ['קריית ביאליק',32.8350,35.0870,['קרית ביאליק']],
  ['קריית מוצקין',32.8380,35.0800,['קרית מוצקין']],
  ['עכו',32.9230,35.0720,['acre','akko']],
  ['נהריה',33.0050,35.0960,['nahariya']],
  ['נוף הגליל',32.7054,35.3234,['nazareth illit']],
  ['נצרת',32.7019,35.3034,['nazareth']],
  ['טבריה',32.7922,35.5312,['tiberias']],
  ['עפולה',32.6089,35.2900,['afula']],
  ['כרמיאל',32.9130,35.2960,['karmiel']],
  ['אילת',29.5577,34.9519,['eilat']]
];

function normal(value) {
  return String(value == null ? '' : value).normalize('NFKC').toLowerCase()
    .replace(/[\u200b-\u200d\u2060\ufeff]/g,'').replace(/['׳״"`]/g,'')
    .replace(/[\u05b0-\u05c7]/g,'').replace(/[.,;:()\-_/\\]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function cityFromText(value) {
  const haystack = ` ${normal(value)} `;
  if (haystack.length < 4) return null;
  let best = null;
  for (const [name,lat,lng,alternatives] of CITIES) {
    for (const alias of [name,...alternatives]) {
      const search = normal(alias);
      if (search.length < 3 || !haystack.includes(` ${search} `)) continue;
      if (!best || search.length > best.length) best = {name,lat,lng,length:search.length};
    }
  }
  return best ? {name:best.name,lat:best.lat,lng:best.lng} : null;
}
function distanceKm(a,b) {
  const deg = Math.PI/180;
  const dLat=(b.lat-a.lat)*deg, dLon=(b.lng-a.lng)*deg;
  const t=Math.sin(dLat/2)**2 + Math.cos(a.lat*deg)*Math.cos(b.lat*deg)*Math.sin(dLon/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(t)));
}
// Tracking providers are normalized to ready_for_pickup in the common case;
// handle common phrases from untranslated providers as a defensive fallback.
const READY = /(ready[_\s-]*(?:for|to)[_\s-]*(pickup|pick[_\s-]*up|collection)|available[_\s-]*for[_\s-]*(pickup|collection)|awaiting[_\s-]*(pickup|collection)|waiting[_\s-]*(at|in|for)?[_\s-]*(pickup|pick[_\s-]*up|collection)|(?:arrived|waiting|held|available)[_\s-]*(?:at|in)[_\s-]*(?:the[_\s-]*)?(?:pickup[_\s-]*point|collection[_\s-]*point|parcel[_\s-]*locker)|מוכן(?:ה)?\s*לאיסוף|ממתין(?:ה)?\s*לאיסוף|ממתין(?:ה)?\s*בנקודת\s*איסוף|זמין(?:ה)?\s*לאיסוף|נא\s*לאסוף|נקודת\s*איסוף|待取件|待自提|待领取|可取件|可领取|已到达自提点|提货点|自提点|等待领取|受取待ち|受け取り待ち|ожидает\s*получения|готов[а-я]*\s*к\s*выдаче|listo\s*para\s*recoger|pr[eê]t\s*[àa]\s*retirer|جاهز\s*للاستلام|بانتظار\s*الاستلام)/iu;
function isPickupReady(row) {
  const normalizedStatus=String(row.status||'').trim().toLowerCase();
  if (['delivered','cancelled','returned','return_to_sender'].includes(normalizedStatus)) return false;
  if (normalizedStatus === 'ready_for_pickup') return true;
  // Consider only the CURRENT provider/sub-status and latest event, never an
  // arbitrary historical pickup event after the parcel has been delivered.
  const statusText=[row.provider_status,row.sub_status,row.latest_event].filter(Boolean).join(' ');
  return READY.test(statusText);
}
function comparePickupLocation(pickupAddress, city) {
  const pickup=cityFromText(pickupAddress);
  const customer=cityFromText(city);
  if (pickup && customer) {
    const distance=distanceKm(pickup,customer);
    return {match:distance<=10,distanceKm:Math.round(distance*10)/10,confidence:'city_center_approx',pickupCity:pickup.name,customerCity:customer.name};
  }
  // For other towns that are not in the local coordinate catalog, allow only
  // an identical locality string and label the distance as unknown.
  const a=normal(pickupAddress), b=normal(city);
  if (b.length >= 3 && (` ${a} `).includes(` ${b} `)) return {match:true,distanceKm:null,confidence:'same_city_text',pickupCity:city,customerCity:city};
  return {match:false,distanceKm:null,confidence:'unresolved',pickupCity:pickup&&pickup.name||null,customerCity:customer&&customer.name||null};
}
module.exports = {cityFromText,distanceKm,isPickupReady,comparePickupLocation};
