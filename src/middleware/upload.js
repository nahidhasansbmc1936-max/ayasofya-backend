const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');
const fs     = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

// ── Disk storage (used locally / when persistent disk is available) ──────────
function createDiskStorage(folder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

// ── Memory storage — files stored as Buffer in req.file.buffer ───────────────
// Used for images that must persist in the database (Render Free has no persistent disk)
const memoryStorage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
}

// ── Exports ───────────────────────────────────────────────────────────────────
// productUpload, bannerUpload, generalUpload → memory storage (DB-persisted)
// Others keep disk storage as before (no change to those flows)

const productUpload  = multer({ storage: memoryStorage,                    fileFilter, limits: { fileSize: 5  * 1024 * 1024 } });
const bannerUpload   = multer({ storage: memoryStorage,                    fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const generalUpload  = multer({ storage: memoryStorage,                    fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const categoryUpload = multer({ storage: createDiskStorage('categories'),  fileFilter, limits: { fileSize: 5  * 1024 * 1024 } });
const blogUpload     = multer({ storage: memoryStorage,                    fileFilter, limits: { fileSize: 5  * 1024 * 1024 } });
const mediaUpload    = multer({ storage: memoryStorage,                    fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { productUpload, bannerUpload, categoryUpload, blogUpload, mediaUpload, generalUpload };
