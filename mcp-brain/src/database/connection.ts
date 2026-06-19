import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { applySchemas } from "./schemas/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
    private db!: Database<sqlite3.Database, sqlite3.Statement>;
    private isWriting = false;
    private writeQueue: Array<() => Promise<unknown>> = [];

    public async enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.writeQueue.push(async () => {
                try {
                    const res = await task();
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            });
            if (!this.isWriting) {
                this.processWriteQueue();
            }
        });
    }

    private async processWriteQueue() {
        this.isWriting = true;
        while (this.writeQueue.length > 0) {
            const task = this.writeQueue.shift();
            if (task) await task();
        }
        this.isWriting = false;
    }

    public async initialize(): Promise<void> {
        // Determinamos la ruta absoluta de forma infalible analizando si estamos corriendo desde 'dist' (Docker/Prod) o 'src' (Desarrollo/MCP)
        const dbDir = process.env.DATA_DIR || (__dirname.includes("dist") ? path.resolve(__dirname, "../../data") : path.resolve(__dirname, "../../../data"));
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const dbPath = path.join(dbDir, "lallama-memory.db");

        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        await this.db.exec("PRAGMA foreign_keys = ON;");
        await this.db.exec("PRAGMA journal_mode = WAL;");
        await applySchemas(this.db);
    }

    public getDb(): Database<sqlite3.Database, sqlite3.Statement> {
        if (!this.db) throw new Error("Database not initialized");
        return this.db;
    }
}
