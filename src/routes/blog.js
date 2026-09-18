const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { blogUpload } = require('../middleware/upload');
const { paginateQuery } = require('../utils/helpers');

function slug(str) { return slugify(str, { lower: true, strict: true }); }

router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, limit = 9, category, search } = req.query;
  const { offset, limit: lim } = paginateQuery(page, limit);
  let where = ['bp.is_published = 1']; const params = [];
  if (category) { where.push('bc.slug = ?'); params.push(category); }
  if (search) { where.push('(bp.title LIKE ? OR bp.excerpt LIKE ?)'); const s = `%${search}%`; params.push(s, s); }
  const whereStr = `WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id ${whereStr}`).get(...params).cnt;
  const posts = db.prepare(`SELECT bp.*, bc.name as category_name, bc.slug as category_slug, au.name as author_name FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id LEFT JOIN admin_users au ON bp.author_id = au.id ${whereStr} ORDER BY bp.published_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);
  res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / lim) });
});

router.get('/categories', (req, res) => {
  const db = getDB();
  res.json({ categories: db.prepare('SELECT * FROM blog_categories').all() });
});

router.get('/:slug', (req, res) => {
  const db = getDB();
  const post = db.prepare(`SELECT bp.*, bc.name as category_name, au.name as author_name FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id LEFT JOIN admin_users au ON bp.author_id = au.id WHERE bp.slug = ? AND bp.is_published = 1`).get(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('UPDATE blog_posts SET views = views + 1 WHERE id = ?').run(post.id);
  const related = db.prepare('SELECT id,title,slug,featured_image,published_at FROM blog_posts WHERE category_id = ? AND id != ? AND is_published = 1 LIMIT 3').all(post.category_id, post.id);
  res.json({ post: { ...post, tags: JSON.parse(post.tags || '[]') }, related });
});

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ posts: db.prepare(`SELECT bp.*, bc.name as category_name FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id ORDER BY bp.created_at DESC`).all() });
});

router.post('/admin', adminAuth, blogUpload.single('featured_image'), (req, res) => {
  const db = getDB();
  const { title, excerpt, content, category_id, tags, is_published, meta_title, meta_description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = uuidv4();
  const postSlug = slug(title) + '-' + id.substring(0, 6);

  // Save blog image to media DB
  let featured_image = null;
  if (req.file) {
    const mid = uuidv4();
    featured_image = `/api/media/img/${mid}`;
    db.prepare(`INSERT INTO media (id,filename,original_name,mimetype,size,url,data,folder) VALUES (?,?,?,?,?,?,?,?)`)
      .run(mid, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, featured_image, req.file.buffer.toString('base64'), 'blog');
  }

  const publish = is_published === 'true' || is_published === true;
  db.prepare(`INSERT INTO blog_posts (id,title,slug,excerpt,content,featured_image,category_id,author_id,tags,is_published,meta_title,meta_description,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, title, postSlug, excerpt || null, content || null, featured_image, category_id || null, req.admin.id, tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : '[]', publish ? 1 : 0, meta_title || null, meta_description || null, publish ? new Date().toISOString() : null);
  res.status(201).json({ message: 'Post created', id });
});

router.put('/admin/:id', adminAuth, blogUpload.single('featured_image'), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });
  const body = req.body;

  // Save new blog image to media DB if provided
  let featured_image = existing.featured_image;
  if (req.file) {
    const mid = uuidv4();
    featured_image = `/api/media/img/${mid}`;
    db.prepare(`INSERT INTO media (id,filename,original_name,mimetype,size,url,data,folder) VALUES (?,?,?,?,?,?,?,?)`)
      .run(mid, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, featured_image, req.file.buffer.toString('base64'), 'blog');
  }

  const publish = body.is_published === 'true' || body.is_published === true;
  db.prepare(`UPDATE blog_posts SET title=?,excerpt=?,content=?,featured_image=?,category_id=?,tags=?,is_published=?,meta_title=?,meta_description=?,published_at=?,updated_at=datetime('now') WHERE id=?`).run(body.title || existing.title, body.excerpt || existing.excerpt, body.content || existing.content, featured_image, body.category_id || existing.category_id, body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : existing.tags, publish ? 1 : 0, body.meta_title || existing.meta_title, body.meta_description || existing.meta_description, publish && !existing.published_at ? new Date().toISOString() : existing.published_at, req.params.id);
  res.json({ message: 'Post updated' });
});

router.delete('/admin/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Post deleted' });
});

router.post('/admin/categories', adminAuth, (req, res) => {
  const db = getDB();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO blog_categories (id,name,slug) VALUES (?,?,?)').run(id, name, slug(name));
  res.status(201).json({ message: 'Category created', id });
});

module.exports = router;
