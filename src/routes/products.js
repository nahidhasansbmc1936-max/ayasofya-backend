const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { productUpload } = require('../middleware/upload');
const { paginateQuery } = require('../utils/helpers');

function slug(str) { return slugify(str, { lower: true, strict: true }); }

function parseProduct(row) {
  if (!row) return null;
  return { ...row, images: JSON.parse(row.images || '[]'), tags: JSON.parse(row.tags || '[]'), is_featured: !!row.is_featured, is_bestseller: !!row.is_bestseller, is_new_arrival: !!row.is_new_arrival, is_on_offer: !!row.is_on_offer, is_published: !!row.is_published, manage_stock: !!row.manage_stock };
}

// Public: list products
router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, category, search, featured, bestseller, new_arrival, offer, min_price, max_price, sort = 'latest', in_stock } = req.query;
  const { offset, limit: lim } = paginateQuery(page, limit);
  let where = ['p.is_published = 1'];
  const params = [];
  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(category);
    if (cat) {
      const childCats = db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(cat.id).map(c => c.id);
      const allCatIds = [cat.id, ...childCats];
      where.push(`p.category_id IN (${allCatIds.map(() => '?').join(',')})`);
      params.push(...allCatIds);
    }
  }
  if (search) { where.push(`(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`); const s = `%${search}%`; params.push(s, s, s); }
  if (featured === '1') where.push('p.is_featured = 1');
  if (bestseller === '1') where.push('p.is_bestseller = 1');
  if (new_arrival === '1') where.push('p.is_new_arrival = 1');
  if (offer === '1') where.push('p.is_on_offer = 1');
  if (in_stock === '1') where.push('p.stock_status = "in_stock"');
  if (min_price) { where.push('COALESCE(p.sale_price, p.regular_price) >= ?'); params.push(parseFloat(min_price)); }
  if (max_price) { where.push('COALESCE(p.sale_price, p.regular_price) <= ?'); params.push(parseFloat(max_price)); }
  const whereStr = `WHERE ${where.join(' AND ')}`;
  const orderMap = { latest: 'p.created_at DESC', price_asc: 'COALESCE(p.sale_price, p.regular_price) ASC', price_desc: 'COALESCE(p.sale_price, p.regular_price) DESC', bestselling: 'p.sold_count DESC', top_rated: 'p.rating_avg DESC' };
  const orderBy = orderMap[sort] || 'p.created_at DESC';
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM products p ${whereStr}`).get(...params).cnt;
  const rows = db.prepare(`SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereStr} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ products: rows.map(parseProduct), total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

// Public: single product by slug
router.get('/:slug', (req, res) => {
  const db = getDB();
  const row = db.prepare(`SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? AND p.is_published = 1`).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  const product = parseProduct(row);
  const variations = db.prepare('SELECT * FROM product_variations WHERE product_id = ? AND is_active = 1').all(row.id).map(v => ({ ...v, attributes: JSON.parse(v.attributes || '{}') }));
  const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 10').all(row.id);
  const related = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id = ? AND p.id != ? AND p.is_published = 1 LIMIT 8`).all(row.category_id, row.id).map(parseProduct);
  res.json({ product, variations, reviews, related });
});

// Admin: get all products
router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, search, category, status } = req.query;
  const { offset, limit: lim } = paginateQuery(page, limit);
  let where = []; const params = [];
  if (search) { where.push(`(p.name LIKE ? OR p.sku LIKE ?)`); const s = `%${search}%`; params.push(s, s); }
  if (category) { where.push('p.category_id = ?'); params.push(category); }
  if (status === 'published') where.push('p.is_published = 1');
  else if (status === 'draft') where.push('p.is_published = 0');
  else if (status === 'out_of_stock') where.push('p.stock_status = "out_of_stock"');
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM products p ${whereStr}`).get(...params).cnt;
  const rows = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereStr} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ products: rows.map(parseProduct), total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

