/* eslint-disable no-console */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pool from "./database.js";

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
 * Get list of tables that should exist based on db-init scripts
 */
function getRequiredTables(): string[] {
  return [
    "users",
    "products",
    "reviews",
    "sales",
    "sale_products",
    "favorites",
    "stores",
    "carts",
  ];
}

/**
 * Read and execute all SQL scripts from db-init folder in order
 */
async function executeSchemaScripts(): Promise<void> {
  try {
    // Get the db-init directory path
    const dbInitPath = join(process.cwd(), "db-init");

    // Read all SQL files from db-init directory
    const files = readdirSync(dbInitPath)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Execute in alphabetical order (01-, 02-, 03-)

    console.log(`📁 Found ${files.length} SQL scripts to execute:`, files);

    // Execute each script in order
    for (const file of files) {
      console.log(`🔄 Executing ${file}...`);
      const scriptPath = join(dbInitPath, file);
      const scriptSQL = readFileSync(scriptPath, "utf8");

      await pool.query(scriptSQL);
      console.log(`✅ ${file} executed successfully`);
    }

    console.log("✅ All database schema scripts initialized successfully");
  } catch (error) {
    console.error("❌ Error executing schema scripts:", error);
    throw error;
  }
}

/**
 * Initialize database by checking if tables exist and creating them if needed
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log("🔍 Checking database initialization...");

    // Get list of required tables
    const requiredTables = getRequiredTables();

    // Check if all required tables exist
    const tableChecks = await Promise.all(
      requiredTables.map((table) => tableExists(table)),
    );

    const missingTables = requiredTables.filter(
      (_, index) => !tableChecks[index],
    );

    if (missingTables.length > 0) {
      console.log(`📋 Missing tables detected: ${missingTables.join(", ")}`);
      console.log("🚀 Initializing database schema...");
      await executeSchemaScripts();
    } else {
      console.log("✅ All required tables already exist");
    }

    console.log("🎉 Database initialization completed");
  } catch (error) {
    console.error("💥 Database initialization failed:", error);
    throw error;
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<void> {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful");
    console.log(`🕐 Database time: ${result.rows[0].now}`);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}
