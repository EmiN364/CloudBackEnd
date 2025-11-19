-- Initialize the database schema for CloudBackEnd
-- This script creates the users table with all necessary fields

CREATE TABLE IF NOT EXISTS users(
    id SERIAL NOT NULL PRIMARY KEY,
    cognito_sub TEXT NOT NULL UNIQUE,  -- Cognito user ID (sub)
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_number TEXT,
    given_name TEXT,
    family_name TEXT,
    username TEXT,
    cognito_username TEXT,
    is_seller BOOLEAN NOT NULL DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    address VARCHAR(255) DEFAULT '',
    profile_picture TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted);
CREATE INDEX IF NOT EXISTS idx_users_is_seller ON users(is_seller);
