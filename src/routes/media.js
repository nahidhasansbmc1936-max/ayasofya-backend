/**
 * MEDIA / PHOTO GALLERY
 *
 * Images are stored as base64 in the `media.data` column — completely
 * independent of the filesystem.  This means they survive Render restarts,
 * deploys, and Free-plan ephemeral-disk wipes.
 *
 * Every uploaded image gets a permanent URL:
 *   /api/media/img/:id
 *
 * That URL is what gets saved in products.images[], banners, blog_posts etc.
 * The URL never expires and never disappears — it is served directly from the DB.
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { mediaUpload } = require('../middleware/upload');

// ── Serve image by ID (public — no auth needed for display) ──────────────────
router.get('/img/:id', (req, res) => {
  const db    = getDB();
  const media = db.prepare('SELECT data, mimetype, original_name FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!media || !media.data) return res.status(404).send('Not found');

  const buf = Buffer.from(media.data, 'base64');
  res.set('Content-Type', media.mimetype);
  res.set('Content-Length', buf.length);
  res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
  res.send(buf);
});

// ── Upload one or more images (admin only) ────────────────────────────────────
router.post('/upload', adminAuth, mediaUpload.array('files', 20), (req, res) => {
  const db = getDB();
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const { folder = 'general', alt_text } = req.body;
  const inserted = [];

  for (const file of req.files) {
    const id      = uuidv4();
    const b64     = file.buffer.toString('base64');
    const url     = `/api/media/img/${id}`;   // permanent DB-served URL

    db.prepare(
      `INSERT INTO media (id, filename, original_name, mimetype, size, url, data, folder, alt_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, file.originalname, file.originalname, file.mimetype, file.size, url, b64, folder, alt_text || null);

    inserted.push({ id, url, filename: file.originalname, original_name: file.originalname, size: file.size, mimetype: file.mimetype });
  }

  res.status(201).json({ message: 'Uploaded', files: inserted });
});

// ── List all media (admin) ────────────────────────────────────────────────────
router.get('/', adminAuth, (req, res) => {
  const db = getDB();
  const { folder, page = 1, limit = 40 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ["deleted_at IS NULL"], params = [];
  if (folder) { where.push('folder = ?'); params.push(folder); }
  const whereStr = `WHERE ${where.join(' AND ')}`;

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM media ${whereStr}`).get(...params).cnt;
  // Do NOT return `data` in list — too large; use url to display
  const files = db.prepare(
    `SELECT id, filename, original_name, mimetype, size, url, folder, alt_text, created_at
     FROM media ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);

  res.json({ files, total });
});

// ── Update alt text ───────────────────────────────────────────────────────────
router.put('/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE media SET alt_text = ? WHERE id = ?').run(req.body.alt_text, req.params.id);
  res.json({ message: 'Updated' });
});

// ── Soft delete (move to trash) ───────────────────────────────────────────────
router.delete('/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare("UPDATE media SET deleted_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Moved to trash' });
});

// ── Permanent delete (hard) ───────────────────────────────────────────────────
router.delete('/:id/permanent', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
  res.json({ message: 'Permanently deleted' });
});

// ── Restore from trash ────────────────────────────────────────────────────────
router.post('/:id/restore', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE media SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ message: 'Restored' });
});

module.exports = router;
