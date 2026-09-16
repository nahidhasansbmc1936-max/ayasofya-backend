const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');

function ownerOnly(req, res, next) {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Owner/Super Admin can manage users' });
  }
  next();
}

// GET all admin users
router.get('/', adminAuth, ownerOnly, (req, res) => {
  const db = getDB();
  const users = db.prepare(
    `SELECT id, name, email, role, permissions, is_active, last_login, created_at
     FROM admin_users ORDER BY created_at DESC`
  ).all();
  res.json({ users });
});

// CREATE user
router.post('/', adminAuth, ownerOnly, (req, res) => {
  const db = getDB();
  const { name, email, password, role = 'staff', permissions = [] } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const allowed = ['super_admin', 'admin', 'editor', 'staff'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email.toLowerCase().trim())) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO admin_users (id, name, email, password, role, permissions, invited_by) VALUES (?,?,?,?,?,?,?)`
  ).run(id, name, email.toLowerCase().trim(), hash, role, JSON.stringify(permissions), req.admin.id);
  res.status(201).json({ message: 'User created', id });
});

// UPDATE user
router.put('/:id', adminAuth, ownerOnly, (req, res) => {
  const db = getDB();
  const target = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { name, role, permissions, is_active } = req.body;

  if (target.role === 'super_admin' && role && role !== 'super_admin') {
    const cnt = db.prepare("SELECT COUNT(*) as c FROM admin_users WHERE role='super_admin' AND is_active=1").get().c;
    if (cnt <= 1) return res.status(403).json({ error: 'Cannot remove the last Owner' });
  }
  if (role === 'super_admin' && req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Cannot promote to Super Admin' });
  }

  db.prepare(
    `UPDATE admin_users SET name=?,role=?,permissions=?,is_active=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    name ?? target.name,
    role ?? target.role,
    permissions ? JSON.stringify(permissions) : target.permissions,
    is_active !== undefined ? (is_active ? 1 : 0) : target.is_active,
    req.params.id
  );
  res.json({ message: 'User updated' });
});

// DELETE user
router.delete('/:id', adminAuth, ownerOnly, (req, res) => {
  const db = getDB();
  if (req.params.id === req.admin.id) return res.status(403).json({ error: 'Cannot delete your own account' });
  const target = db.prepare('SELECT role FROM admin_users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    const cnt = db.prepare("SELECT COUNT(*) as c FROM admin_users WHERE role='super_admin' AND is_active=1").get().c;
    if (cnt <= 1) return res.status(403).json({ error: 'Cannot delete the last Owner' });
  }
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// CHANGE own email
router.put('/account/change-email', adminAuth, (req, res) => {
  const db = getDB();
  const { new_email, password } = req.body;
  if (!new_email || !password) return res.status(400).json({ error: 'New email and current password required' });
  const me = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(password, me.password)) return res.status(401).json({ error: 'Current password incorrect' });
  if (db.prepare('SELECT id FROM admin_users WHERE email=? AND id!=?').get(new_email.toLowerCase().trim(), req.admin.id)) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  db.prepare("UPDATE admin_users SET email=?,updated_at=datetime('now') WHERE id=?")
    .run(new_email.toLowerCase().trim(), req.admin.id);
  res.json({ message: 'Email updated successfully' });
});

// CHANGE own password
router.put('/account/change-password', adminAuth, (req, res) => {
  const db = getDB();
  const { current_password, new_password, confirm_password } = req.body;
  if (!current_password || !new_password || !confirm_password) return res.status(400).json({ error: 'All fields required' });
  if (new_password !== confirm_password) return res.status(400).json({ error: 'New passwords do not match' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Minimum 8 characters required' });
  const me = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(current_password, me.password)) return res.status(401).json({ error: 'Current password incorrect' });
  db.prepare("UPDATE admin_users SET password=?,updated_at=datetime('now') WHERE id=?")
    .run(bcrypt.hashSync(new_password, 10), req.admin.id);
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
