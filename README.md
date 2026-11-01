# PVGJ Educational Institutions

A responsive education and career portal with a public learning site, learner accounts, a protected administration workspace, and a MySQL API. Built with React, Vite, Express, and MySQL.

## Features
- Public service catalogue, study materials, current job alerts, and guidance enquiries
- Email-and-password sign-up with SMTP email verification links and signed learner sessions
- Passwords are hashed with bcrypt; learner sessions use signed tokens
- Separate learner profile with editable display name, saved job alerts, and saved searches
- Job application tracker with editable stages and private notes
- About page featuring founder Sai Shankar Vasudev, the PVGJ team, and original motivational quotes
- Admin dashboard with learner directory, analytics, scheduled current-affairs publishing, bulk JSON imports, and a content audit log
- Learning hub with personal exam plans, syllabus progress, daily quizzes, current-affairs bookmarks, and a source-grounded PVGJ library coach
- Advanced job search filters, saved alert subscriptions, and browser notifications while the Job Alerts page is open
- Installable PWA shell with offline access to previously opened public pages and public feed data

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- MySQL 8+ or a compatible MySQL server

## Set up MySQL
Run `server/schema.sql` to create the database and site tables. The schema includes the learning hub, current-affairs, and admin audit tables. Account-related tables are created or upgraded automatically on first use. The runtime database user needs `CREATE`, `ALTER`, `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions for these tables; no foreign-key `REFERENCES` grant is required.

## Configure the API
In `server`, copy `.env.example` to `.env` and enter your MySQL credentials. Set `JWT_SECRET` to a long random secret. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` for admin sign-in. Generate an admin password hash with:

```bash
node -e "import('bcryptjs').then(({default:b})=>b.hash(process.argv[1],12).then(console.log))" "your-admin-password"
```

Start the API:

```bash
cd server
npm install
npm run dev
```

The API runs at `http://localhost:5000`; check `/api/health` to confirm the database connection. For deployment, set `API_BASE_URL` to the public HTTPS API URL ending in `/api`, and set `CLIENT_ORIGIN` to the public website origin. Never use `localhost` in verification links sent to users.

## Start the website
In another terminal:

```bash
cd client
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. For a deployed build, copy `client/.env.production.example` to `client/.env.production`, set `VITE_API_URL` to the public HTTPS API URL ending in `/api`, then rebuild and deploy `client/dist`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production environment setup, hosted MySQL, HTTPS, domain routing, and the frontend SPA fallback requirements.

## Pages and API
- `/` public website
- `/signin` and `/signup` email-and-password authentication
- `/account` learner profile, saved job alerts, and application tracker
- `/learn` exam planner, quiz, current-affairs digest, and PVGJ study coach
- `/about` founder, team, mission, and motivation page
- `/jobs` live job alerts
- `/admin` protected admin workspace
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`
- Authenticated saved-job, saved-search, and application-tracker routes under /api/auth/*
- Save a job search from /jobs; reopen or remove searches from /account
- Add jobs to the tracker, then update application stages and notes from /account
- `POST /api/admin/login` and authenticated `/api/admin/*` management routes
- `GET /api/content/*`, including `/api/content/current-affairs`
- Authenticated `/api/learning/*` routes for plans, bookmarks, quiz history, and saved alert filters
- `POST /api/guidance` and `GET /api/external-jobs`

New accounts require the emailed verification link before sign-in. Configure the SMTP settings in `server/.env`; use the public `API_BASE_URL` and `CLIENT_ORIGIN` for links that work for users on other networks. Browser notifications and install prompts require a secure HTTPS deployment. Keep `.env` private.
