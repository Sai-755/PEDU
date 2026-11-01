# Production deployment checklist

PVGJ uses three separate production components:

1. The React/Vite client, published as static files from `client/dist`.
2. The Express API, started with `npm start` from `server`.
3. A reachable MySQL 8 database.

A domain name alone does not provide the client host, API host, or database. Do not copy the local `server/.env` into a public repository.

## 1. Choose and configure hosts

Use a static web host for the client, a Node.js host for the API, and a MySQL host reachable by the API. A typical address plan is:

- `https://www.yourdomain.com` for the client
- `https://api.yourdomain.com` for the API
- A private or allow-listed database endpoint for MySQL

Point DNS records to the hosts and enable HTTPS for both web and API domains. Configure the frontend host to serve `index.html` for client routes such as `/account`, `/jobs`, `/learn`, and `/services/technical-skills`; keep real static asset paths unchanged. This is the SPA rewrite/fallback rule in the chosen host.

## 2. Prepare MySQL

Create the production database, then run `server/schema.sql` against it using an account that can create the schema/tables. If your host pre-creates the database and its SQL user cannot run `CREATE DATABASE`, remove the first `CREATE DATABASE` and `USE` lines or select the target database in the host SQL console before running the remaining schema. Permit network access only from the API host where the database host supports an IP allow list or private networking. Use a dedicated application user and a strong password. Because the API creates compatibility tables on first use, that user needs the table permissions described in `README.md`; the schema does not require foreign-key `REFERENCES` access.

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the API host's secret/environment settings. Enable `DB_SSL=true` when the provider supports or requires TLS. If it uses a private CA, provide `DB_SSL_CA` as a mounted certificate file path. The connection pool validates certificates using Node's TLS defaults.

## 3. Configure API environment

Use `server/.env.production.example` as a reference; set these values in the hosting dashboard rather than committing a real production env file:

- `NODE_ENV=production`
- `CLIENT_ORIGIN`: exact HTTPS client origins, comma separated, no trailing slash
- `API_BASE_URL`: public API URL ending in `/api`; verification links must never use localhost
- `JWT_SECRET`: a newly generated long random value, different from development
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`: use a unique admin account and bcrypt hash
- SMTP settings with a sender address authorized by your mail provider
- Database settings, including TLS where required
- `TRUST_PROXY_HOPS`: set only to the verified number of reverse-proxy hops used by your host (commonly 1); do not guess if the provider documents a different chain

The API listens on the platform-provided `PORT`. Start it with `npm start` from the `server` directory. The health endpoint is `https://api.yourdomain.com/api/health`.

## 4. Build and publish the client

Create `client/.env.production` from `client/.env.production.example` and set `VITE_API_URL` to the public API base URL ending in `/api`. Vite embeds this value at build time; set it before building:

```sh
cd client
npm ci
npm run build
```

Publish the resulting `client/dist` directory to the static web host. If you change `VITE_API_URL`, rebuild and redeploy the client.

## 5. Check the live deployment

- Open the API health endpoint and confirm the response reports a connected database.
- Visit the HTTPS client and test sign-up, SMTP verification, sign-in, profile updates, job alerts, course details, and admin sign-in.
- Confirm the verification email links to the public API and returns to the public site successfully.
- Confirm HTTPS, CORS origins, SPA fallback, and browser install/notification permissions.
- Review database backups and host logs before announcing the domain.

Do not send production passwords, SMTP credentials, or JWT secrets in chat. Enter them only in the relevant hosting dashboards.
