FROM nginx:latest

# Install OpenSSL for certificate generation
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set up directories for SSL certificates
RUN mkdir -p /etc/ssl/certs /etc/ssl/private

# Copy custom entrypoint script
COPY ./docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

# Set the entrypoint
ENTRYPOINT ["/docker-entrypoint-custom.sh"]

# Default command
CMD ["nginx", "-g", "daemon off;"]
