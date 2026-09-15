const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ error: 'Not authorized as admin' });
    const db = getDB();
    const admin = db.prepare('SELECT id, name, email, role, is_active FROM admin_users WHERE id = ?').get(decoded.id);
    if (!admin || !admin.is_active) return res.status(401).json({ error: 'Admin not found or inactive' });
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function customerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') return res.status(403).json({ error: 'Not authorized as customer' });
    const db = getDB();
    const customer = db.prepare('SELECT id, name, email, phone, is_active FROM customers WHERE id = ?').get(decoded.id);
    if (!customer || !customer.is_active) return res.status(401).json({ error: 'Customer not found or inactive' });
    req.customer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.customer = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      const db = getDB();
      req.customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE id = ?').get(decoded.id);
    }
  } catch (_) { req.customer = null; }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { adminAuth, customerAuth, optionalCustomerAuth, requireRole };
