import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

const ssl = process.env.DB_SSL === 'true'
  ? (process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA, 'utf8') } : {})
  : undefined;

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pvgj_education',
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
});

export default db;
