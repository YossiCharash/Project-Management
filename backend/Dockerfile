# Backend Dockerfile for Project Management System
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies including PostgreSQL client for health checks
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create an application user that matches OpenShift's random UID/GID expectations
RUN useradd --uid 1001 --gid 0 --no-create-home --shell /usr/sbin/nologin appuser

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/data && \
    chown -R 0:0 /app && \
    chmod -R g+rwX /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Drop privileges to the non-root user (OpenShift will still be able to override the UID if needed)
USER 1001

# Run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
