# cPanel Update

This project hosts a static Next.js website alongside a PHP API. No Node.js server or `npm install` is needed on cPanel for this deployment.

## Before Uploading

1. Back up the current hosted site and database privately, outside the public web folder.
2. Rotate the database password in cPanel: an earlier committed PHP configuration and debug ZIP contained credentials. Removing them from the current tree does not remove old Git history. Use a unique database user/password and change any default application passwords still in use.
3. Prepare the server configuration privately. The ignored local `api/.env.cpanel` preserves the previous production database settings and contains a new random signing key. Update it with the rotated password and set `APP_ORIGIN` to the exact HTTPS website origin, for example `https://pos.example.com` (no path). Set `APP_ENV=production`; do not upload the local development `api/.env`.
4. Install this configuration on the server as `api/.env`, or place it outside the document root and set the PHP server environment variable `OIL_MART_ENV_FILE` to its full path. Restrict filesystem access to the hosting account/PHP process. A `.env` file hides nothing by itself: the included Apache denial rules or an outside-webroot location are required.

## Files To Upload

Run locally, in this order:

```bash
npm run build
npm run package:cpanel
```

The second command prints a new `build/cpanel-upload-<timestamp>` folder. Upload **the contents** of that folder to the existing website document root, not the enclosing folder. It contains:

| Destination | Contents |
| --- | --- |
| Website root | Built `index.html`, route folders, static payloads, `_next/`, icons, images, `manifest.json`, and `sw.js` from `out/` |
| Website root `.htaccess` | Export routing plus private-file protection; enable "Show Hidden Files" in cPanel |
| `api/` | `index.php`, `config.php`, `environment.php`, `auth_middleware.php`, `session.php`, `credit.php`, `product-import.php`, and `.htaccess` |
| `api/routes/` | All runtime route `.php` files |

The folder intentionally contains **no `.env` file**. Add the production configuration separately as described above. Upload the frontend and API together during a quiet maintenance window: the new frontend uses HttpOnly cookies and the API uses revocable sessions. Users must sign in again after the new signing key is installed.

Preserve the hosted database. **Do not import `cpanel_database_schema.sql` over the live database and do not run `reset_local_catalog.php` on it.** Runtime compatibility migrations create the session/rate-limit tables and missing columns; the configured database user needs the required CREATE/ALTER permissions for this version.

## Remove From The Host If Present

- Delete `api/test_db.php` and `api/test_db.zip`; simply overwriting other files will not remove these older copies.
- Delete the unused starter assets `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg` from the website root if previously uploaded.
- Remove publicly uploaded source-only folders such as `.git/`, `src/`, `scripts/`, `node_modules/`, `.local-checks/`, `.oil-mart-db/`, and debug logs. Move needed database backups outside the public directory before removing public copies. Preserve any unrelated existing site uploads and configuration.

Do not upload `package.json`, lockfiles, `next.config.ts`, `tsconfig.json`, development scripts, SQL files, CSV imports, screenshots, or backups. Keep these in the local project/Git where appropriate. They are not required to serve the exported app.

## Verify After Deployment

1. Confirm HTTPS and the login screen load, then test both admin and cashier login.
2. Confirm categories, products, the cashier category/subcategory flow, and invoice views load.
3. Log out, reopen the installed app, and check that the old session cannot reopen protected data. Reload/reopen once to allow the new service worker to activate.
4. Requests to `/api/.env`, `/api/config.php`, `/api/test_db.zip`, `/.git/config`, and `/scripts/` must return 403 or 404, never file contents. Verify on the actual host; local Apache results do not prove the host configuration is identical.
5. If login returns a configuration error, inspect the private PHP error log and `.env` settings. Do not enable public PHP error details.

The generated routing assumes the app is served at a domain/subdomain root, matching the current deployment configuration. A subfolder deployment needs separate base-path and routing configuration.
