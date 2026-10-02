/**
 * Storage for story fragments and memoir chapters.
 * SERVER ONLY.
 *
 * Uses Neon (Postgres) via DATABASE_URL when present. Falls back to a local
 * JSON file for development so the app runs before the database is attached.
 */

import { neon } from "@neondatabase/serverless";

export type Story = {
  id: string;
  created_at: string;
  transcript: string;
  reply: string;
  question: string;
  session_id: string;
};

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS stories (
          id          TEXT PRIMARY KEY,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          transcript  TEXT NOT NULL,
          reply       TEXT NOT NULL DEFAULT '',
          question    TEXT NOT NULL DEFAULT '',
          session_id  TEXT NOT NULL DEFAULT 'default'
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS stories_created_idx ON stories (created_at)`;
    })();
  }
  return tableReady;
}

// --- dev fallback -----------------------------------------------------------
import { promises as fs } from "fs";
import path from "path";
const DEV_FILE = path.join(process.cwd(), ".data", "stories.json");

async function devRead(): Promise<Story[]> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8")) as Story[];
  } catch {
    return [];
  }
}

async function devWrite(rows: Story[]): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(rows, null, 2));
}

// --- public API -------------------------------------------------------------
export async function saveStory(s: Story): Promise<void> {
  if (sql) {
    await ensureTable();
    await sql`
      INSERT INTO stories (id, created_at, transcript, reply, question, session_id)
      VALUES (${s.id}, ${s.created_at}, ${s.transcript}, ${s.reply}, ${s.question}, ${s.session_id})
      ON CONFLICT (id) DO NOTHING
    `;
    return;
  }
  const rows = await devRead();
  rows.push(s);
  await devWrite(rows);
}

export async function listStories(): Promise<Story[]> {
  if (sql) {
    await ensureTable();
    const rows = (await sql`
      SELECT id, created_at, transcript, reply, question, session_id
      FROM stories ORDER BY created_at ASC
    `) as unknown as Story[];
    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at as unknown as string).toISOString(),
    }));
  }
  return devRead();
}

export async function deleteStory(id: string): Promise<void> {
  if (sql) {
    await ensureTable();
    await sql`DELETE FROM stories WHERE id = ${id}`;
    return;
  }
  const rows = await devRead();
  await devWrite(rows.filter((r) => r.id !== id));
}

export async function storageMode(): Promise<"neon" | "local-file"> {
  return sql ? "neon" : "local-file";
}
