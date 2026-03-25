import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Utils } from "electrobun/bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { relations } from "./relation";
import * as schema from "./schema";

// Ensure data directory exists
const dataDir = Utils.paths.userData;
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 数据库文件名，默认使用 todos.db
const DB_FILE_NAME = process.env["DB_FILE_NAME"] || "todos.db";

// Initialize SQLite database
export const dbPath = join(dataDir, DB_FILE_NAME);
console.log(`Database path: ${dbPath}`);

// 创建原生 SQLite 连接用于迁移
const sqlite = new Database(dbPath);

// 初始化 Drizzle ORM 并自动执行迁移
export const db = drizzle({
  client: sqlite,
  schema,
  relations,
});

// 标记文件，用于记录是否已执行过初始化
const INIT_FLAG_FILE = join(dataDir, ".db_initialized");

// 迁移 SQL 直接内联到代码中，确保打包后也能执行
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS todo_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (CURRENT_DATE) NOT NULL,
  updated_at INTEGER DEFAULT (CURRENT_DATE) NOT NULL
);
`;

// 惰性初始化函数 - 只在第一次启动时执行迁移
let initPromise: Promise<void> | null = null;

async function initializeDatabase(): Promise<void> {
  // 如果已经初始化过，直接返回
  if (existsSync(INIT_FLAG_FILE)) {
    console.log("Database already initialized");
    return;
  }

  console.log("First run - applying database migration...");

  try {
    // 执行内联的迁移 SQL
    sqlite.exec(MIGRATION_SQL);

    console.log("Migration applied successfully");

    // 创建标记文件，表示已初始化
    await Bun.write(INIT_FLAG_FILE, new Date().toISOString());
  } catch (error) {
    console.error("Failed to apply migration:", error);
    throw error;
  }
}

// 导出初始化函数
export async function ensureDatabaseReady(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
}
