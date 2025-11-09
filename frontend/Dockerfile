# ================================
# שלב 1: בניית אפליקציית Vite
# ================================
FROM node:20-alpine AS build
# הוסף ARG
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app

# התקנת תלויות
COPY package*.json ./
RUN npm install

# העתקת כל הקבצים (כולל index.html, src, public וכו')
COPY . .

# הרצת הבנייה
RUN npm run build


# ================================
# שלב 2: הגשת הקבצים עם NGINX
# ================================
FROM nginx:stable-alpine

ARG NGINX_GID=0

# תיקון הרשאות ל־OpenShift
RUN chown -R $NGINX_GID:0 /var/cache/nginx && \
    chmod -R g+rwX /var/cache/nginx && \
    chown -R $NGINX_GID:0 /var/run && \
    chmod -R g+rwX /var/run

# החלפת הקובץ הראשי של nginx
COPY nginx.conf /etc/nginx/nginx.conf

# העתקת תוצאות הבנייה
COPY --from=build /app/dist /usr/share/nginx/html

# הרשאות
RUN chown -R $NGINX_GID:0 /usr/share/nginx/html && \
    chmod -R g+rX /usr/share/nginx/html

EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]
