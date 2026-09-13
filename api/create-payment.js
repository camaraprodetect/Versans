/* פונקציית שרת (Vercel): מקבלת סל + פרטי לקוח ומחזירה קישור לדף התשלום */
'use strict';

const { createPaymentUrl } = require('./_hyp.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (!body) body = {};

    const result = await createPaymentUrl(body);
    res.status(200).json(result);
  } catch (err) {
    console.error('create-payment failed:', err);
    res.status(err.status || 500).json({ error: err.message || 'Payment could not be started' });
  }
};
