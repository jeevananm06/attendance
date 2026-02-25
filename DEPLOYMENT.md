# Deployment Guide

## Architecture
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render (FastAPI + Python)
- **Database**: PostgreSQL (Render or Supabase - Free tier available)

---

## Step 1: Set Up PostgreSQL Database

### Option A: Render PostgreSQL (Recommended)
1. Go to [render.com](https://render.com) → **New +** → **PostgreSQL**
2. Configure:
   - **Name**: `attendance-db`
   - **Database**: `attendance`
   - **User**: `attendance_user`
   - **Region**: Same as your web service
   - **Plan**: Free (90-day limit) or Starter ($7/month)
3. Click **Create Database**
4. Copy the **Internal Database URL** (for same-region services) or **External Database URL**

### Option B: Supabase (Free Forever)
1. Go to [supabase.com](https://supabase.com) → Create new project
2. Go to **Settings** → **Database** → **Connection string** → **URI**
3. Copy the connection string (replace `[YOUR-PASSWORD]` with your password)

### Option C: Neon (Free Forever)
1. Go to [neon.tech](https://neon.tech) → Create project
2. Copy the connection string from the dashboard

---

## Step 2: Deploy Backend to Render

### 2.1 Create GitHub Repository (if not already)
```bash
cd c:\Users\jegovind\attendance
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance.git
git push -u origin main
```

### 2.2 Deploy to Render
1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `attendance-api`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `USE_POSTGRES` | `true` |
   | `DATABASE_URL` | `postgresql://...` (from Step 1) |
   | `FRONTEND_URL` | `https://your-app.vercel.app` (update after Vercel) |
6. Click **"Create Web Service"**

### 2.3 Note Your Backend URL
After deployment, you'll get a URL like:
```
https://attendance-api-xxxx.onrender.com
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://attendance-api-xxxx.onrender.com` (your Render URL)
6. Click **"Deploy"**

### 3.2 Update Render CORS
After Vercel deployment, go back to Render:
1. Go to your service → **Environment**
2. Update `FRONTEND_URL` with your Vercel URL (e.g., `https://your-app.vercel.app`)
3. Click **"Save Changes"** (service will redeploy)

---

## Step 4: Verify Deployment

1. Open your Vercel URL
2. Login with: `admin` / `admin123`
3. Test all features

---

## Environment Variables Summary

### Backend (Render)
| Variable | Value | Description |
|----------|-------|-------------|
| `USE_POSTGRES` | `true` | Enable PostgreSQL |
| `DATABASE_URL` | `postgresql://...` | Database connection string |
| `FRONTEND_URL` | `https://your-app.vercel.app` | For CORS |

### Frontend (Vercel)
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://attendance-api-xxxx.onrender.com` |

---

## Local Development

### Using CSV (Default)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Using PostgreSQL Locally
1. Install PostgreSQL locally or use Docker:
```bash
docker run --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=attendance -p 5432:5432 -d postgres
```

2. Create `.env` file in `backend/`:
```
USE_POSTGRES=true
DATABASE_URL=postgresql://postgres:password@localhost:5432/attendance
```

3. Run the server:
```bash
uvicorn app.main:app --reload
```

---

## Database Migration (CSV to PostgreSQL)

If you have existing CSV data and want to migrate:

1. Export your CSV data using the app's Export feature
2. Deploy with PostgreSQL enabled
3. Use the app to re-enter data, or create a migration script

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly on Render
- Check that the URL doesn't have a trailing slash

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check if database is running and accessible
- For Render internal URLs, ensure both services are in the same region

### API Not Responding
- Check Render logs for errors
- Verify the backend is running (visit `/health` endpoint)

### Login Issues
- Default credentials: `admin` / `admin123`
- The admin user is auto-created on first startup

### Tables Not Created
- Tables are auto-created on startup when `USE_POSTGRES=true`
- Check logs for any SQLAlchemy errors
