# XNuuP Parts Dashboard - Vercel Deployment

Full-stack dashboard for automotive parts procurement analytics.

## Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS + Recharts
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: PostgreSQL (Neon recommended for free tier)

## Prerequisites

1. **Neon PostgreSQL** (free): https://neon.tech
2. **Vercel Account** (free): https://vercel.com
3. **GitHub Account** (for deployment)

## Database Setup

### Option 1: Neon PostgreSQL (Recommended - Free)

1. Create account at https://neon.tech
2. Create new project
3. Copy connection string (looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)
4. Import your existing XNuuP data warehouse schema and data

### Option 2: Supabase PostgreSQL (Free tier)

1. Create account at https://supabase.com
2. Create new project
3. Go to Settings > Database > Connection string
4. Use "URI" format connection string

### Data Migration

Export from local PostgreSQL:
```bash
pg_dump -h localhost -U postgres -d xnuup_dw --schema=dw -F c -f xnuup_dw_backup.dump
```

Import to Neon:
```bash
pg_restore -h <neon-host> -U <user> -d <database> xnuup_dw_backup.dump
```

Or use SQL dump:
```bash
pg_dump -h localhost -U postgres -d xnuup_dw --schema=dw > xnuup_dw.sql
psql "postgresql://user:pass@host/db?sslmode=require" < xnuup_dw.sql
```

## Deployment Steps

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/xnuup-dashboard.git
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel
```

**Option B: Vercel Dashboard**
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework preset: Vite
4. Build command: `npm run build`
5. Output directory: `dist`

### 3. Configure Environment Variable

In Vercel Dashboard:
1. Go to Project Settings > Environment Variables
2. Add: `DATABASE_URL` = your Neon/Supabase connection string
3. Redeploy

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run development server
npm run dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/insurers | List all insurers |
| GET /api/dashboard | Main dashboard metrics |
| GET /api/analytics/parts | Parts analytics |
| GET /api/analytics/suppliers | Supplier analytics |
| GET /api/analytics/performance | Performance metrics |

All endpoints accept `?insurer=<key>` query parameter for filtering.

## Project Structure

```
├── api/                    # Vercel Serverless Functions
│   ├── _db.ts             # Shared database utilities
│   ├── dashboard.ts       # Dashboard endpoint
│   ├── insurers.ts        # Insurers endpoint
│   └── analytics/
│       ├── parts.ts       # Parts analytics
│       ├── suppliers.ts   # Supplier analytics
│       └── performance.ts # Performance analytics
├── src/
│   ├── App.tsx            # Main React application
│   ├── main.tsx           # Entry point
│   └── index.css          # Tailwind CSS
├── index.html
├── package.json
├── vercel.json            # Vercel configuration
├── vite.config.ts
└── tsconfig.json
```

## Free Tier Limits

**Vercel Free (Hobby)**:
- 100 GB bandwidth/month
- 100 hours serverless function execution/month
- Unlimited deployments

**Neon Free**:
- 0.5 GB storage
- 1 compute hour/day (auto-suspends when idle)
- Sufficient for dashboard use

## Troubleshooting

**Connection Timeout**: Neon auto-suspends after inactivity. First request may take 2-3 seconds to wake up.

**SSL Error**: Ensure `?sslmode=require` in connection string.

**Function Timeout**: Vercel free tier has 10s timeout. Complex queries may need optimization.

## Version

v2.2.0 - Full analytics dashboard with 4 pages:
- Dashboard (KPIs, status, suppliers, vehicles)
- Parts Analytics (volume, value, variance, cancellations)
- Supplier Analytics (ranking, delivery, pricing, specialization)
- Performance (cycle time, delivery distribution, pending parts)
