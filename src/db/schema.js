const schema = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'manager',
  avatar TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE,
  phone TEXT UNIQUE, password TEXT, avatar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, is_guest INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home', full_name TEXT NOT NULL, phone TEXT NOT NULL,
  district TEXT NOT NULL, thana TEXT NOT NULL, area TEXT, full_address TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, type TEXT DEFAULT 'text',
  group_name TEXT DEFAULT 'general', updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  description TEXT, image TEXT, parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
  meta_title TEXT, meta_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  image TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attributes (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'select', sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attribute_values (
  id TEXT PRIMARY KEY, attribute_id TEXT NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL, color_code TEXT, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  sku TEXT UNIQUE, short_description TEXT, description TEXT, specifications TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  regular_price REAL NOT NULL DEFAULT 0, sale_price REAL,
  discount_percent REAL DEFAULT 0, stock_quantity INTEGER NOT NULL DEFAULT 0,
  stock_status TEXT NOT NULL DEFAULT 'in_stock', manage_stock INTEGER NOT NULL DEFAULT 1,
  low_stock_threshold INTEGER DEFAULT 5, weight REAL,
  images TEXT DEFAULT '[]', video_url TEXT, tags TEXT DEFAULT '[]',
  is_featured INTEGER NOT NULL DEFAULT 0, is_bestseller INTEGER NOT NULL DEFAULT 0,
  is_new_arrival INTEGER NOT NULL DEFAULT 0, is_on_offer INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1, rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0, sold_count INTEGER DEFAULT 0,
  meta_title TEXT, meta_description TEXT, delivery_info TEXT, return_policy TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variations (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT, attributes TEXT NOT NULL DEFAULT '{}',
  regular_price REAL, sale_price REAL, stock_quantity INTEGER DEFAULT 0,
  image TEXT, is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT NOT NULL,
  mimetype TEXT NOT NULL, size INTEGER NOT NULL, url TEXT NOT NULL,
  folder TEXT DEFAULT 'general', alt_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT,
  heading TEXT, subheading TEXT, button_text TEXT, button_url TEXT,
  desktop_image TEXT, mobile_image TEXT, overlay_opacity REAL DEFAULT 0.3,
  text_position TEXT DEFAULT 'center', type TEXT DEFAULT 'hero',
  is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0,
  slide_duration INTEGER DEFAULT 5000, animation TEXT DEFAULT 'fade',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS homepage_sections (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  title TEXT, subtitle TEXT, config TEXT DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', discount_value REAL NOT NULL,
  minimum_order REAL DEFAULT 0, maximum_discount REAL,
  usage_limit INTEGER, used_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1, start_date TEXT, expiry_date TEXT,
  product_ids TEXT DEFAULT '[]', category_ids TEXT DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
  customer_email TEXT, district TEXT NOT NULL, thana TEXT NOT NULL,
  area TEXT, full_address TEXT NOT NULL, order_note TEXT,
  items TEXT NOT NULL DEFAULT '[]', subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL DEFAULT 0, coupon_code TEXT,
  delivery_charge REAL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  whatsapp_sent INTEGER DEFAULT 0, invoice_url TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, note TEXT, changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT, body TEXT, images TEXT DEFAULT '[]',
  is_verified_purchase INTEGER DEFAULT 0, is_approved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id TEXT PRIMARY KEY, coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id), order_id TEXT REFERENCES orders(id),
  used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  excerpt TEXT, content TEXT, featured_image TEXT,
  category_id TEXT REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  tags TEXT DEFAULT '[]', is_published INTEGER DEFAULT 0, views INTEGER DEFAULT 0,
  meta_title TEXT, meta_description TEXT, published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT UNIQUE NOT NULL,
  items TEXT DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  content TEXT, meta_title TEXT, meta_description TEXT,
  is_published INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
  is_active INTEGER DEFAULT 1, subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(is_published);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
`;

module.exports = schema;
