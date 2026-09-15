const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { categoryUpload } = require('../middleware/upload');

function slug(str) { return slugify(str, { lower: true, strict: true }); }

router.get('/', (req, res) => {
  const db = getDB();
  const categories = db.prepare(`SELECT c.*, p.name as parent_name, (SELECT COUNT(*) FROM products pr WHERE pr.category_id = c.id AND pr.is_published = 1) as product_count FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.is_active = 1 ORDER BY c.sort_order ASC, c.name ASC`).all();
  const map = {};
  const roots = [];
  categories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; });
  categories.forEach(cat => {
    if (cat.parent_id && map[cat.parent_id]) map[cat.parent_id].children.push(map[cat.id]);
    else roots.push(map[cat.id]);
  });
  res.json({ categories: roots });
});

router.get('/flat', (req, res) => {
  const db = getDB();
  res.json({ categories: db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC').all() });
});

router.get('/:slug', (req, res) => {
  const db = getDB();
  const category = db.prepare('SELECT * FROM categories WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  const children = db.prepare('SELECT * FROM categories WHERE parent_id = ? AND is_active = 1').all(category.id);
  res.json({ category, children });
});

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ categories: db.prepare('SELECT c.*, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.sort_order ASC, c.name ASC').all() });
});

router.post('/admin', adminAuth, categoryUpload.single('image'), (req, res) => {
  const db = getDB();
  const { name, description, parent_id, sort_order, meta_title, meta_description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });
  const id = uuidv4();
  const catSlug = slug(name) + '-' + id.substring(0, 4);
  const image = req.file ? `/uploads/categories/${req.file.filename}` : null;
  db.prepare(`INSERT INTO categories (id,name,slug,description,parent_id,sort_order,image,meta_title,meta_description) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, name, catSlug, description || null, parent_id || null, parseInt(sort_order) || 0, image, meta_title || null, meta_description || null);
  res.status(201).json({ message: 'Category created', id });
});

router.put('/admin/:id', adminAuth, categoryUpload.single('image'), (req, res) => {
  const db = getDB();
  const { name, description, parent_id, sort_order, is_active, meta_title, meta_description } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  const image = req.file ? `/uploads/categories/${req.file.filename}` : existing.image;
  db.prepare(`UPDATE categories SET name=?,description=?,parent_id=?,sort_order=?,image=?,is_active=?,meta_title=?,meta_description=?,updated_at=datetime('now') WHERE id=?`).run(name || existing.name, description || existing.description, parent_id || null, parseInt(sort_order) || 0, image, is_active === 'false' ? 0 : 1, meta_title || existing.meta_title, meta_description || existing.meta_description, req.params.id);
  res.json({ message: 'Category updated' });
});

router.delete('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Category deleted' });
});

module.exports = router;
