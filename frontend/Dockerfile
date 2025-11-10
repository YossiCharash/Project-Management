# ==================================================================
# Stage 1: The Builder Stage (node:18-alpine)
# ==================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# 1. העתקת קבצי תלויות בלבד
COPY frontend/package*.json ./

# 2. התקנת תלויות (משתמשים ב-npm install אם יש בעיה עם npm ci)
RUN npm install

# 3. העתקת שאר קוד המקור, כולל index.html
# התיקון: מעתיק את כל התוכן *בתוך* frontend/ ישירות ל- /app
COPY frontend/ .

# 4. בניית האפליקציה

RUN npm run build

# --- Stage 2: Final (Production) Image (NGINX) ---
# --- Stage 2: Final (Production) Image (NGINX) ---
FROM nginx:alpine

# הוסף את הקונפיגורציה המותאמת אישית
# (הנחה: הקובץ nginx.conf נמצא באותה תיקיה כמו ה-Dockerfile)
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# 1. יצירת ספריות מטמון והגדרת הרשאות כתיבה
# אם אנחנו משתמשים ב-nginx.conf המותאם אישית שמעביר את הכל ל-/tmp,
# פקודה זו אינה נחוצה, אבל היא מועילה כהגנה נוספת או אם אתה משתמש
# ב-nginx.conf ברירת המחדל (אם כי מומלץ להשתמש בקונפיגורציה מותאמת אישית).
# עבור הפתרון הנוכחי עם /tmp, פקודה זו **אינה נחוצה**!

# 2. העתקה מה-Builder
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. הגדרות סופיות
EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]