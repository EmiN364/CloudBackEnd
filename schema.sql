CREATE TABLE IF NOT EXISTS users(
    id SERIAL NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password CHAR(60),
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    is_seller BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    locale VARCHAR(255) NOT NULL DEFAULT 'en',
    address VARCHAR(255) DEFAULT ''
);

CREATE TABLE IF NOT EXISTS images(
    id SERIAL NOT NULL PRIMARY KEY,
    image BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS products(
    id SERIAL NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    seller_id INTEGER,
    image_id INTEGER,
    price DOUBLE PRECISION NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY(seller_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(image_id) REFERENCES images(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales(
    id SERIAL NOT NULL PRIMARY KEY,
    user_id INTEGER,
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DOUBLE PRECISION NOT NULL,
    status TEXT,
    note TEXT,
    invoice_id BIGINT,
    address VARCHAR(255) NOT NULL DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales_products(
    product_id INTEGER NOT NULL,
    sale_id INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (product_id, sale_id),
    FOREIGN KEY(product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_products(
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (product_id, user_id),
    FOREIGN KEY(product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tokens(
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'confirm' or 'reset'
    primary key (token, email),
    foreign key (email) references users(email) on update cascade on delete cascade
);

CREATE TABLE IF NOT EXISTS stores
(
    store_id INTEGER NOT NULL PRIMARY KEY,
    store_name TEXT,
    description TEXT,
    store_image_id INTEGER,
    cover_image_id INTEGER,
    cbu varchar(255),
    FOREIGN KEY (store_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(store_image_id) REFERENCES images(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(cover_image_id) REFERENCES images(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications
(
    id SERIAL NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    type varchar(255) DEFAULT 'OTHER',
    product_id BIGINT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_likes
(
    product_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (product_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews
(
    id SERIAL NOT NULL PRIMARY KEY,
    description TEXT,
    rating INTEGER NOT NULL,
    product_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products ON UPDATE CASCADE ON DELETE CASCADE
);