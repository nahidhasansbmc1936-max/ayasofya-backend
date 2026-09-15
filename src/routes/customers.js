const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth, customerAuth } = require('../middleware/auth');
const { paginateQuery } = require('../utils/helpers');

router.get('/addresses', customerAuth, (req, res) => {
  const db = getDB();
  res.json({ addresses: db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ?').all(req.customer.id) });
});

router.post('/addresses', customerAuth, (req, res) => {
  const db = getDB();
  const { label, full_name, phone, district, thana, area, full_address, is_default } = req.body;
  if (!full_name || !phone || !district || !thana || !full_address) return res.status(400).json({ error: 'Required fields missing' });
  if (is_default) db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id);
  const id = uuidv4();
  db.prepare(`INSERT INTO customer_addresses (id,customer_id,label,full_name,phone,district,thana,area,full_address,is_default) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, req.customer.id, label || 'Home', full_name, phone, district, thana, area || null, full_address, is_default ? 1 : 0);
  res.status(201).json({ message: 'Address added', id });
});

router.delete('/addresses/:id', customerAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?').run(req.params.id, req.customer.id);
  res.json({ message: 'Address deleted' });
});

router.get('/wishlist', customerAuth, (req, res) => {
  const db = getDB();
  const items = db.prepare(`SELECT w.id, w.product_id, w.created_at, p.name, p.slug, p.images, p.regular_price, p.sale_price, p.discount_percent, p.stock_status FROM wishlists w JOIN products p ON w.product_id = p.id WHERE w.customer_id = ? ORDER BY w.created_at DESC`).all(req.customer.id);
  res.json({ wishlist: items.map(i => ({ ...i, images: JSON.parse(i.images || '[]') })) });
});

router.post('/wishlist/:productId', customerAuth, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM wishlists WHERE customer_id = ? AND product_id = ?').get(req.customer.id, req.params.productId);
  if (existing) {
    db.prepare('DELETE FROM wishlists WHERE id = ?').run(existing.id);
    return res.json({ message: 'Removed from wishlist', added: false });
  }
  db.prepare('INSERT INTO wishlists (id,customer_id,product_id) VALUES (?,?,?)').run(uuidv4(), req.customer.id, req.params.productId);
  res.json({ message: 'Added to wishlist', added: true });
});

router.delete('/wishlist/:productId', customerAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?').run(req.customer.id, req.params.productId);
  res.json({ message: 'Removed from wishlist' });
});

router.post('/reviews', customerAuth, (req, res) => {
  const db = getDB();
  const { product_id, rating, title, body } = req.body;
  if (!product_id || !rating) return res.status(400).json({ error: 'Product ID and rating required' });
  const autoApprove = db.prepare("SELECT value FROM settings WHERE key = 'review_auto_approve'").get()?.value === '1';
  const isVerified = db.prepare("SELECT id FROM orders WHERE customer_id = ? AND items LIKE ? AND status = 'delivered'").get(req.customer.id, `%${product_id}%`) ? 1 : 0;
  const id = uuidv4();
  db.prepare(`INSERT INTO reviews (id,product_id,customer_id,customer_name,rating,title,body,is_verified_purchase,is_approved) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, product_id, req.customer.id, req.customer.name, parseInt(rating), title || null, body || null, isVerified, autoApprove ? 1 : 0);
  if (autoApprove) {
    const avg = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ? AND is_approved = 1').get(product_id);
    db.prepare('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?').run(avg.avg, avg.cnt, product_id);
  }
  res.status(201).json({ message: autoApprove ? 'Review submitted' : 'Review submitted for approval' });
});

router.post('/newsletter', (req, res) => {
  const db = getDB();
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (id,email,name) VALUES (?,?,?)').run(uuidv4(), email, name || null);
    res.json({ message: 'Subscribed successfully!' });
  } catch (_) { res.status(409).json({ error: 'Already subscribed' }); }
});

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, search } = req.query;
  const { offset, limit: lim } = paginateQuery(page, limit);
  let where = ['is_guest = 0']; const params = [];
  if (search) { where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
  const whereStr = `WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers ${whereStr}`).get(...params).cnt;
  const customers = db.prepare(`SELECT id,name,email,phone,created_at,is_active FROM customers ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ customers, total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

router.get('/admin/reviews', adminAuth, (req, res) => {
  const db = getDB();
  const { status = 'all', page = 1 } = req.query;
  const { offset, limit: lim } = paginateQuery(page, 20);
  let where = []; const params = [];
  if (status === 'pending') where.push('r.is_approved = 0');
  else if (status === 'approved') where.push('r.is_approved = 1');
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const reviews = db.prepare(`SELECT r.*, p.name as product_name, p.slug as product_slug FROM reviews r JOIN products p ON r.product_id = p.id ${whereStr} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ reviews });
});

router.put('/admin/reviews/:id', adminAuth, (req, res) => {
  const db = getDB();
  const { is_approved } = req.body;
  db.prepare('UPDATE reviews SET is_approved = ? WHERE id = ?').run(is_approved ? 1 : 0, req.params.id);
  const review = db.prepare('SELECT product_id FROM reviews WHERE id = ?').get(req.params.id);
  if (review) {
    const avg = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ? AND is_approved = 1').get(review.product_id);
    db.prepare('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?').run(avg.avg || 0, avg.cnt || 0, review.product_id);
  }
  res.json({ message: 'Review updated' });
});

router.delete('/admin/reviews/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ message: 'Review deleted' });
});

module.exports = router;
