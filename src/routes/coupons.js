const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
});

router.post('/admin', adminAuth, (req, res) => {
  const db = getDB();
  const { code, description, discount_type, discount_value, minimum_order, maximum_discount, usage_limit, per_customer_limit, start_date, expiry_date, product_ids, category_ids, is_active } = req.body;
  if (!code || !discount_value) return res.status(400).json({ error: 'Code and discount value required' });
  const existing = db.prepare('SELECT id FROM coupons WHERE code = ?').get(code.toUpperCase());
  if (existing) return res.status(409).json({ error: 'Coupon code already exists' });
  const id = uuidv4();
  db.prepare(`INSERT INTO coupons (id,code,description,discount_type,discount_value,minimum_order,maximum_discount,usage_limit,per_customer_limit,start_date,expiry_date,product_ids,category_ids,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, code.toUpperCase(), description || null, discount_type || 'percentage', parseFloat(discount_value), parseFloat(minimum_order) || 0, maximum_discount ? parseFloat(maximum_discount) : null, usage_limit ? parseInt(usage_limit) : null, parseInt(per_customer_limit) || 1, start_date || null, expiry_date || null, JSON.stringify(product_ids || []), JSON.stringify(category_ids || []), is_active === false ? 0 : 1);
  res.status(201).json({ message: 'Coupon created', id });
});

router.put('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  const { description, discount_type, discount_value, minimum_order, maximum_discount, usage_limit, start_date, expiry_date, is_active } = req.body;
  db.prepare(`UPDATE coupons SET description=?,discount_type=?,discount_value=?,minimum_order=?,maximum_discount=?,usage_limit=?,start_date=?,expiry_date=?,is_active=? WHERE id=?`).run(description || null, discount_type || 'percentage', parseFloat(discount_value), parseFloat(minimum_order) || 0, maximum_discount ? parseFloat(maximum_discount) : null, usage_limit ? parseInt(usage_limit) : null, start_date || null, expiry_date || null, is_active === false ? 0 : 1, req.params.id);
  res.json({ message: 'Coupon updated' });
});

router.delete('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Coupon deleted' });
});

module.exports = router;
