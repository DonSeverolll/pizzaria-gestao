// Perfil da loja, horarios e mesas.
const { run, get, all } = require('../connection');
const { createDb } = require('../lifecycle');

async function getStoreSettings() {
  await createDb();
  return get('SELECT * FROM store_settings ORDER BY id DESC LIMIT 1');
}

async function saveStoreSettings(settings) {
  await createDb();
  const current = await getStoreSettings();
  const payload = {
    company_name: settings.companyName || 'PL Pizza',
    logo_url: settings.logoUrl || '/logo-pl-real.png',
    phone: settings.phone || '',
    address: settings.address || '',
    pix_key: settings.pixKey || '',
    pix_owner_name: settings.pixOwnerName || '',
    pix_city: settings.pixCity || '',
    is_open: settings.isOpen ? 1 : 0,
    delivery_fee: Number(settings.deliveryFee || 0),
    delivery_rule: settings.deliveryRule || 'fixed',
    free_delivery_min: Number(settings.freeDeliveryMin ?? 80),
  };

  const values = [
    payload.company_name,
    payload.logo_url,
    payload.phone,
    payload.address,
    payload.pix_key,
    payload.pix_owner_name,
    payload.pix_city,
    payload.is_open,
    payload.delivery_fee,
    payload.delivery_rule,
    payload.free_delivery_min,
  ];

  if (current) {
    await run(
      `UPDATE store_settings SET company_name = ?, logo_url = ?, phone = ?, address = ?, pix_key = ?, pix_owner_name = ?, pix_city = ?, is_open = ?, delivery_fee = ?, delivery_rule = ?, free_delivery_min = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, current.id]
    );
  } else {
    await run(
      `INSERT INTO store_settings (company_name, logo_url, phone, address, pix_key, pix_owner_name, pix_city, is_open, delivery_fee, delivery_rule, free_delivery_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  }

  return getStoreSettings();
}

async function getStoreHours() {
  await createDb();
  return all('SELECT * FROM store_hours ORDER BY day_of_week ASC');
}

async function saveStoreHours(hours) {
  await createDb();
  await run('DELETE FROM store_hours');

  for (const entry of hours || []) {
    await run(`INSERT INTO store_hours (day_of_week, open_time, close_time, enabled) VALUES (?, ?, ?, ?)`, [
      Number(entry.dayOfWeek),
      entry.openTime || '18:00',
      entry.closeTime || '23:00',
      entry.enabled ? 1 : 0,
    ]);
  }

  return getStoreHours();
}

async function getTables() {
  await createDb();
  return all('SELECT * FROM tables ORDER BY id ASC');
}

async function createTable({ name, capacity, status = 'available' }) {
  await createDb();
  return run(`INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)`, [name, capacity, status]);
}

async function updateTableStatus(id, status) {
  await createDb();
  return run(`UPDATE tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
}

module.exports = {
  getStoreSettings,
  saveStoreSettings,
  getStoreHours,
  saveStoreHours,
  getTables,
  createTable,
  updateTableStatus,
};
