const { getDB } = require('../db/database');

function generateOrderNumber() {
  const db = getDB();
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'order_prefix'").get()?.value || 'AYA';
  const startNum = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'order_start_number'").get()?.value || '10001');
  const last = db.prepare("SELECT order_number FROM orders ORDER BY created_at DESC LIMIT 1").get();
  if (!last) return `${prefix}-${startNum}`;
  const lastNum = parseInt(last.order_number.split('-')[1]) || startNum - 1;
  return `${prefix}-${lastNum + 1}`;
}

function buildWhatsAppMessage(order) {
  const items = JSON.parse(order.items || '[]');
  let itemsText = items.map(item => {
    const vars = Object.entries(item.variations || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    return `• ${item.name}${vars ? ` (${vars})` : ''} x${item.quantity} = ৳${item.total}`;
  }).join('\n');

  return encodeURIComponent(
    `🛍️ *New Order from AYASOFYA*\n\n` +
    `*Order ID:* ${order.order_number}\n` +
    `*Customer:* ${order.customer_name}\n` +
    `*Phone:* ${order.customer_phone}\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `*Subtotal:* ৳${order.subtotal}\n` +
    `*Delivery:* ৳${order.delivery_charge}\n` +
    `*Discount:* ৳${order.discount_amount}\n` +
    `*Total:* ৳${order.total}\n\n` +
    `*Payment:* ${order.payment_method.toUpperCase()}\n` +
    `*Address:* ${order.full_address}, ${order.thana}, ${order.district}`
  );
}

function getSetting(key) {
  const db = getDB();
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function getAllSettings(group = null) {
  const db = getDB();
  const rows = group
    ? db.prepare('SELECT key, value, type, group_name FROM settings WHERE group_name = ?').all(group)
    : db.prepare('SELECT key, value, type, group_name FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

function paginateQuery(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return { offset: (p - 1) * l, limit: l, page: p };
}

module.exports = { generateOrderNumber, buildWhatsAppMessage, getSetting, getAllSettings, paginateQuery };
