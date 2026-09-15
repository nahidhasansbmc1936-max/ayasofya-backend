const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
function slug(str) { return slugify(str, { lower: true, strict: true }); }

router.get('/', (req, res) => {
  const db = getDB();
  const attributes = db.prepare('SELECT * FROM attributes ORDER BY sort_order ASC, name ASC').all();
  const result = attributes.map(attr => ({
    ...attr,
    values: db.prepare('SELECT * FROM attribute_values WHERE attribute_id = ? ORDER BY sort_order ASC').all(attr.id)
  }));
  res.json({ attributes: result });
});

router.post('/admin', adminAuth, (req, res) => {
  const db = getDB();
  const { name, type = 'select', sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO attributes (id,name,slug,type,sort_order) VALUES (?,?,?,?,?)').run(id, name, slug(name), type, sort_order);
  res.status(201).json({ message: 'Attribute created', id });
});

router.post('/admin/:id/values', adminAuth, (req, res) => {
  const db = getDB();
  const { value, color_code, sort_order = 0 } = req.body;
  if (!value) return res.status(400).json({ error: 'Value required' });
  const id = uuidv4();
  db.prepare('INSERT INTO attribute_values (id,attribute_id,value,color_code,sort_order) VALUES (?,?,?,?,?)').run(id, req.params.id, value, color_code || null, sort_order);
  res.status(201).json({ message: 'Value added', id });
});

router.delete('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM attributes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

router.delete('/admin/values/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM attribute_values WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
