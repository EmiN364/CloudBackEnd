-- Initialize the stores table for CloudBackEnd
-- This script creates the stores table for seller stores

CREATE TABLE IF NOT EXISTS stores(
    store_id SERIAL NOT NULL PRIMARY KEY,
    store_name TEXT NOT NULL,
    description TEXT,
    store_image_url TEXT,
    cover_image_url TEXT,
    FOREIGN KEY (store_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
