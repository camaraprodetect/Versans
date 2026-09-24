
/* VerSans -> Google Sheets order automation (V3)
 * - Keeps the full shipping address in the order block
 * - Product-level and order-level checkboxes stay in sync
 * - Uploads custom greeting PNGs / customer-uploaded photos to Google Drive only after a paid order arrives
 * - Shows both Drive links and image previews in the sheet
 * - Records selected model / packaging / variant text and an optional selection image
 */

const VERSANS_ORDERS_SHEET = 'הזמנות';
const VERSANS_WEBHOOK_SECRET = 'vrs_am5Vuf8xWNsvwnejtfF9ih67s1VdpmctcAcevNqQuWs';
const VERSANS_LEGACY_MARKER_COLUMN = 16; // P - old hidden marker
const VERSANS_MARKER_COLUMN = 17; // Q - hidden internal marker
const VERSANS_FOLDER_PROPERTY = 'VERSANS_DRIVE_FOLDER_ID';
const VERSANS_FOLDER_NAME = 'VerSans Orders Assets';

const COLOR_PENDING_TITLE = '#e6b8af';
const COLOR_PENDING_BODY = '#f4cccc';
const COLOR_SHIPPED_TITLE = '#b6d7a8';
const COLOR_SHIPPED_BODY = '#d9ead3';

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('פתח את קובץ ה-Google Sheet ואז הרץ setupSheet מתוך Apps Script שמחובר אליו.');
  PropertiesService.getScriptProperties().setProperty('VERSANS_SPREADSHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Jerusalem');
  const sheet = ensureOrdersSheet_(ss);
  sheet.activate();
  ensureDriveFolder_();
}

function clearOrdersTestData() {
  const ss = openConfiguredSpreadsheet_();
  const sheet = ensureOrdersSheet_(ss);
  sheet.clear();
  sheet.clearFormats();
  ensureOrdersSheet_(ss);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body || body.secret !== VERSANS_WEBHOOK_SECRET) return json_({ ok: false, error: 'unauthorized' });
    if (body.event !== 'paid_order' || !body.orderRef) return json_({ ok: false, error: 'invalid_payload' });

    const ss = openConfiguredSpreadsheet_();
    const sheet = ensureOrdersSheet_(ss);
    const markerPrefix = 'ORDER:' + String(body.orderRef) + '|';
    const duplicate = sheet.getRange(1, VERSANS_MARKER_COLUMN, Math.max(sheet.getMaxRows(), 1), 1)
      .createTextFinder(markerPrefix)
      .matchEntireCell(false)
      .findNext();
    if (duplicate) return json_({ ok: true, duplicate: true, orderRef: body.orderRef });

    appendOrderBlock_(sheet, body);
    SpreadsheetApp.flush();
    return json_({ ok: true, orderRef: body.orderRef });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== VERSANS_ORDERS_SHEET) return;
  if (range.getColumn() !== 1 || range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;

  const marker = String(sheet.getRange(range.getRow(), VERSANS_MARKER_COLUMN).getValue() || '');
  const orderMeta = parseOrderMarker_(marker);
  const itemMeta = parseItemMarker_(marker);

  if (orderMeta) {
    const checked = range.isChecked() === true;
    if (orderMeta.itemCount > 0) {
      sheet.getRange(orderMeta.firstItemRow, 1, orderMeta.itemCount, 1).setValues(
        Array.from({ length: orderMeta.itemCount }, () => [checked])
      );
    }
    paintOrderState_(sheet, orderMeta.titleRow, orderMeta.blockRows, orderMeta.firstItemRow, orderMeta.itemCount);
    return;
  }

  if (itemMeta) {
    const itemChecks = sheet.getRange(itemMeta.firstItemRow, 1, itemMeta.itemCount, 1).getValues();
    const allChecked = itemChecks.every((row) => row[0] === true);
    sheet.getRange(itemMeta.titleRow, 1).setValue(allChecked);
    paintOrderState_(sheet, itemMeta.titleRow, itemMeta.blockRows, itemMeta.firstItemRow, itemMeta.itemCount);
  }
}

function openConfiguredSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('VERSANS_SPREADSHEET_ID');
  if (!id) throw new Error('spreadsheet_not_configured_run_setupSheet');
  return SpreadsheetApp.openById(id);
}

function ensureDriveFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(VERSANS_FOLDER_PROPERTY);
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (_) {}
  }
  const folder = DriveApp.createFolder(VERSANS_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props.setProperty(VERSANS_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function ensureOrderFolder_(orderRef) {
  const parent = ensureDriveFolder_();
  const name = 'Order ' + String(orderRef || '').trim();
  const iterator = parent.getFoldersByName(name);
  const folder = iterator.hasNext() ? iterator.next() : parent.createFolder(name);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function ensureOrdersSheet_(ss) {
  let sheet = ss.getSheetByName(VERSANS_ORDERS_SHEET);
  if (!sheet) sheet = ss.insertSheet(VERSANS_ORDERS_SHEET);

  sheet.setRightToLeft(true);
  sheet.setFrozenRows(0);
  migrateLegacyMarkerColumn_(sheet);
  sheet.showColumns(1, 16);
  sheet.setColumnWidth(1, 76);   // checkbox
  sheet.setColumnWidth(2, 115);  // product image
  sheet.setColumnWidth(3, 260);  // name
  sheet.setColumnWidth(4, 210);  // selection text
  sheet.setColumnWidth(5, 115);  // selection image
  sheet.setColumnWidth(6, 260);  // personalization text
  sheet.setColumnWidth(7, 115);  // greeting image
  sheet.setColumnWidth(8, 170);  // greeting link
  sheet.setColumnWidth(9, 115);  // custom photo image
  sheet.setColumnWidth(10, 170); // custom photo link
  sheet.setColumnWidth(11, 70);  // qty
  sheet.setColumnWidth(12, 110); // unit price
  sheet.setColumnWidth(13, 125); // product link
  sheet.setColumnWidth(14, 155); // order date
  sheet.setColumnWidth(15, 120); // line total
  sheet.setColumnWidth(16, 235); // per-product VerSans order number
  sheet.hideColumns(VERSANS_MARKER_COLUMN);
  return sheet;
}

function migrateLegacyMarkerColumn_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const legacy = sheet.getRange(1, VERSANS_LEGACY_MARKER_COLUMN, lastRow, 1).getValues();
  const current = sheet.getRange(1, VERSANS_MARKER_COLUMN, lastRow, 1).getValues();
  let changed = false;
  legacy.forEach(function(row, index) {
    const value = String(row[0] || '');
    if (!/^(ORDER|ITEM):/.test(value)) return;
    if (!String(current[index][0] || '')) current[index][0] = value;
    legacy[index][0] = '';
    changed = true;
  });
  if (changed) {
    sheet.getRange(1, VERSANS_MARKER_COLUMN, lastRow, 1).setValues(current);
    sheet.getRange(1, VERSANS_LEGACY_MARKER_COLUMN, lastRow, 1).setValues(legacy);
  }
}

function appendOrderBlock_(sheet, order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) throw new Error('order_has_no_items');

  const customer = normalizeCustomer_(order);
  const orderFolder = ensureOrderFolder_(order.orderRef);
  const startRow = nextOrderRow_(sheet);
  const titleRow = startRow;
  const contactRow = startRow + 1;
  const addressRow = startRow + 2;
  const extraRow = startRow + 3;
  const headerRow = startRow + 4;
  const firstItemRow = startRow + 5;
  const lastItemRow = firstItemRow + items.length - 1;
  const blockRows = 5 + items.length;
  const requiredLastRow = lastItemRow + 1;

  if (sheet.getMaxRows() < requiredLastRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredLastRow - sheet.getMaxRows());
  }

  sheet.getRange(titleRow, 1).insertCheckboxes().setValue(false).setHorizontalAlignment('center');
  sheet.getRange(titleRow, 2, 1, 15).merge();
  sheet.getRange(titleRow, 2)
    .setValue('רכישה  |  ' + items.length + ' מוצרים  |  סה״כ: ' + money_(order.orderTotal, order.currency) + '  |  תאריך: ' + formatDate_(order.paidAt || order.createdAt))
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(titleRow, 38);

  const orderMarker = ['ORDER', String(order.orderRef), titleRow, blockRows, firstItemRow, items.length].join(':');
  sheet.getRange(titleRow, VERSANS_MARKER_COLUMN).setValue(orderMarker);

  writeMergedDetailRow_(sheet, contactRow,
    'שם מלא: ' + valueOrDash_(customer.fullName) +
    '  |  טלפון: ' + valueOrDash_(customer.phone) +
    '  |  אימייל: ' + valueOrDash_(customer.email));

  writeMergedDetailRow_(sheet, addressRow,
    'כתובת מלאה: ' + formatAddress_(customer) +
    '  |  מיקוד: ' + valueOrDash_(customer.zip));

  writeMergedDetailRow_(sheet, extraRow,
    'כניסה: ' + valueOrDash_(customer.entrance) +
    '  |  קומה: ' + valueOrDash_(customer.floor) +
    '  |  הערות: ' + valueOrDash_(customer.notes));

  const headers = [[
    'בוצע', 'תמונת מוצר', 'שם מוצר', 'בחירה / דגם', 'תמונת בחירה', 'פרטי התאמה אישית',
    'תמונת ברכה', 'קישור ברכה', 'תמונת לקוח', 'קישור תמונת לקוח', 'כמות', 'מחיר מוצר',
    'קישור מוצר', 'תאריך הזמנה', 'סה״כ שורה', 'מספר הזמנה'
  ]];
  sheet.getRange(headerRow, 1, 1, 16)
    .setValues(headers)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(headerRow, 34);

  const orderDate = formatDate_(order.paidAt || order.createdAt);

  items.forEach(function(item, index) {
    const row = firstItemRow + index;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = Number(item.lineTotal) || Number((unitPrice * qty).toFixed(2));
    const greetingAsset = saveOrderAsset_(orderFolder, item.greeting, item.productName, 'greeting');
    const customPhotoAsset = saveOrderAsset_(orderFolder, item.customPhoto, item.productName, 'customer-photo');
    const personalizationText = buildPersonalizationText_(item);

    sheet.getRange(row, 1).insertCheckboxes().setValue(false).setHorizontalAlignment('center');
    sheet.getRange(row, 3, 1, 13).setValues([[
      String(item.productName || item.productId || ''),
      String(item.selectionsText || ''),
      '',
      personalizationText,
      '',
      '',
      '',
      '',
      qty,
      unitPrice,
      item.productLink ? 'פתיחת קישור' : 'טרם הוגדר',
      orderDate,
      lineTotal
    ]]);

    setImageFormulaIfAny_(sheet.getRange(row, 2), String(item.imageUrl || ''));
    setImageFormulaIfAny_(sheet.getRange(row, 5), String(item.selectionImageUrl || ''));
    setImageFormulaIfAny_(sheet.getRange(row, 7), greetingAsset.previewUrl);
    setImageFormulaIfAny_(sheet.getRange(row, 9), customPhotoAsset.previewUrl);

    if (greetingAsset.driveUrl) {
      sheet.getRange(row, 8).setFormula('=HYPERLINK("' + formulaEscape_(greetingAsset.driveUrl) + '","פתיחת קובץ")');
    }
    if (customPhotoAsset.driveUrl) {
      sheet.getRange(row, 10).setFormula('=HYPERLINK("' + formulaEscape_(customPhotoAsset.driveUrl) + '","פתיחת קובץ")');
    }
    if (item.productLink) {
      sheet.getRange(row, 13).setFormula('=HYPERLINK("' + formulaEscape_(item.productLink) + '","פתיחת קישור")');
    }

    const itemOrderRef = String(item.itemOrderRef || (String(order.orderRef) + '-P' + String(index + 1).padStart(2, '0')));
    sheet.getRange(row, 16).setValue(itemOrderRef).setNumberFormat('@').setHorizontalAlignment('left');

    const itemMarker = ['ITEM', String(order.orderRef), titleRow, blockRows, firstItemRow, items.length].join(':');
    sheet.getRange(row, VERSANS_MARKER_COLUMN).setValue(itemMarker);
    sheet.getRange(row, 12).setNumberFormat('₪#,##0.00');
    sheet.getRange(row, 15).setNumberFormat('₪#,##0.00');
    sheet.getRange(row, 1, 1, 16).setVerticalAlignment('middle');
    sheet.getRange(row, 3, 1, 8).setWrap(true);
    sheet.setRowHeight(row, 104);
  });

  const block = sheet.getRange(titleRow, 1, blockRows, 16);
  block.setBorder(true, true, true, true, true, true, '#b7b7b7', SpreadsheetApp.BorderStyle.SOLID);
  paintOrderState_(sheet, titleRow, blockRows, firstItemRow, items.length);

  sheet.getRange(lastItemRow + 1, 1, 1, 16).clearFormat().clearContent();
  sheet.setRowHeight(lastItemRow + 1, 16);
}

