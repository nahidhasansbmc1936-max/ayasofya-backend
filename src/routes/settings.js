const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { generalUpload, bannerUpload } = require('../middleware/upload');

router.get('/public', (req, res) => {
  const db = getDB();
  const publicKeys = ['site_name','site_tagline','site_email','site_phone','site_whatsapp','site_address','primary_color','secondary_color','accent_color','header_bg','footer_bg','button_color','font_family','border_radius','delivery_inside_dhaka','delivery_outside_dhaka','free_delivery_above','payment_cod','payment_bkash','payment_nagad','payment_card','bkash_number','nagad_number','facebook_url','instagram_url','youtube_url','about_text','seo_title','seo_description','logo_url','favicon_url','mobile_logo_url','footer_logo_url','show_reviews'];
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${publicKeys.map(() => '?').join(',')})`).all(...publicKeys);
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json({ settings: obj });
});

router.get('/admin/all', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ settings: db.prepare('SELECT key, value, type, group_name FROM settings ORDER BY group_name, key').all() });
});

router.put('/admin', adminAuth, (req, res) => {
  const db = getDB();
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Settings object required' });
  const update = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
  const updateMany = db.transaction((entries) => { for (const [key, value] of entries) update.run(key, value); });
  updateMany(Object.entries(settings));
  res.json({ message: 'Settings updated' });
});

router.post('/admin/upload/:type', adminAuth, generalUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const keyMap = { logo: 'logo_url', favicon: 'favicon_url', mobile_logo: 'mobile_logo_url', footer_logo: 'footer_logo_url' };
  const key = keyMap[req.params.type];
  if (!key) return res.status(400).json({ error: 'Invalid type' });
  const db = getDB();
  const { v4: uuidv4 } = require('uuid');
  const mid = uuidv4();
  const url = `/api/media/img/${mid}`;
  db.prepare(
    `INSERT INTO media (id,filename,original_name,mimetype,size,url,data,folder) VALUES (?,?,?,?,?,?,?,?)`
  ).run(mid, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, url, req.file.buffer.toString('base64'), 'general');
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, url);
  res.json({ url, key, message: `${req.params.type} uploaded` });
});

// Banners
router.get('/banners', (req, res) => {
  const db = getDB();
  const { type = 'hero' } = req.query;
  res.json({ banners: db.prepare('SELECT * FROM banners WHERE type = ? AND is_active = 1 ORDER BY sort_order ASC').all(type) });
});

router.get('/admin/banners', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ banners: db.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all() });
});

router.post('/admin/banners', adminAuth, bannerUpload.fields([{ name: 'desktop_image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]), (req, res) => {
  const db = getDB();
  const { v4: uuidv4b } = require('uuid');
  const { title, subtitle, heading, subheading, button_text, button_url, overlay_opacity, text_position, type, slide_duration, animation, sort_order } = req.body;

  // Save banner images to media DB for persistence
  function saveBannerImg(fileObj) {
    if (!fileObj) return '';
    const mid = uuidv4b();
    const url = `/api/media/img/${mid}`;
    db.prepare(`INSERT INTO media (id,filename,original_name,mimetype,size,url,data,folder) VALUES (?,?,?,?,?,?,?,?)`)
      .run(mid, fileObj.originalname, fileObj.originalname, fileObj.mimetype, fileObj.size, url, fileObj.buffer.toString('base64'), 'banners');
    return url;
  }

  const desktop_image = saveBannerImg(req.files?.desktop_image?.[0]);
  const mobile_image  = saveBannerImg(req.files?.mobile_image?.[0]);
  const id = uuidv4b();
  db.prepare(`INSERT INTO banners (id,title,subtitle,heading,subheading,button_text,button_url,desktop_image,mobile_image,overlay_opacity,text_position,type,sort_order,slide_duration,animation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, title, subtitle || null, heading || null, subheading || null, button_text || null, button_url || null, desktop_image, mobile_image, parseFloat(overlay_opacity) || 0.3, text_position || 'center', type || 'hero', parseInt(sort_order) || 0, parseInt(slide_duration) || 5000, animation || 'fade');
  res.status(201).json({ message: 'Banner created', id });
});

