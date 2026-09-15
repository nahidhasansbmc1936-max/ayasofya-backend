const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth, customerAuth, optionalCustomerAuth } = require('../middleware/auth');
const { generateOrderNumber, buildWhatsAppMessage, getSetting, paginateQuery } = require('../utils/helpers');

router.post('/', optionalCustomerAuth, (req, res) => {
  const db = getDB();
  const { customer_name, customer_phone, customer_email, district, thana, area, full_address, order_note, items, coupon_code, payment_method = 'cod', delivery_type = 'outside' } = req.body;
  if (!customer_name || !customer_phone || !district || !thana || !full_address || !items?.length) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  let subtotal = 0;
  const enrichedItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_published = 1').get(item.product_id);
    if (!product) return res.status(400).json({ error: `Product not found: ${item.product_id}` });
    const price = product.sale_price || product.regular_price;
    const itemTotal = price * item.quantity;
    subtotal += itemTotal;
    enrichedItems.push({ product_id: product.id, name: product.name, sku: product.sku, image: JSON.parse(product.images || '[]')[0] || '', price, quantity: item.quantity, total: itemTotal, variations: item.variations || {} });
  }
  const insideDhaka = parseFloat(getSetting('delivery_inside_dhaka') || '60');
  const outsideDhaka = parseFloat(getSetting('delivery_outside_dhaka') || '120');
  const freeAbove = parseFloat(getSetting('free_delivery_above') || '2000');
  let delivery_charge = delivery_type === 'inside' ? insideDhaka : outsideDhaka;
  if (subtotal >= freeAbove) delivery_charge = 0;
  let discount_amount = 0;
  let validCoupon = null;
  if (coupon_code) {
    const coupon = db.prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expiry_date IS NULL OR expiry_date >= date('now')) AND (start_date IS NULL OR start_date <= date('now'))`).get(coupon_code.toUpperCase());
    if (coupon && subtotal >= (coupon.minimum_order || 0) && (!coupon.usage_limit || coupon.used_count < coupon.usage_limit)) {
      discount_amount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
      if (coupon.maximum_discount) discount_amount = Math.min(discount_amount, coupon.maximum_discount);
      validCoupon = coupon;
    }
  }
  const total = Math.max(0, subtotal - discount_amount + delivery_charge);
  const orderId = uuidv4();
  const orderNumber = generateOrderNumber();
  db.prepare(`INSERT INTO orders (id,order_number,customer_id,customer_name,customer_phone,customer_email,district,thana,area,full_address,order_note,items,subtotal,discount_amount,coupon_code,delivery_charge,total,payment_method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderId, orderNumber, req.customer?.id || null, customer_name, customer_phone, customer_email || null, district, thana, area || null, full_address, order_note || null, JSON.stringify(enrichedItems), subtotal, discount_amount, validCoupon?.code || null, delivery_charge, total, payment_method);
  db.prepare(`INSERT INTO order_status_history (id,order_id,status,note) VALUES (?,?,?,?)`).run(uuidv4(), orderId, 'pending', 'Order placed');
  for (const item of enrichedItems) {
    db.prepare(`UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), sold_count = sold_count + ? WHERE id = ?`).run(item.quantity, item.quantity, item.product_id);
    db.prepare(`UPDATE products SET stock_status = CASE WHEN stock_quantity = 0 THEN 'out_of_stock' ELSE 'in_stock' END WHERE id = ?`).run(item.product_id);
  }
  if (validCoupon) {
    db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(validCoupon.id);
    db.prepare('INSERT INTO coupon_usage (id,coupon_id,customer_id,order_id) VALUES (?,?,?,?)').run(uuidv4(), validCoupon.id, req.customer?.id || null, orderId);
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const parsedOrder = { ...order, items: JSON.parse(order.items || '[]') };
  const whatsappNumber = getSetting('site_whatsapp') || '';
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${buildWhatsAppMessage(order)}` : null;
  res.status(201).json({ message: 'Order placed successfully', order: parsedOrder, whatsapp_url: whatsappUrl });
});

router.get('/track/:orderNumber', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  res.json({ order: { ...order, items: JSON.parse(order.items || '[]') }, history });
});

router.post('/validate-coupon', (req, res) => {
  const db = getDB();
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code required' });
  const coupon = db.prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expiry_date IS NULL OR expiry_date >= date('now')) AND (start_date IS NULL OR start_date <= date('now'))`).get(code.toUpperCase());
  if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon code' });
  if (subtotal < (coupon.minimum_order || 0)) return res.status(400).json({ error: `Minimum order ৳${coupon.minimum_order} required` });
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ error: 'Coupon usage limit reached' });
  let discount = coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.maximum_discount) discount = Math.min(discount, coupon.maximum_discount);
  res.json({ coupon, discount });
});

router.get('/my/orders', customerAuth, (req, res) => {
  const db = getDB();
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(req.customer.id);
  res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })) });
});

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, status, search, from_date, to_date, payment_method } = req.query;
  const { offset, limit: lim } = paginateQuery(page, limit);
  let where = []; const params = [];
  if (status && status !== 'all') { where.push('status = ?'); params.push(status); }
  if (search) { where.push('(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
  if (from_date) { where.push('DATE(created_at) >= ?'); params.push(from_date); }
  if (to_date) { where.push('DATE(created_at) <= ?'); params.push(to_date); }
  if (payment_method) { where.push('payment_method = ?'); params.push(payment_method); }
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM orders ${whereStr}`).get(...params).cnt;
  const orders = db.prepare(`SELECT * FROM orders ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })), total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

router.get('/admin/stats/summary', adminAuth, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const stats = {
    total_orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    today_orders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = ?`).get(today).c,
    pending: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending'`).get().c,
    confirmed: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'confirmed'`).get().c,
    delivered: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'`).get().c,
    cancelled: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'`).get().c,
    total_revenue: db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status NOT IN ('cancelled','returned')`).get().s,
    today_revenue: db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM orders WHERE DATE(created_at) = ? AND status NOT IN ('cancelled','returned')`).get(today).s,
    total_customers: db.prepare('SELECT COUNT(*) as c FROM customers WHERE is_guest = 0').get().c,
    total_products: db.prepare('SELECT COUNT(*) as c FROM products WHERE is_published = 1').get().c,
    low_stock: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock_quantity > 0 AND stock_quantity <= 5').get().c,
    out_of_stock: db.prepare(`SELECT COUNT(*) as c FROM products WHERE stock_status = 'out_of_stock'`).get().c,
  };
  const monthly = db.prepare(`SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total),0) as revenue, COUNT(*) as orders FROM orders WHERE status NOT IN ('cancelled','returned') AND created_at >= date('now', '-12 months') GROUP BY month ORDER BY month ASC`).all();
  const topProducts = db.prepare(`SELECT name, sold_count, regular_price, sale_price FROM products WHERE is_published = 1 ORDER BY sold_count DESC LIMIT 5`).all();
  res.json({ stats, monthly_chart: monthly, top_products: topProducts });
});

router.get('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  res.json({ order: { ...order, items: JSON.parse(order.items || '[]') }, history });
});

router.put('/admin/:id/status', adminAuth, (req, res) => {
  const db = getDB();
  const { status, note } = req.body;
  const validStatuses = ['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare(`UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, req.params.id);
  db.prepare(`INSERT INTO order_status_history (id,order_id,status,note,changed_by) VALUES (?,?,?,?,?)`).run(uuidv4(), req.params.id, status, note || null, req.admin.name);
  res.json({ message: 'Order status updated' });
});

module.exports = router;
