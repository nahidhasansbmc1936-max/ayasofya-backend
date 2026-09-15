const { getDB } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');

function slug(str) {
  return slugify(str, { lower: true, strict: true });
}

async function seed() {
  const db = getDB();
  console.log('🌱 Seeding AYASOFYA database...');

  // ─── Admin Users ────────────────────────────────────────────
  const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE email = ?').get('admin@ayasofya.com');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO admin_users (id, name, email, password, role) VALUES (?,?,?,?,?)`).run(
      uuidv4(), 'Super Admin', 'admin@ayasofya.com', hash, 'super_admin'
    );
    console.log('✅ Admin created: admin@ayasofya.com / admin123');
  }

  // ─── Settings ───────────────────────────────────────────────
  const defaultSettings = [
    ['site_name', 'AYASOFYA', 'text', 'general'],
    ['site_tagline', 'Where Style Meets Elegance', 'text', 'general'],
    ['site_email', 'ayasofyabrand@gmail.com', 'text', 'general'],
    ['site_phone', '+880 1700-000000', 'text', 'general'],
    ['site_whatsapp', '+8801700000000', 'text', 'general'],
    ['site_address', 'Dhaka, Bangladesh', 'text', 'general'],
    ['primary_color', '#1a3a2a', 'color', 'appearance'],
    ['secondary_color', '#f5c518', 'color', 'appearance'],
    ['accent_color', '#fffbe6', 'color', 'appearance'],
    ['header_bg', '#1a3a2a', 'color', 'appearance'],
    ['footer_bg', '#0d2218', 'color', 'appearance'],
    ['button_color', '#f5c518', 'color', 'appearance'],
    ['font_family', 'Inter', 'text', 'appearance'],
    ['border_radius', '8px', 'text', 'appearance'],
    ['delivery_inside_dhaka', '60', 'number', 'delivery'],
    ['delivery_outside_dhaka', '120', 'number', 'delivery'],
    ['free_delivery_above', '2000', 'number', 'delivery'],
    ['payment_cod', '1', 'boolean', 'payment'],
    ['payment_bkash', '1', 'boolean', 'payment'],
    ['payment_nagad', '1', 'boolean', 'payment'],
    ['payment_card', '0', 'boolean', 'payment'],
    ['bkash_number', '01700-000000', 'text', 'payment'],
    ['nagad_number', '01700-000000', 'text', 'payment'],
    ['facebook_url', 'https://facebook.com/ayasofya', 'text', 'social'],
    ['instagram_url', 'https://instagram.com/ayasofya', 'text', 'social'],
    ['youtube_url', 'https://youtube.com/@ayasofya', 'text', 'social'],
    ['seo_title', 'AYASOFYA - Premium Fashion & Lifestyle', 'text', 'seo'],
    ['seo_description', 'Discover premium fashion, clothing, perfumes, watches & more at AYASOFYA. Where style meets elegance.', 'text', 'seo'],
    ['about_text', 'AYASOFYA is a premium fashion & lifestyle brand offering curated collections of clothing, perfumes, watches, shoes and more. We believe in quality, elegance and the art of dressing well.', 'textarea', 'general'],
    ['order_prefix', 'AYA', 'text', 'order'],
    ['order_start_number', '10001', 'number', 'order'],
    ['show_reviews', '1', 'boolean', 'product'],
    ['review_auto_approve', '0', 'boolean', 'product'],
    ['low_stock_threshold', '5', 'number', 'inventory'],
  ];
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value, type, group_name) VALUES (?,?,?,?)`);
  for (const s of defaultSettings) insertSetting.run(...s);

  // ─── Categories ─────────────────────────────────────────────
  const categories = [
    { name: 'Cloth', slug: 'cloth', sort: 1, children: [
      { name: 'Jubba', slug: 'jubba' }, { name: 'Panjabi', slug: 'panjabi' },
      { name: 'Three Piece', slug: 'three-piece' }, { name: 'Katan', slug: 'katan' },
      { name: 'T-Shirt', slug: 't-shirt' }, { name: 'Waistcoat', slug: 'waistcoat' },
    ]},
    { name: "Women's Collection", slug: 'womens-collection', sort: 2, children: [
      { name: 'Abaya', slug: 'abaya' }, { name: 'Hijab', slug: 'hijab' },
      { name: 'Salat Hijab', slug: 'salat-hijab' }, { name: 'Three Piece', slug: 'womens-three-piece' },
      { name: 'Dresses', slug: 'dresses' },
    ]},
    { name: "Men's Collection", slug: 'mens-collection', sort: 3, children: [
      { name: "Men's Shirt", slug: 'mens-shirt' }, { name: "Men's Pants", slug: 'mens-pants' },
      { name: "Men's Kurta", slug: 'mens-kurta' },
    ]},
    { name: 'Perfume', slug: 'perfume', sort: 4, children: [
      { name: 'Arabic Perfume', slug: 'arabic-perfume' }, { name: 'Premium Perfume', slug: 'premium-perfume' },
      { name: "Men's Perfume", slug: 'mens-perfume' }, { name: "Women's Perfume", slug: 'womens-perfume' },
    ]},
    { name: 'Watch', slug: 'watch', sort: 5, children: [
      { name: "Men's Watch", slug: 'mens-watch' }, { name: "Women's Watch", slug: 'womens-watch' },
      { name: 'Islamic Watch', slug: 'islamic-watch' },
    ]},
    { name: 'Shoes', slug: 'shoes', sort: 6, children: [
      { name: "Men's Shoes", slug: 'mens-shoes' }, { name: "Women's Shoes", slug: 'womens-shoes' },
      { name: 'Sandals', slug: 'sandals' }, { name: 'Slippers', slug: 'slippers' },
    ]},
    { name: 'Sunnah', slug: 'sunnah', sort: 7, children: [
      { name: 'Sunnah Products', slug: 'sunnah-products' },
      { name: 'Sunnah Gift Collection', slug: 'sunnah-gift' },
    ]},
  ];

  const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name, slug, parent_id, sort_order) VALUES (?,?,?,?,?)`);
  const catIds = {};
  for (const cat of categories) {
    const parentId = uuidv4();
    catIds[cat.slug] = parentId;
    insertCat.run(parentId, cat.name, cat.slug, null, cat.sort);
    for (const child of (cat.children || [])) {
      insertCat.run(uuidv4(), child.name, child.slug, parentId, 0);
    }
  }

  // ─── Attributes ─────────────────────────────────────────────
  const attributes = [
    { name: 'Size', slug: 'size', values: ['XS','S','M','L','XL','XXL','3XL','Free Size'] },
    { name: 'Color', slug: 'color', values: ['Black','White','Green','Dark Green','Golden','Brown','Blue','Red','Navy','Grey','Cream','Beige'] },
    { name: 'Fabric', slug: 'fabric', values: ['Cotton','Katan','Silk','Linen','Chiffon','Georgette','Muslin','Synthetic'] },
    { name: 'Fragrance', slug: 'fragrance', values: ['Oud','Musk','Rose','Jasmine','Sandalwood','Amber'] },
    { name: 'Shoe Size', slug: 'shoe-size', values: ['36','37','38','39','40','41','42','43','44','45'] },
    { name: 'Watch Strap', slug: 'watch-strap', values: ['Leather','Metal','Rubber','Fabric'] },
  ];
  const insertAttr = db.prepare(`INSERT OR IGNORE INTO attributes (id, name, slug, type) VALUES (?,?,?,?)`);
  const insertAttrVal = db.prepare(`INSERT OR IGNORE INTO attribute_values (id, attribute_id, value, sort_order) VALUES (?,?,?,?)`);
  for (const attr of attributes) {
    const attrId = uuidv4();
    insertAttr.run(attrId, attr.name, attr.slug, 'select');
    attr.values.forEach((v, i) => insertAttrVal.run(uuidv4(), attrId, v, i));
  }

  // ─── Sample Products ────────────────────────────────────────
  const products = [
    { name: 'Premium Katan Jubba', category: 'jubba', price: 2499, sale: 1999, description: 'Premium quality Katan fabric Jubba with fine stitching and elegant design. Perfect for Eid, Friday prayers and special occasions.', tags: ['jubba','katan','premium','eid'], featured: 1, bestseller: 1, new_arrival: 1, stock: 50 },
    { name: 'Classic White Panjabi', category: 'panjabi', price: 1299, sale: 999, description: 'Classic white Panjabi made from premium cotton fabric. Comfortable for daily wear and special occasions.', tags: ['panjabi','white','cotton'], featured: 1, new_arrival: 1, stock: 35 },
    { name: 'Luxury Abaya - Black', category: 'abaya', price: 3499, sale: 2799, description: 'Luxurious black Abaya with golden embroidery. Made from premium fabric for maximum comfort and elegance.', tags: ['abaya','black','luxury','women'], featured: 1, bestseller: 1, stock: 25 },
    { name: 'Premium Hijab Set', category: 'hijab', price: 899, sale: 699, description: 'Premium quality Hijab with matching inner cap. Available in multiple colors.', tags: ['hijab','premium','women'], bestseller: 1, new_arrival: 1, stock: 100 },
    { name: 'Arabic Oud Perfume - 50ml', category: 'arabic-perfume', price: 2999, sale: 2499, description: 'Authentic Arabic Oud fragrance with rich, woody and smoky notes. Long-lasting 12+ hours wear.', tags: ['perfume','oud','arabic','luxury'], featured: 1, bestseller: 1, stock: 30 },
    { name: 'Rose Musk Perfume - 100ml', category: 'premium-perfume', price: 1999, sale: 1599, description: 'Premium Rose Musk perfume with floral and musky notes. Perfect for daily use.', tags: ['perfume','musk','rose'], bestseller: 1, new_arrival: 1, stock: 45 },
    { name: "Elegant Men's Watch - Gold", category: 'mens-watch', price: 4999, sale: 3999, description: "Elegant men's watch with golden stainless steel case and leather strap.", tags: ['watch','mens','gold'], featured: 1, new_arrival: 1, stock: 20 },
    { name: 'Premium Leather Shoes', category: 'mens-shoes', price: 3499, sale: 2799, description: 'Premium quality genuine leather shoes. Perfect for formal and casual occasions.', tags: ['shoes','leather','mens'], bestseller: 1, stock: 40 },
    { name: 'Sunnah Gift Box', category: 'sunnah-gift', price: 1499, sale: 1199, description: 'Curated Sunnah gift collection including Miswak, Attar, Black Seed Oil and more.', tags: ['sunnah','gift','islamic'], featured: 1, bestseller: 1, new_arrival: 1, stock: 60 },
    { name: "Women's Salat Hijab", category: 'salat-hijab', price: 599, sale: 449, description: 'Comfortable and easy-to-wear Salat Hijab. One size fits all.', tags: ['hijab','salat','prayer'], new_arrival: 1, stock: 150 },
    { name: 'Katan Three Piece', category: 'three-piece', price: 5999, sale: 4999, description: 'Premium Katan fabric three piece suit with intricate embroidery.', tags: ['three-piece','katan','eid'], featured: 1, new_arrival: 1, offer: 1, stock: 15 },
    { name: "Men's Cotton T-Shirt", category: 't-shirt', price: 799, sale: 599, description: '100% cotton premium T-shirt with modern fit. Available in multiple colors.', tags: ['t-shirt','cotton','mens'], bestseller: 1, stock: 200 },
  ];

  const insertProd = db.prepare(`INSERT OR IGNORE INTO products (id,name,slug,sku,short_description,description,category_id,regular_price,sale_price,discount_percent,stock_quantity,stock_status,tags,is_featured,is_bestseller,is_new_arrival,is_on_offer,is_published,delivery_info,return_policy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const deliveryInfo = 'Inside Dhaka: 60 TK | Outside Dhaka: 120 TK | Free delivery on orders above 2000 TK';
  const returnPolicy = '7-day easy return policy. Product must be in original condition.';

  for (const p of products) {
    const catRow = db.prepare('SELECT id FROM categories WHERE slug = ?').get(p.category);
    const catId = catRow ? catRow.id : null;
    const discount = p.sale ? Math.round(((p.price - p.sale) / p.price) * 100) : 0;
    insertProd.run(
      uuidv4(), p.name, slug(p.name), `AYA-${Math.random().toString(36).substr(2,8).toUpperCase()}`,
      p.description.substring(0, 100), p.description, catId,
      p.price, p.sale || null, discount, p.stock,
      p.stock > 0 ? 'in_stock' : 'out_of_stock',
      JSON.stringify(p.tags || []),
      p.featured || 0, p.bestseller || 0, p.new_arrival || 0, p.offer || 0, 1,
      deliveryInfo, returnPolicy
    );
  }

  // ─── Hero Banners ─────────────────────────────────────────
  const banners = [
    { title: 'Where Style Meets Elegance', subtitle: 'New Arrivals 2024', heading: 'WHERE STYLE\nMEETS ELEGANCE', subheading: 'Discover our Premium Fashion Collection', button_text: 'SHOP NOW', button_url: '/shop', sort_order: 1 },
    { title: "Women's Collection", subtitle: 'Modest & Beautiful', heading: "WOMEN'S COLLECTION", subheading: 'Premium Abaya, Hijab & More', button_text: 'EXPLORE NOW', button_url: '/category/womens-collection', sort_order: 2 },
    { title: 'Eid Special Offer', subtitle: 'Up to 40% OFF', heading: 'EID SPECIAL COLLECTION', subheading: 'Celebrate Eid with Premium Fashion', button_text: 'SHOP SALE', button_url: '/offers', sort_order: 3 },
  ];
  const insertBanner = db.prepare(`INSERT OR IGNORE INTO banners (id,title,subtitle,heading,subheading,button_text,button_url,desktop_image,mobile_image,sort_order,type,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`);
  for (const b of banners) insertBanner.run(uuidv4(), b.title, b.subtitle, b.heading, b.subheading, b.button_text, b.button_url, '', '', b.sort_order, 'hero');

  // ─── Homepage Sections ───────────────────────────────────
  const sections = [
    { name: 'Featured Categories', type: 'categories', title: 'Shop by Category', subtitle: 'Explore our curated collections', sort: 1 },
    { name: 'New Arrivals', type: 'new_arrivals', title: 'New Arrivals', subtitle: 'Fresh styles just landed', sort: 2 },
    { name: 'Best Sellers', type: 'bestsellers', title: 'Best Sellers', subtitle: 'Most loved by our customers', sort: 3 },
    { name: 'Special Offers', type: 'offers', title: 'Special Offers', subtitle: 'Exclusive deals up to 40% off', sort: 4 },
    { name: "Women's Collection", type: 'womens', title: "Women's Collection", subtitle: 'Modest fashion, maximum elegance', sort: 5 },
    { name: "Men's Collection", type: 'mens', title: "Men's Collection", subtitle: 'Style for every occasion', sort: 6 },
    { name: 'Perfume Collection', type: 'perfumes', title: 'Perfume Collection', subtitle: 'Arabic & Premium fragrances', sort: 7 },
    { name: 'Watch Collection', type: 'watches', title: 'Watch Collection', subtitle: 'Timeless elegance on your wrist', sort: 8 },
    { name: 'Shoes Collection', type: 'shoes', title: 'Shoes Collection', subtitle: 'Step up your style', sort: 9 },
    { name: 'Sunnah Collection', type: 'sunnah', title: 'Sunnah Collection', subtitle: 'Authentic Islamic lifestyle products', sort: 10 },
    { name: 'Customer Reviews', type: 'reviews', title: 'What Our Customers Say', subtitle: 'Trusted by thousands of happy customers', sort: 11 },
    { name: 'Newsletter', type: 'newsletter', title: 'Stay Updated', subtitle: 'Subscribe for exclusive offers', sort: 12 },
  ];
  const insertSection = db.prepare(`INSERT OR IGNORE INTO homepage_sections (id,name,type,title,subtitle,sort_order,is_active) VALUES (?,?,?,?,?,?,1)`);
  for (const s of sections) insertSection.run(uuidv4(), s.name, s.type, s.title, s.subtitle, s.sort);

  // ─── Navigation Menu ─────────────────────────────────────
  const navItems = [
    { label: 'Home', url: '/' },
    { label: 'All Products', url: '/shop' },
    { label: 'Cloth', url: '/category/cloth', children: [
      { label: 'Jubba', url: '/category/jubba' }, { label: 'Panjabi', url: '/category/panjabi' },
      { label: 'Three Piece', url: '/category/three-piece' }, { label: 'Katan', url: '/category/katan' },
      { label: 'T-Shirt', url: '/category/t-shirt' }, { label: 'Waistcoat', url: '/category/waistcoat' },
    ]},
    { label: "Women's Collection", url: '/category/womens-collection', children: [
      { label: 'Abaya', url: '/category/abaya' }, { label: 'Hijab', url: '/category/hijab' },
      { label: 'Salat Hijab', url: '/category/salat-hijab' }, { label: 'Dresses', url: '/category/dresses' },
    ]},
    { label: "Men's Collection", url: '/category/mens-collection' },
    { label: 'Offer Sale', url: '/offers' },
    { label: 'Perfume', url: '/category/perfume', children: [
      { label: 'Arabic Perfume', url: '/category/arabic-perfume' },
      { label: 'Premium Perfume', url: '/category/premium-perfume' },
    ]},
    { label: 'Watch', url: '/category/watch' },
    { label: 'Shoes', url: '/category/shoes' },
    { label: 'Sunnah', url: '/category/sunnah' },
    { label: 'Blog', url: '/blog' },
  ];
  db.prepare(`INSERT OR IGNORE INTO menus (id, name, location, items) VALUES (?,?,?,?)`).run(uuidv4(), 'Main Navigation', 'main_nav', JSON.stringify(navItems));

  // ─── Pages ───────────────────────────────────────────────
  const pages = [
    { title: 'About Us', slug: 'about-us', content: '<h2>About AYASOFYA</h2><p>AYASOFYA is a premium fashion & lifestyle brand offering curated collections for the modern Muslim.</p>' },
    { title: 'Contact Us', slug: 'contact-us', content: '<h2>Contact Us</h2><p>We would love to hear from you. Email us at ayasofyabrand@gmail.com</p>' },
    { title: 'Privacy Policy', slug: 'privacy-policy', content: '<h2>Privacy Policy</h2><p>Your privacy is important to us. We collect only necessary information to process your orders.</p>' },
    { title: 'Return & Refund Policy', slug: 'return-refund-policy', content: '<h2>Return & Refund Policy</h2><p>We offer 7-day easy returns on all products in original condition.</p>' },
    { title: 'Terms & Conditions', slug: 'terms-conditions', content: '<h2>Terms & Conditions</h2><p>By using our website and placing orders, you agree to our terms.</p>' },
    { title: 'FAQ', slug: 'faq', content: '<h2>Frequently Asked Questions</h2><p>Find answers to common questions about ordering, delivery and returns.</p>' },
  ];
  const insertPage = db.prepare(`INSERT OR IGNORE INTO pages (id, title, slug, content) VALUES (?,?,?,?)`);
  for (const p of pages) insertPage.run(uuidv4(), p.title, p.slug, p.content);

  // ─── Blog Categories ─────────────────────────────────────
  db.prepare(`INSERT OR IGNORE INTO blog_categories (id, name, slug) VALUES (?,?,?)`).run(uuidv4(), 'Fashion Tips', 'fashion-tips');
  db.prepare(`INSERT OR IGNORE INTO blog_categories (id, name, slug) VALUES (?,?,?)`).run(uuidv4(), 'Style Guide', 'style-guide');
  db.prepare(`INSERT OR IGNORE INTO blog_categories (id, name, slug) VALUES (?,?,?)`).run(uuidv4(), 'Islamic Fashion', 'islamic-fashion');

  console.log('✅ AYASOFYA database seeded successfully!');
}

module.exports = { seed };
