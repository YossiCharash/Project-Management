# Docker Setup for Backend

## תצורת Docker ל-Backend

### קבצים שנוצרו:
- `Dockerfile` - תצורת ה-Container ל-Backend
- `docker-compose.yml` - הגדרה מלאה עם PostgreSQL
- `.dockerignore` - אופטימיזציה לבנייה

---

## הרצה מקומית

### אפשרות 1: Docker Compose (מומלץ) 🎯

```bash
cd backend
docker-compose up -d
```

השרת יעלה על: `http://localhost:8000`

**API Docs:** `http://localhost:8000/docs`

### אפשרות 2: Docker בלבד

```bash
# בנה את ה-Image
docker build -f backend/Dockerfile -t bms-backend .

# הרץ את ה-Container
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql+asyncpg://postgres:postgres@host.docker.internal:5432/bms" \
  -e JWT_SECRET_KEY="your-secret-key" \
  bms-backend
```

---

## משתני סביבה

צור קובץ `.env` בתיקיית `backend/`:

```env
# Database
POSTGRES_DB=bms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# JWT
JWT_SECRET_KEY=your-super-secret-key

# Super Admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=Admin123!
SUPER_ADMIN_NAME=Super Admin

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# File Uploads
FILE_UPLOAD_DIR=/app/uploads
```

---

## פקודות שימושיות

### הצגת הלוגים
```bash
docker-compose logs -f backend
```

### עצירת השירותים
```bash
docker-compose down
```

### עצירת השירותים עם מחיקת Volumes
```bash
docker-compose down -v
```

### בנייה מחדש
```bash
docker-compose build --no-cache
docker-compose up -d
```

### כניסה ל-Container
```bash
docker-compose exec backend bash
```

---

## פריסה לענן

### Render.com

1. העלה את הקוד ל-GitHub
2. ב-Render:
   - בחר "Web Service"
   - בחר את ה-Repository
   - הגדר: **Environment** = `Docker`
   - **Dockerfile Path**: `backend/Dockerfile`
   - הוסף Environment Variables (כמופיע למעלה)

### Railway

1. העלה את הקוד ל-GitHub
2. ב-Railway:
   - בחר "GitHub Repo"
   - אתר מזהה Dockerfile אוטומטית
   - הוסף Environment Variables

---

## בדיקת Health

```bash
curl http://localhost:8000/health
```

צריך להחזיר:
```json
{
  "status": "healthy",
  "message": "Project Management System is running"
}
```

---

## בעיות נפוצות

### 1. Port כבר בשימוש
```bash
# שנה את ה-port ב-docker-compose.yml
ports:
  - "8001:8000"  # במקום 8000:8000
```

### 2. Database Connection Error
- ודא שה-PostgreSQL רץ
- בדוק שה-DATABASE_URL נכון
- המתן 2-3 דקות ל-Database להתחיל

### 3. Build נכשל
```bash
# נקה cache ובנה מחדש
docker-compose build --no-cache
```

---

## הרשאות קבצים

אם יש בעיות עם uploads:
```bash
# שנה הרשאות בתוך ה-Container
docker-compose exec backend chmod -R 755 /app/uploads
```

---

## קישורים שימושיים

- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health
- **FastAPI Docs:** https://fastapi.tiangolo.com

---

**בהצלחה! 🚀**
