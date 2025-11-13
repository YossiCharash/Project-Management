# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
# הערה קריטית: 'npm ci' דורשת שקובץ package-lock.json יהיה קיים בהקשר הבנייה.
# ודא שגם package.json וגם package-lock.json נמצאים באותה ספרייה כמו ה-Dockerfile.
COPY /package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .
# Build the app
RUN npm run build

# --- DIAGNOSTIC STEP (For debugging if the fix doesn't work) ---
# This command lists the files in /app to confirm the name of the built folder (e.g., build, dist, out).
RUN ls -al /app

# Production stage
FROM nginx:alpine

# Copy built files
# FIX: Changed the path from '/app/build' to the common default, '/app/dist'.
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Render expects the app to listen on $PORT
# But Nginx defaults to 80, so we'll handle this in nginx.conf
EXPOSE 10000

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]