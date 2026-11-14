/**
 * routes.js
 * Re-exports the user router from userRoutes.js so all user routes (/register, /login, /me)
 * are available regardless of whether server.js imports routes.js or userRoutes.js.
 */

export { default } from './userRoutes.js';