function saveOrderAsset_(folder, asset, productName, kind) {
  const dataUrl = asset && typeof asset === 'object' ? String(asset.dataUrl || '').trim() : '';
  if (!dataUrl) return { previewUrl: '', driveUrl: '' };
  const parsed = parseImageDataUrl_(dataUrl);
  if (!parsed) return { previewUrl: '', driveUrl: '' };
  const safeFileName = sanitizeFileName_(asset.fileName || [productName, kind].filter(Boolean).join('-'));
  const blob = Utilities.newBlob(parsed.bytes, parsed.mimeType, safeFileName || 'asset.png');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  return {
    previewUrl: 'https://drive.google.com/uc?export=view&id=' + fileId,
    driveUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk'
  };
}

function parseImageDataUrl_(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), bytes: Utilities.base64Decode(match[2]) };
}

function sanitizeFileName_(value) {
  const base = String(value || 'asset').trim().replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  if (/\.(png|jpg|jpeg|webp)$/i.test(base)) return base;
  return base + '.png';
}

function setImageFormulaIfAny_(range, url) {
  const imageUrl = String(url || '').trim();
  if (!imageUrl) return;
  range.setFormula('=IMAGE("' + formulaEscape_(imageUrl) + '",4,90,90)');
}

function buildPersonalizationText_(item) {
  const parts = [];
  if (item.customName) parts.push('שם/טקסט: ' + String(item.customName).trim());
  if (item.greeting && item.greeting.textSummary) parts.push('ברכה אישית: ' + String(item.greeting.textSummary));
  if (item.customPhoto && item.customPhoto.assetId) parts.push('הועלתה תמונת לקוח ✓');
  return parts.join(' | ');
}

