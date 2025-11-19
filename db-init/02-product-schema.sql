-- Initialize the products table for CloudBackEnd
-- This script creates the products table matching the existing schema pattern

CREATE TABLE IF NOT EXISTS products(
    id SERIAL NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    seller_id INTEGER,
    image_url TEXT,
    price DOUBLE PRECISION NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY(seller_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);
CREATE INDEX IF NOT EXISTS idx_products_paused ON products(paused);