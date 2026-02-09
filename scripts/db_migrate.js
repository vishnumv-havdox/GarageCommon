import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env (simplified, assuming env vars are loaded or we hardcode for this script)
// Actually we need to read .env
const envPath = path.resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envConfig[key.trim()] = value.trim();
    }
});

const connectionString = envConfig.DATABASE_URL || envConfig.Supabase_DB_URL || envConfig.VITE_SUPABASE_URL; // Adjust based on .env content

if (!connectionString) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
});

async function runMigration() {
    try {
        await client.connect();
        const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260313000005_add_owner_details_to_profile.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Running migration: ${sqlPath}`);
        await client.query(sql);
        console.log("Migration completed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
