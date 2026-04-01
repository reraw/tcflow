# TCFlow — Transaction Coordinator Deal Tracker

A production React web application for transaction coordinators to track real estate deals, manage agent profiles, and generate reports.

## Tech Stack

- **React + Vite** — Fast development and optimized builds
- **Tailwind CSS** — Utility-first styling
- **Supabase** — PostgreSQL database, authentication, and Row Level Security
- **React Router** — Client-side routing
- **Recharts** — Charts and data visualization
- **Lucide React** — Icons

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd tcflow
npm install
```

### 2. Configure Supabase

1. Go to your Supabase project dashboard
2. Copy the `.env.local.template` to `.env.local`:
   ```bash
   cp .env.local.template .env.local
   ```
3. Fill in your Supabase anon key in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://nhgetvqatnggooopycre.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Run the database migration

1. Open the Supabase SQL Editor in your project dashboard
2. Copy the contents of `supabase/migration.sql`
3. Run the SQL to create all tables, indexes, and RLS policies

### 4. Enable authentication

1. In Supabase, go to Authentication > Settings
2. Enable your preferred auth providers (email/password, Google, etc.)

### 5. Start development server

```bash
npm run dev
```

## Deployment (Vercel)

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option B: GitHub Integration

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

The `vercel.json` file is already configured for SPA routing.

## Database Schema

| Table | Description |
|-------|-------------|
| `deals` | Core deal records with address, status, pricing, dates |
| `contingencies` | Contingency dates per deal (loan, appraisal, inspection, etc.) |
| `contacts` | Deal contacts (listing agent, buyer agent, lender, escrow) |
| `extra_contacts` | Additional contacts with custom role labels |
| `deal_history` | Chronological log of deal events |
| `agents` | Agent profiles with brokerage and fee info |
| `agent_vendors` | Preferred vendors per agent |
| `agent_logins` | System login credentials per agent |

## Features

- **Dashboard** — KPI tiles, color-coded reminders, activity feed
- **Deals** — Filterable deal table, full detail modal with 5 tabs
- **Agent Profiles** — Agent cards with vendors, logins, and notes
- **Reports** — Overview, by agent, pipeline, and year-over-year analysis
- **Mobile Responsive** — Hamburger menu, responsive tables and grids
