'use strict';
// One-time, PostgreSQL-only catalog insert; preserve existing/admin-edited items.
const product = require('./classic-curb-chain-product.json');
const CATALOG_KEY = 'catalog_admin_overrides_v1';

async function ensureClassicCurbChainPostgres(database) {
  if (!database || database.backend !== 'postgres') return { inserted: false, reason: 'not_postgres' };
  database._ensurePool();
  const client = await database.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [CATALOG_KEY]);
    const response = await client.query('SELECT value FROM schema_meta WHERE key = $1 FOR UPDATE', [CATALOG_KEY]);
    const raw = response.rows[0] && response.rows[0].value;
    const changes = raw ? JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) : {};
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('catalog_overrides_not_object');
    if (Object.prototype.hasOwnProperty.call(changes, product.slug)) {
      await client.query('COMMIT');
      return { inserted: false, reason: 'already_recorded', slug: product.slug };
    }
    if (Object.values(changes).some(p => p && (p.sku === product.sku || p.urlSlug === product.urlSlug || p.id === product.id))) {
      await client.query('COMMIT');
      return { inserted: false, reason: 'already_exists_other_slug', slug: product.slug };
    }
    changes[product.slug] = product;
    await client.query('INSERT INTO schema_meta (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [CATALOG_KEY, JSON.stringify(changes)]);
    await client.query('COMMIT');
    return { inserted: true, slug: product.slug };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { ensureClassicCurbChainPostgres };
