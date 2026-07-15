import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve("C:/Users/rose0/idxproject/ai/IDXProject_AI/.env"),
});

import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function closeDb(): Promise<void> {
  await pool.end();
}