// Admin: create product
router.post('/admin', adminAuth, productUpload.array('images', 10), (req, res) => {
  const db = getDB();
  const body = req.body;
  if (!body.name || !body.regular_price) return res.status(400).json({ error: 'Name and price are required' });
  const id = uuidv4();
  const productSlug = slug(body.name) + '-' + id.substring(0, 6);
  const regular_price = parseFloat(body.regular_price);
  const sale_price = body.sale_price ? parseFloat(body.sale_price) : null;
  const discount = sale_price ? Math.round(((regular_price - sale_price) / regular_price) * 100) : 0;
  const images = req.files ? req.files.map(f => `/uploads/products/${f.filename}`) : [];
  const stock = parseInt(body.stock_quantity) || 0;
  db.prepare(`INSERT INTO products (id,name,slug,sku,description,short_description,category_id,brand_id,regular_price,sale_price,discount_percent,stock_quantity,stock_status,manage_stock,images,tags,is_featured,is_bestseller,is_new_arrival,is_on_offer,is_published,specifications,delivery_info,return_policy,meta_title,meta_description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, body.name, productSlug, body.sku || null, body.description || null, body.short_description || null, body.category_id || null, body.brand_id || null, regular_price, sale_price, discount, stock, stock > 0 ? 'in_stock' : 'out_of_stock', body.manage_stock === 'false' ? 0 : 1, JSON.stringify(images), body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : '[]', body.is_featured === 'true' ? 1 : 0, body.is_bestseller === 'true' ? 1 : 0, body.is_new_arrival === 'true' ? 1 : 0, body.is_on_offer === 'true' ? 1 : 0, body.is_published === 'false' ? 0 : 1, body.specifications || null, body.delivery_info || null, body.return_policy || null, body.meta_title || null, body.meta_description || null);
  res.status(201).json({ message: 'Product created', id });
});

// Admin: update product
router.put('/admin/:id', adminAuth, productUpload.array('images', 10), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const body = req.body;
  const newImages = req.files ? req.files.map(f => `/uploads/products/${f.filename}`) : [];
  let existingImages = JSON.parse(existing.images || '[]');
  if (body.remove_images) {
    const toRemove = Array.isArray(body.remove_images) ? body.remove_images : [body.remove_images];
    existingImages = existingImages.filter(img => !toRemove.includes(img));
  }
  const allImages = [...existingImages, ...newImages];
  const regular_price = parseFloat(body.regular_price) || existing.regular_price;
  const sale_price = body.sale_price ? parseFloat(body.sale_price) : null;
  const discount = sale_price ? Math.round(((regular_price - sale_price) / regular_price) * 100) : 0;
  const stock = body.stock_quantity !== undefined ? parseInt(body.stock_quantity) : existing.stock_quantity;
  db.prepare(`UPDATE products SET name=?,sku=?,description=?,short_description=?,category_id=?,regular_price=?,sale_price=?,discount_percent=?,stock_quantity=?,stock_status=?,images=?,tags=?,is_featured=?,is_bestseller=?,is_new_arrival=?,is_on_offer=?,is_published=?,specifications=?,delivery_info=?,return_policy=?,meta_title=?,meta_description=?,updated_at=datetime('now') WHERE id=?`).run(body.name || existing.name, body.sku || existing.sku, body.description || existing.description, body.short_description || existing.short_description, body.category_id || existing.category_id, regular_price, sale_price, discount, stock, stock > 0 ? 'in_stock' : 'out_of_stock', JSON.stringify(allImages), body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : existing.tags, body.is_featured === 'true' ? 1 : (body.is_featured === 'false' ? 0 : existing.is_featured), body.is_bestseller === 'true' ? 1 : (body.is_bestseller === 'false' ? 0 : existing.is_bestseller), body.is_new_arrival === 'true' ? 1 : (body.is_new_arrival === 'false' ? 0 : existing.is_new_arrival), body.is_on_offer === 'true' ? 1 : (body.is_on_offer === 'false' ? 0 : existing.is_on_offer), body.is_published === 'false' ? 0 : 1, body.specifications || existing.specifications, body.delivery_info || existing.delivery_info, body.return_policy || existing.return_policy, body.meta_title || existing.meta_title, body.meta_description || existing.meta_description, req.params.id);
  res.json({ message: 'Product updated' });
});

router.delete('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted' });
});

// Variations
router.get('/admin/:id/variations', adminAuth, (req, res) => {
  const db = getDB();
  const variations = db.prepare('SELECT * FROM product_variations WHERE product_id = ?').all(req.params.id).map(v => ({ ...v, attributes: JSON.parse(v.attributes || '{}') }));
  res.json({ variations });
});

router.post('/admin/:id/variations', adminAuth, (req, res) => {
  const db = getDB();
  const { attributes, regular_price, sale_price, stock_quantity, sku, image } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO product_variations (id,product_id,sku,attributes,regular_price,sale_price,stock_quantity,image) VALUES (?,?,?,?,?,?,?,?)`).run(id, req.params.id, sku || null, JSON.stringify(attributes || {}), regular_price || null, sale_price || null, parseInt(stock_quantity) || 0, image || null);
  res.status(201).json({ message: 'Variation added', id });
});

router.put('/admin/:id/variations/:varId', adminAuth, (req, res) => {
  const db = getDB();
  const { attributes, regular_price, sale_price, stock_quantity, sku, image, is_active } = req.body;
  db.prepare(`UPDATE product_variations SET sku=?,attributes=?,regular_price=?,sale_price=?,stock_quantity=?,image=?,is_active=? WHERE id=? AND product_id=?`).run(sku || null, JSON.stringify(attributes || {}), regular_price || null, sale_price || null, parseInt(stock_quantity) || 0, image || null, is_active === false ? 0 : 1, req.params.varId, req.params.id);
  res.json({ message: 'Variation updated' });
});

router.delete('/admin/:id/variations/:varId', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM product_variations WHERE id = ? AND product_id = ?').run(req.params.varId, req.params.id);
  res.json({ message: 'Variation deleted' });
});

module.exports = router;
