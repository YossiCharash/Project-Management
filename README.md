# 🏗️ Project Management System (BMS)

מערכת ניהול פרויקטים ובנייה עם תקציבים, דוחות וניהול משתמשים.

## 🚀 מהי המערכת?

- **Backend**: FastAPI (Python) עם PostgreSQL
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL 16
- **Deployment**: Docker + Render.com

---

## 📋 דרישות

- Python 3.11+
- Node.js 18+
- PostgreSQL 16+
- Docker (אופציונלי)

---

## 🚀 התקנה והרצה

### Development (לוקאלי)

#### Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

### Docker:
```bash
cd backend
docker-compose up -d
```

---

## ☁️ פריסה לענן

### Render.com (מומלץ)

**קרא את המדריך המלא:** [`DEPLOY_INSTRUCTIONS.md`](DEPLOY_INSTRUCTIONS.md)

**קיצור דרך:**

1. העלה את הקוד ל-GitHub
2. היכנס ל: https://dashboard.render.com
3. לחץ "New +" → "Blueprint"
4. בחר את ה-Repository
5. Render ייצור את הכל אוטומטית!

---

## 📚 דוקומנטציה

### API Docs
- **Local**: http://localhost:8000/docs
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Features
- ✅ אימות משתמשים (JWT)
- ✅ ניהול פרויקטים ותקציבים
- ✅ מעקב הכנסות והוצאות
- ✅ העלאת קבצים (קבלות)
- ✅ דוחות ו-RoI
- ✅ ניהול משתמשים והרשאות
- ✅ מערכת הזמנות אדמין
- ✅ אימות אימייל
- ✅ ניהול ספקים

---

## 🗂️ מבנה הפרויקט

```
Project_Management/
├── backend/
│   ├── api/          # API endpoints
│   ├── core/         # Configuration & security
│   ├── db/           # Database models & session
│   ├── models/       # SQLAlchemy models
│   ├── repositories/ # Data access layer
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   ├── Dockerfile    # Docker configuration
│   └── docker-compose.yml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── store/
│   └── package.json
└── render.yaml       # Render.com configuration
```

---

## 🔐 משתמש ראשוני (Super Admin)

**Default Credentials:**
- Email: `c0548508540@gmail.com`
- Password: `c98C98@98`

**⚠️ חשוב:** שנה את זה בפרודקשן!

---

## 🌐 Environment Variables

ראו: [`env.example`](env.example)

```env
DATABASE_URL=postgresql+asyncpg://...
JWT_SECRET_KEY=your-secret-key
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=SecurePassword123!
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 🛠️ פיתוח

### Run Tests
```bash
cd backend
pytest
```

### Code Formatting
```bash
black backend/
isort backend/
```

---

## 📞 תמיכה

- **Issues**: https://github.com/YOUR_REPO/issues
- **Documentation**: [`DEPLOY_INSTRUCTIONS.md`](DEPLOY_INSTRUCTIONS.md)

---

## 📄 רישיון

MIT License

---

## 👤 מחבר

ברוכים הבאים למערכת ניהול הפרויקטים!

**בהצלחה! 🚀**

