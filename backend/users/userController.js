/**
 * userController.js
 * Handles business logic for user registration and login.
 *
 * Security measures:
 *  - Passwords hashed with bcryptjs (cost factor 12)
 *  - JWT signed with HS256; expires in 7 days
 *  - Sensitive fields (passwordHash) never returned to the client
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { userStore } from './userStore.js';

const SALT_ROUNDS   = 12;
const JWT_SECRET    = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES   = process.env.JWT_EXPIRES_IN || '7d';

/** Strip the password hash before sending user data to the client. */
function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Sign a JWT for the given user id. */
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ---------------------------------------------------------------------------
// POST /api/users/register
// ---------------------------------------------------------------------------
export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // --- Validation ---
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    if (userStore.emailExists(email)) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    // --- Hashing & persistence ---
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = {
      id:           uuidv4(),
      username:     username.trim(),
      email:        email.toLowerCase().trim(),
      passwordHash,
      role:         'user',
      createdAt:    new Date().toISOString(),
    };

    userStore.create(newUser);

    const token = signToken(newUser.id);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: sanitize(newUser),
    });
  } catch (err) {
    console.error('[register] Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/users/login
// ---------------------------------------------------------------------------
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const user = userStore.findByEmail(email);
    if (!user) {
      // Generic message – don't reveal whether the email exists
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signToken(user.id);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: sanitize(user),
    });
  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/users/me   (protected – requires valid JWT)
// ---------------------------------------------------------------------------
export function getMe(req, res) {
  // req.userId is attached by the auth middleware
  const user = userStore.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user: sanitize(user) });
}
