-- Migration: initial schema
-- Created at: 2025-09-16T00:00:00Z
-- Description: Initial database schema for e-commerce application

-- Include the full schema
DROP TABLE IF EXISTS blog_post_categories;
DROP TABLE IF EXISTS blog_posts;
DROP TABLE IF EXISTS blog_categories;
DROP TABLE IF EXISTS shipping_methods;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS product_variant_attributes;
DROP TABLE IF EXISTS product_attribute_values;
DROP TABLE IF EXISTS product_attributes;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_category_relationships;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS users;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- User Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    address_type TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER,
    image_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES product_categories (id) ON DELETE SET NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    compare_at_price REAL,
    cost_price REAL,
    weight REAL,
    weight_unit TEXT,
    featured INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Product-Category Relationships (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_category_relationships (
    product_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories (id) ON DELETE CASCADE
);

-- Product Images Table
CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    compare_at_price REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Product Attributes Table (e.g., Color, Size)
CREATE TABLE IF NOT EXISTS product_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);

-- Product Attribute Values Table (e.g., Red, Blue, S, M, L)
CREATE TABLE IF NOT EXISTS product_attribute_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attribute_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (attribute_id, value),
    FOREIGN KEY (attribute_id) REFERENCES product_attributes (id) ON DELETE CASCADE
);

-- Product Variant Attributes (Many-to-Many between variants and attribute values)
CREATE TABLE IF NOT EXISTS product_variant_attributes (
    variant_id INTEGER NOT NULL,
    attribute_value_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (variant_id, attribute_value_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE,
    FOREIGN KEY (attribute_value_id) REFERENCES product_attribute_values (id) ON DELETE CASCADE
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    reorder_quantity INTEGER NOT NULL DEFAULT 10,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
);

-- Carts Table
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    guest_token TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CHECK ((user_id IS NOT NULL) OR (guest_token IS NOT NULL))
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id TEXT NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (cart_id, product_variant_id),
    FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal REAL NOT NULL,
    shipping_fee REAL NOT NULL,
    tax_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    shipping_address_id INTEGER NOT NULL,
    billing_address_id INTEGER NOT NULL,
    shipping_method TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses (id) ON DELETE RESTRICT,
    FOREIGN KEY (billing_address_id) REFERENCES addresses (id) ON DELETE RESTRICT
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_variant_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    product_name TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    FOREIGN KEY (product_variant_id) REFERENCES product_variants (id) ON DELETE RESTRICT
);

-- Order Status History Table
CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    transaction_id TEXT,
    payment_details TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id INTEGER NOT NULL,
    issue_date INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued',
    amount REAL NOT NULL,
    tax_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- Shipping Methods Table
CREATE TABLE IF NOT EXISTS shipping_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    base_price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    estimated_days INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Blog Categories Table
CREATE TABLE IF NOT EXISTS blog_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    author_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT
);

-- Blog Post Categories Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS blog_post_categories (
    post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES blog_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES blog_categories (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product_variant_id ON inventory (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices (order_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);