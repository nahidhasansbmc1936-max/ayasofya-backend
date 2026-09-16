require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getDB } = require('./db/database');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — allow Cloudflare Pages (any *.pages.dev), explicit FRONTEND_URL, and localhost dev
const allowedOrigins = [
  process.env.FRONTEND_URL,   // e.g. https://ayasofya-bd.pages.dev  (set in Render env vars)
  'https://ayasofya-bd.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, curl)
    if (!origin) return callback(null, true);
    // Allow any Cloudflare Pages preview/production subdomain
    if (origin.endsWith('.pages.dev')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Block everything else
    return callback(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  credentials: true
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth', authLimiter);
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

const uploadsPath = path.resolve(process.env.UPLOADS_DIR || './uploads');
app.use('/uploads', express.static(uploadsPath));

getDB();
seed().catch(console.error);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/media', require('./routes/media'));
app.use('/api/attributes', require('./routes/attributes'));
app.use('/api/admin-users', require('./routes/adminUsers'));
app.use('/api/setup',      require('./routes/setup'));

app.get('/api/admin/dashboard', require('./middleware/auth').adminAuth, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  res.json({
    stats: {
      total_orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
      today_orders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = ?`).get(today).c,
      total_revenue: db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status NOT IN ('cancelled','returned')`).get().s,
      today_revenue: db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM orders WHERE DATE(created_at) = ? AND status NOT IN ('cancelled','returned')`).get(today).s,
      pending_orders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending'`).get().c,
      total_customers: db.prepare('SELECT COUNT(*) as c FROM customers WHERE is_guest = 0').get().c,
      total_products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
      low_stock: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock_quantity > 0 AND stock_quantity <= 5').get().c,
    }
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', brand: 'AYASOFYA', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AYASOFYA Backend running on http://localhost:${PORT}`);
  console.log(`📦 API: http://localhost:${PORT}/api`);
  console.log(`🔑 Admin: admin@ayasofya.com / admin123\n`);
});

module.exports = app;
