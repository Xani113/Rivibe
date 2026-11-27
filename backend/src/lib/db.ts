import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { CloudPlaylist, CloudTasteSnapshot, CloudTrack, UserPublic } from './types';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: number;
}

export function createDb(dbPath?: string): DatabaseSync {
  const target = dbPath ?? process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'rivibe.sqlite');
  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }
  const db = new DatabaseSync(target);
  if (target !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS taste_snapshots (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_url TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      track_id TEXT NOT NULL,
      track_json TEXT NOT NULL,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );
  `);

  return db;
}

let globalDb: DatabaseSync | null = null;

export function getAppDb(): DatabaseSync {
  if (!globalDb) {
    globalDb = createDb();
  }
  return globalDb;
}

export function createUser(
  db: DatabaseSync,
  input: { email: string; passwordHash: string; displayName: string },
): UserPublic {
  const id = randomUUID();
  const normalizedEmail = input.email.trim().toLowerCase();
  const createdAt = Date.now();

  const stmt = db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  stmt.run(id, normalizedEmail, input.passwordHash, input.displayName.trim(), createdAt);

  return {
    id,
    email: normalizedEmail,
    displayName: input.displayName.trim(),
    createdAt,
  };
}

export function findUserByEmail(db: DatabaseSync, email: string): UserRow | null {
  const stmt = db.prepare('SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = ?');
  const row = stmt.get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(db: DatabaseSync, userId: string): UserPublic | null {
  const stmt = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?');
  const row = stmt.get(userId) as
    | { id: string; email: string; display_name: string; created_at: number }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export function saveUserLibrarySnapshot(
  db: DatabaseSync,
  userId: string,
  snapshot: CloudTasteSnapshot,
): void {
  const stmt = db.prepare(`
    INSERT INTO taste_snapshots (user_id, display_name, snapshot_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = excluded.display_name,
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `);
  stmt.run(userId, snapshot.displayName, JSON.stringify(snapshot), Date.now());

  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(snapshot.displayName, userId);
}

export function loadUserLibrarySnapshot(db: DatabaseSync, userId: string): CloudTasteSnapshot | null {
  const row = db
    .prepare('SELECT snapshot_json FROM taste_snapshots WHERE user_id = ?')
    .get(userId) as { snapshot_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.snapshot_json) as CloudTasteSnapshot;
  } catch {
    return null;
  }
}

export function createCloudPlaylist(
  db: DatabaseSync,
  userId: string,
  input: { name: string; description?: string; coverUrl?: string; initialTrack?: CloudTrack },
): CloudPlaylist {
  const id = `pl-${randomUUID()}`;
  const createdAt = Date.now();
  const coverUrl = input.coverUrl || input.initialTrack?.artworkUrl || '';

  db.prepare(
    'INSERT INTO playlists (id, user_id, name, description, cover_url, is_system, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
  ).run(id, userId, input.name.trim(), (input.description ?? '').trim(), coverUrl, createdAt);

  const tracks: CloudTrack[] = [];
  if (input.initialTrack) {
    db.prepare(
      'INSERT INTO playlist_tracks (playlist_id, position, track_id, track_json) VALUES (?, 0, ?, ?)',
    ).run(id, input.initialTrack.id, JSON.stringify(input.initialTrack));
    tracks.push(input.initialTrack);
  }

  return {
    id,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    coverUrl,
    tracks,
    createdAt,
  };
}

export function listUserPlaylists(db: DatabaseSync, userId: string): CloudPlaylist[] {
  const rows = db
    .prepare(
      'SELECT id, name, description, cover_url, is_system, created_at FROM playlists WHERE user_id = ? ORDER BY created_at ASC',
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    description: string;
    cover_url: string;
    is_system: number;
    created_at: number;
  }>;

  const trackStmt = db.prepare(
    'SELECT track_json FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC',
  );

  return rows.map((pl) => {
    const trackRows = trackStmt.all(pl.id) as Array<{ track_json: string }>;
    const tracks = trackRows
      .map((r) => {
        try {
          return JSON.parse(r.track_json) as CloudTrack;
        } catch {
          return null;
        }
      })
      .filter((t): t is CloudTrack => t !== null);

    return {
      id: pl.id,
      name: pl.name,
      description: pl.description,
      coverUrl: pl.cover_url,
      tracks,
      createdAt: pl.created_at,
      isSystem: pl.is_system === 1,
    };
  });
}

export function addTrackToCloudPlaylist(
  db: DatabaseSync,
  userId: string,
  playlistId: string,
  track: CloudTrack,
): boolean {
  const owner = db
    .prepare('SELECT id, cover_url FROM playlists WHERE id = ? AND user_id = ?')
    .get(playlistId, userId) as { id: string; cover_url: string } | undefined;
  if (!owner) return false;

  const countRow = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlistId) as { nextPos: number };

  db.prepare(
    'INSERT OR IGNORE INTO playlist_tracks (playlist_id, position, track_id, track_json) VALUES (?, ?, ?, ?)',
  ).run(playlistId, countRow.nextPos, track.id, JSON.stringify(track));

  if (!owner.cover_url && track.artworkUrl) {
    db.prepare('UPDATE playlists SET cover_url = ? WHERE id = ?').run(track.artworkUrl, playlistId);
  }
  return true;
}

export function removeTrackFromCloudPlaylist(
  db: DatabaseSync,
  userId: string,
  playlistId: string,
  trackId: string,
): boolean {
  const owner = db
    .prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?')
    .get(playlistId, userId) as { id: string } | undefined;
  if (!owner) return false;

  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
  return true;
}

export function deleteCloudPlaylist(db: DatabaseSync, userId: string, playlistId: string): boolean {
  const res = db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(playlistId, userId);
  return Number(res.changes) > 0;
}
