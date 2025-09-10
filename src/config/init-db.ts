import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './database.js';

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const result = await pool.query(query, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Get list of tables that should exist based on schema.sql
 */
function getRequiredTables(): string[] {
  return [
    'users',
    'products', 
    'sales',
    'sales_products',
    'cart_products',
    'tokens',
    'stores',
    'notifications',
    'product_likes',
    'reviews'
  ];
}

/**
 * Read and execute the schema.sql file
 */
async function executeSchemaScript(): Promise<void> {
  try {
    // Read the schema.sql file
    const schemaPath = join(process.cwd(), 'schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    // Execute the schema script
    await pool.query(schemaSQL);
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Error executing schema script:', error);
    throw error;
  }
}

/**
 * Initialize database by checking if tables exist and creating them if needed
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔍 Checking database initialization...');
    
    // Get list of required tables
    const requiredTables = getRequiredTables();
    
    // Check if all required tables exist
    const tableChecks = await Promise.all(
      requiredTables.map(table => tableExists(table))
    );
    
    const missingTables = requiredTables.filter((_, index) => !tableChecks[index]);
    
    if (missingTables.length > 0) {
      console.log(`📋 Missing tables detected: ${missingTables.join(', ')}`);
      console.log('🚀 Initializing database schema...');
      await executeSchemaScript();
    } else {
      console.log('✅ All required tables already exist');
    }
    
    console.log('🎉 Database initialization completed');
  } catch (error) {
    console.error('💥 Database initialization failed:', error);
    throw error;
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<void> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log(`🕐 Database time: ${result.rows[0].now}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}
