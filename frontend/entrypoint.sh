#!/bin/sh

echo "Generating env-config.js..."
# Generate env-config.js with environment variables
cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  VITE_API_URL: "${VITE_API_URL}",
};
EOF

# Replace environment variables in nginx.conf.template and output to /etc/nginx/conf.d/default.conf
# We use a list of variables we want to substitute to avoid replacing $uri etc.
# But envsubst only replaces variables that are exported.
# So we need to ensure BACKEND_URL is exported (it is by Docker).

if [ -z "$VITE_API_URL" ]; then
    echo "WARNING: VITE_API_URL is not set. API calls might fail if not proxying correctly."
    # We do NOT set a default here to avoid crashing Nginx with invalid hostnames
fi

echo "Generating nginx.conf with BACKEND_URL=${VITE_API_URL}"

# We only want to substitute ${VITE_API_URL}
# NOTE: If VITE_API_URL is empty, this might create an invalid Nginx config like "proxy_pass /api/v1/;"
# To prevent this, if it is empty, we might want to comment out the proxy pass or something,
# but for now we assume the user sets it or relies on the JS runtime config (and Nginx is just a fallback/server).
# Actually, if VITE_API_URL is empty, envsubst replaces it with empty string.
envsubst '${VITE_API_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD (nginx)
exec "$@"

