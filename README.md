# Labour Attendance Management System

A full-stack application for managing labour attendance and salary in small organizations.

## Features

- **User Authentication**: Admin and Manager roles with JWT-based authentication
- **Labour Management**: Add, edit, and deactivate labourers
- **Daily Attendance**: Mark attendance (Present/Absent/Half-day) for each labour
- **Weekly Salary Calculation**: 
  - Salary calculated weekly (Saturday to Friday)
  - Unpaid weeks consolidate automatically
  - Track pending and paid amounts
- **Statistics Dashboard**: Visual charts and detailed reports
- **CSV Export**: Export labours, attendance, and salary data

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Pandas** - Data manipulation and CSV handling
- **JWT** - Authentication tokens
- **Passlib** - Password hashing

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Recharts** - Charts and visualizations
- **Lucide React** - Icons
- **Axios** - HTTP client

## Project Structure

```
attendance/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── labours.py
│   │   │   ├── attendance.py
│   │   │   ├── salary.py
│   │   │   ├── stats.py
│   │   │   └── export.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── auth.py
│   │   ├── config.py
│   │   └── salary_calculator.py
│   ├── data/           # CSV data files (auto-created)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Default Login

- **Username**: admin
- **Password**: admin123

## API Endpoints

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register new user (Admin only)
- `GET /auth/me` - Get current user info

### Labours
- `GET /labours/` - List all labours
- `POST /labours/` - Add new labour
- `PUT /labours/{id}` - Update labour
- `DELETE /labours/{id}` - Deactivate labour

### Attendance
- `GET /attendance/date/{date}` - Get attendance by date
- `GET /attendance/labour/{id}` - Get attendance by labour
- `POST /attendance/` - Mark single attendance
- `POST /attendance/bulk` - Mark bulk attendance
- `GET /attendance/today` - Get today's attendance status

### Salary
- `GET /salary/records` - Get salary records
- `GET /salary/pending` - Get all pending salaries
- `POST /salary/calculate/{id}` - Calculate salary for labour
- `POST /salary/calculate-all` - Calculate all salaries (Admin)
- `POST /salary/pay` - Mark salary as paid

### Statistics
- `GET /stats/overview` - Get overview statistics
- `GET /stats/weekly` - Get weekly statistics
- `GET /stats/labour/{id}` - Get labour statistics
- `GET /stats/all-labours` - Get all labour statistics

### Export
- `GET /export/labours` - Export labours CSV
- `GET /export/attendance` - Export attendance CSV
- `GET /export/salary` - Export salary CSV

## Salary Calculation Logic

1. Week runs from **Saturday to Friday**
2. Salary is calculated based on attendance:
   - Present = 1 day wage
   - Half Day = 0.5 day wage
   - Absent = 0
3. If salary is not paid for a week, it consolidates with subsequent weeks
4. Payment marks all unpaid weeks up to the selected week as paid

## Additional Features to Consider

1. **Overtime Tracking** - Track extra hours worked
2. **Advance Payment** - Allow advance salary payments
3. **Leave Management** - Track different leave types
4. **Mobile App** - React Native version for field use
5. **Notifications** - SMS/Email alerts for pending payments
6. **Multi-site Support** - Manage multiple work locations
7. **Biometric Integration** - Automated attendance marking
8. **Reports** - Monthly/yearly PDF reports
9. **Backup/Restore** - Database backup functionality
10. **Audit Log** - Track all changes made in the system

## License

MIT
