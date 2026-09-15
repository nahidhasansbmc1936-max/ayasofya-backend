const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../db/database');
const { adminAuth } = require('../middleware/auth');
const { mediaUpload } = require('../middleware/upload');

router.post('/upload', adminAuth, mediaUpload.array('files', 20), (req, res) => {
  const db = getDB();
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  const { folder = 'general', alt_text } = req.body;
  const inserted = [];
  for (const file of req.files) {
    const id = uuidv4();
    const url = `/uploads/media/${file.filename}`;
    db.prepare(`INSERT INTO media (id,filename,original_name,mimetype,size,url,folder,alt_text) VALUES (?,?,?,?,?,?,?,?)`).run(id, file.filename, file.originalname, file.mimetype, file.size, url, folder, alt_text || null);
    inserted.push({ id, url, filename: file.filename, original_name: file.originalname, size: file.size });
  }
  res.status(201).json({ message: 'Files uploaded', files: inserted });
});

router.get('/', adminAuth, (req, res) => {
  const db = getDB();
  const { folder, page = 1, limit = 40 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = [];
  const params = [];
  if (folder) { where.push('folder = ?'); params.push(folder); }
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM media ${whereStr}`).get(...params).cnt;
  const files = db.prepare(`SELECT * FROM media ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  res.json({ files, total });
});

router.delete('/:id', adminAuth, (req, res) => {
  const db = getDB();
  const file = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(process.env.UPLOADS_DIR || './uploads', 'media', file.filename);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
  res.json({ message: 'File deleted' });
});

router.put('/:id', adminAuth, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE media SET alt_text = ? WHERE id = ?').run(req.body.alt_text, req.params.id);
  res.json({ message: 'Updated' });
});

module.exports = router;