function writeMergedDetailRow_(sheet, row, text) {
  sheet.getRange(row, 2, 1, 15).merge();
  sheet.getRange(row, 2)
    .setValue(text)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(row, 34);
}

function paintOrderState_(sheet, titleRow, blockRows, firstItemRow, itemCount) {
  const checks = itemCount > 0 ? sheet.getRange(firstItemRow, 1, itemCount, 1).getValues() : [];
  const allChecked = itemCount > 0 && checks.every((row) => row[0] === true);
  const commonBodyRows = firstItemRow - titleRow;

  sheet.getRange(titleRow, 1, 1, 16).setBackground(allChecked ? COLOR_SHIPPED_TITLE : COLOR_PENDING_TITLE);
  if (commonBodyRows > 1) {
    sheet.getRange(titleRow + 1, 1, commonBodyRows - 1, 16).setBackground(allChecked ? COLOR_SHIPPED_BODY : COLOR_PENDING_BODY);
  }

  checks.forEach(function(rowValue, index) {
    sheet.getRange(firstItemRow + index, 1, 1, 16).setBackground(rowValue[0] === true ? COLOR_SHIPPED_BODY : COLOR_PENDING_BODY);
  });
}

function parseOrderMarker_(marker) {
  const parts = String(marker || '').split(':');
  if (parts.length !== 6 || parts[0] !== 'ORDER') return null;
  return markerParts_(parts);
}

function parseItemMarker_(marker) {
  const parts = String(marker || '').split(':');
  if (parts.length !== 6 || parts[0] !== 'ITEM') return null;
  return markerParts_(parts);
}

function markerParts_(parts) {
  const titleRow = Number(parts[2]);
  const blockRows = Number(parts[3]);
  const firstItemRow = Number(parts[4]);
  const itemCount = Number(parts[5]);
  if (!(titleRow > 0 && blockRows > 0 && firstItemRow > 0 && itemCount > 0)) return null;
  return { titleRow, blockRows, firstItemRow, itemCount };
}

function normalizeCustomer_(order) {
  const c = order && order.customer && typeof order.customer === 'object' ? order.customer : {};
  const firstName = String(c.firstName || '').trim();
  const lastName = String(c.lastName || '').trim();
  return {
    firstName,
    lastName,
    fullName: String(c.fullName || [firstName, lastName].filter(Boolean).join(' ')).trim(),
    email: String(c.email || order.customerEmail || '').trim(),
    phone: String(c.phone || order.customerPhone || '').trim(),
    country: String(c.country || '').trim(),
    city: String(c.city || '').trim(),
    street: String(c.street || '').trim(),
    houseNumber: String(c.houseNumber || '').trim(),
    apartment: String(c.apartment || '').trim(),
    entrance: String(c.entrance || '').trim(),
    floor: String(c.floor || '').trim(),
    zip: String(c.zip || '').trim(),
    notes: String(c.notes || '').trim()
  };
}

function formatAddress_(customer) {
  const street = [customer.street, customer.houseNumber].filter(Boolean).join(' ');
  const apartment = customer.apartment ? 'דירה ' + customer.apartment : '';
  return [customer.country, customer.city, street, apartment].filter(Boolean).join(', ') || '-';
}

function valueOrDash_(value) {
  const text = String(value == null ? '' : value).trim();
  return text || '-';
}

function nextOrderRow_(sheet) {
  const last = sheet.getLastRow();
  return last > 0 ? last + 2 : 1;
}

function formatDate_(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');
}

function money_(amount, currency) {
  const value = Number(amount) || 0;
  const symbol = String(currency || 'ILS').toUpperCase() === 'ILS' ? '₪' : String(currency || '');
  return symbol + value.toFixed(2);
}

function formulaEscape_(value) {
  return String(value || '').replace(/"/g, '""');
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
