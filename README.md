# PVGJ Educational Institutions

A responsive education and career portal with a public learning site, learner accounts, a protected administration workspace, and a MySQL API. Built with React, Vite, Express, and MySQL.

## Features
- Public service catalogue, study materials, current job alerts, and guidance enquiries
- Email-and-password sign-up and sign-in; new accounts are available immediately after sign-up
- Passwords are hashed with bcrypt; learner sessions use signed tokens
- Separate learner profile with editable display name, saved job alerts, and saved searches
- Job application tracker with editable stages and private notes
- About page featuring founder Sai Shankar Vasudev, the PVGJ team, and original motivational quotes
- Admin dashboard for enquiries, services, resources, and job alerts

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- MySQL 8+ or a compatible MySQL server

## Set up MySQL
Run `server/schema.sql` to create the database and site tables. Account, saved-job, application-tracker, and saved-search tables are created automatically on first use. The runtime database user needs the relevant `CREATE`, `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions for the application tables.

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

The API runs at `http://localhost:5000`; check `/api/health` to confirm the database connection.

## Start the website
In another terminal:

```bash
cd client
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Pages and API
- `/` public website
- `/signin` and `/signup` email-and-password authentication
- `/account` learner profile and saved job alerts
- `/about` founder, team, mission, and motivation page
- `/jobs` live job alerts
- `/admin` protected admin workspace
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`
- Authenticated saved-job, saved-search, and application-tracker routes under /api/auth/*
- Save a job search from /jobs; reopen or remove searches from /account
- Add jobs to the tracker, then update application stages and notes from /account
- `POST /api/admin/login` and authenticated `/api/admin/*` management routes
- `GET /api/content/*`, `POST /api/guidance`, and `GET /api/external-jobs`

The account flow does not send email verification codes. Keep `.env` private, use HTTPS in production, and update `CLIENT_ORIGIN` for the deployed site.
