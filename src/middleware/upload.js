const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

function createStorage(folder) {
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

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
}

const productUpload = multer({ storage: createStorage('products'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const bannerUpload = multer({ storage: createStorage('banners'), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const categoryUpload = multer({ storage: createStorage('categories'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const blogUpload = multer({ storage: createStorage('blog'), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const mediaUpload = multer({ storage: createStorage('media'), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const generalUpload = multer({ storage: createStorage('general'), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { productUpload, bannerUpload, categoryUpload, blogUpload, mediaUpload, generalUpload };
