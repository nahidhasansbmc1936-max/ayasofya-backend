const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { customerAuth, adminAuth } = require('../middleware/auth');

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const db = getDB();
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, admin.password)) return res.status(401).json({ error: 'Invalid credentials' });
  db.prepare("UPDATE admin_users SET last_login = datetime('now') WHERE id = ?").run(admin.id);
  const token = jwt.sign({ id: admin.id, type: 'admin', role: admin.role }, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, avatar: admin.avatar } });
});

router.get('/admin/me', adminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

router.post('/customer/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !password || (!email && !phone)) {
    return res.status(400).json({ error: 'Name, password, and email or phone are required' });
  }
  const db = getDB();
  if (email && db.prepare('SELECT id FROM customers WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  if (phone && db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone)) {
    return res.status(409).json({ error: 'Phone already registered' });
  }
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO customers (id, name, email, phone, password) VALUES (?,?,?,?,?)`).run(id, name, email || null, phone || null, hash);
  const token = jwt.sign({ id, type: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, customer: { id, name, email, phone } });
});

router.post('/customer/login', (req, res) => {
  const { email, phone, password } = req.body;
  if (!password || (!email && !phone)) return res.status(400).json({ error: 'Credentials required' });
  const db = getDB();
  const customer = db.prepare('SELECT * FROM customers WHERE (email = ? OR phone = ?) AND is_guest = 0').get(email || '', phone || '');
  if (!customer) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, customer.password || '')) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: customer.id, type: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } });
});

router.get('/customer/me', customerAuth, (req, res) => {
  const db = getDB();
  const customer = db.prepare('SELECT id, name, email, phone, avatar, created_at FROM customers WHERE id = ?').get(req.customer.id);
  res.json({ customer });
});

router.put('/customer/profile', customerAuth, (req, res) => {
  const { name, phone } = req.body;
  const db = getDB();
  db.prepare("UPDATE customers SET name=?, phone=?, updated_at=datetime('now') WHERE id=?").run(name, phone, req.customer.id);
  res.json({ message: 'Profile updated' });
});

router.put('/customer/change-password', customerAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  const db = getDB();
  const customer = db.prepare('SELECT password FROM customers WHERE id = ?').get(req.customer.id);
  if (!bcrypt.compareSync(current_password, customer.password || '')) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE customers SET password = ? WHERE id = ?').run(hash, req.customer.id);
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
