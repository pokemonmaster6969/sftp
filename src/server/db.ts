import { Pool } from 'pg';

let pool: Pool | null = null;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
}

// Global scope hack for dev HMR to avoid too many connections
const globalForDb = global as unknown as { pgPool: Pool | null };
if (process.env.NODE_ENV !== 'production') {
    if (!globalForDb.pgPool && process.env.DATABASE_URL) {
        globalForDb.pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    pool = globalForDb.pgPool;
}

export const db = pool;
