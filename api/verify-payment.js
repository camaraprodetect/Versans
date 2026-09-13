/* פונקציית שרת (Vercel): מאמתת מול HYP שהתשלום שחזר לדף התודה אושר באמת */
'use strict';

const { verifyPayment } = require('./_hyp.js');

module.exports = async function handler(req, res) {
  try {
    const query = req.query || {};
    const result = await verifyPayment(query);
    res.status(200).json(result);
  } catch (err) {
    console.error('verify-payment failed:', err);
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
};
