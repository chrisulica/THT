/**
 * userStore.js
 * In-memory user store (backed by a local JSON file for persistence).
 * Drop-in replacement for a real DB until one is wired up.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DB_PATH = join(__dirname, 'users_db.json');

/** Load users from disk (or return empty array on first run). */
function load() {
  if (!existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

/** Persist users array to disk. */
function save(users) {
  writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

// Runtime cache – single source of truth
let users = load();

export const userStore = {
  /** Return all users (never expose passwords outside this module). */
  getAll: () => users,

  /** Find by email (case-insensitive). */
  findByEmail: (email) =>
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null,

  /** Find by id. */
  findById: (id) => users.find((u) => u.id === id) || null,

  /** Persist a new user object (must already contain hashed password). */
  create: (user) => {
    users.push(user);
    save(users);
    return user;
  },

  /** Check whether an email is already taken. */
  emailExists: (email) =>
    users.some((u) => u.email.toLowerCase() === email.toLowerCase()),
};