router.put('/admin/banners/:id', adminAuth, bannerUpload.fields([{ name: 'desktop_image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner not found' });
  const body = req.body;
  const { v4: uuidv4p } = require('uuid');

  function saveBannerImg(fileObj) {
    if (!fileObj) return null;
    const mid = uuidv4p();
    const url = `/api/media/img/${mid}`;
    db.prepare(`INSERT INTO media (id,filename,original_name,mimetype,size,url,data,folder) VALUES (?,?,?,?,?,?,?,?)`)
      .run(mid, fileObj.originalname, fileObj.originalname, fileObj.mimetype, fileObj.size, url, fileObj.buffer.toString('base64'), 'banners');
    return url;
  }

  const desktop_image = saveBannerImg(req.files?.desktop_image?.[0]) || existing.desktop_image;
  const mobile_image  = saveBannerImg(req.files?.mobile_image?.[0])  || existing.mobile_image;
  db.prepare(`UPDATE banners SET title=?,subtitle=?,heading=?,subheading=?,button_text=?,button_url=?,desktop_image=?,mobile_image=?,overlay_opacity=?,text_position=?,sort_order=?,slide_duration=?,animation=?,is_active=?,updated_at=datetime('now') WHERE id=?`).run(body.title || existing.title, body.subtitle || existing.subtitle, body.heading || existing.heading, body.subheading || existing.subheading, body.button_text || existing.button_text, body.button_url || existing.button_url, desktop_image, mobile_image, parseFloat(body.overlay_opacity) || existing.overlay_opacity, body.text_position || existing.text_position, parseInt(body.sort_order) || existing.sort_order, parseInt(body.slide_duration) || existing.slide_duration, body.animation || existing.animation, body.is_active === 'false' ? 0 : 1, req.params.id);
  res.json({ message: 'Banner updated' });
});

router.delete('/admin/banners/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ message: 'Banner deleted' });
});

// Homepage sections
router.get('/homepage-sections', (req, res) => {
  const db = getDB();
  const sections = db.prepare('SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY sort_order ASC').all();
  res.json({ sections: sections.map(s => ({ ...s, config: JSON.parse(s.config || '{}') })) });
});

router.get('/admin/homepage-sections', adminAuth, (req, res) => {
  const db = getDB();
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC').all();
  res.json({ sections: sections.map(s => ({ ...s, config: JSON.parse(s.config || '{}') })) });
});

router.put('/admin/homepage-sections/:id', adminAuth, (req, res) => {
  const db = getDB();
  const { title, subtitle, config, is_active, sort_order } = req.body;
  db.prepare(`UPDATE homepage_sections SET title=?,subtitle=?,config=?,is_active=?,sort_order=?,updated_at=datetime('now') WHERE id=?`).run(title, subtitle, JSON.stringify(config || {}), is_active ? 1 : 0, parseInt(sort_order) || 0, req.params.id);
  res.json({ message: 'Section updated' });
});

// Menu
router.get('/menu/:location', (req, res) => {
  const db = getDB();
  const menu = db.prepare('SELECT * FROM menus WHERE location = ?').get(req.params.location);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  res.json({ menu: { ...menu, items: JSON.parse(menu.items || '[]') } });
});

router.put('/admin/menu/:location', adminAuth, (req, res) => {
  const db = getDB();
  const { items } = req.body;
  db.prepare(`UPDATE menus SET items=?, updated_at=datetime('now') WHERE location=?`).run(JSON.stringify(items), req.params.location);
  res.json({ message: 'Menu updated' });
});

// Pages
router.get('/pages/:slug', (req, res) => {
  const db = getDB();
  const page = db.prepare('SELECT * FROM pages WHERE slug = ? AND is_published = 1').get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json({ page });
});

router.get('/admin/pages', adminAuth, (req, res) => {
  const db = getDB();
  res.json({ pages: db.prepare('SELECT * FROM pages').all() });
});

router.put('/admin/pages/:id', adminAuth, (req, res) => {
  const db = getDB();
  const { title, content, meta_title, meta_description, is_published } = req.body;
  db.prepare(`UPDATE pages SET title=?,content=?,meta_title=?,meta_description=?,is_published=?,updated_at=datetime('now') WHERE id=?`).run(title, content, meta_title || null, meta_description || null, is_published ? 1 : 0, req.params.id);
  res.json({ message: 'Page updated' });
});

module.exports = router;
