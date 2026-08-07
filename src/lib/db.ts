import mysql from 'mysql2/promise';

// Global connection pool so we don't create multiple pools in dev mode
// due to hot module replacement (HMR).

const globalForMysql = global as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

export const pool =
  globalForMysql.mysqlPool ??
  mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'oil_mart',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') globalForMysql.mysqlPool = pool;
