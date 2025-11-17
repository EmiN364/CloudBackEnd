-- Initialize the sale_products table for CloudBackEnd
-- This script creates the sale_products table to track products in each sale
-- Currently one-to-one relationship but designed for future cart functionality

CREATE TABLE IF NOT EXISTS sale_products(
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (product_id, sale_id),
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_products_sale_id ON sale_products(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_products_product_id ON sale_products(product_id);
