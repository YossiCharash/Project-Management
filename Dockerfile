# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory for PostgreSQL data
RUN mkdir -p /var/lib/postgresql/data

# Install PostgreSQL server
RUN apt-get update && apt-get install -y \
    postgresql \
    postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

# Create PostgreSQL user and database
USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER app_user WITH SUPERUSER PASSWORD 'app_password';" && \
    createdb -O app_user app_db

# Switch back to root
USER root

# Copy database initialization script
COPY init_db.sql /docker-entrypoint-initdb.d/

# Expose ports
EXPOSE 8000 5432

# Create startup script
RUN echo '#!/bin/bash\n\
# Start PostgreSQL\n\
service postgresql start\n\
\n\
# Wait for PostgreSQL to be ready\n\
while ! pg_isready -h localhost -p 5432 -U app_user; do\n\
  echo "Waiting for PostgreSQL..."\n\
  sleep 1\n\
done\n\
\n\
# Initialize database if needed\n\
if [ -f /docker-entrypoint-initdb.d/init_db.sql ]; then\n\
  psql -h localhost -U app_user -d app_db -f /docker-entrypoint-initdb.d/init_db.sql\n\
fi\n\
\n\
# Start the FastAPI application\n\
cd /app\n\
uvicorn backend.main:app --host 0.0.0.0 --port 8000\n\
' > /start.sh && chmod +x /start.sh

# Set the startup script as entrypoint
ENTRYPOINT ["/start.sh"]
