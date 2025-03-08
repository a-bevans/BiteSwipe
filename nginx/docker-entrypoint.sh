#!/bin/sh
set -e

# Create directories for SSL certificates if they don't exist
mkdir -p /etc/ssl/certs
mkdir -p /etc/ssl/private

# Set default domain if not provided
SSL_DOMAIN=${SSL_DOMAIN:-"*-biteswipe.westus2.cloudapp.azure.com"}
echo "Generating certificates for domain: $SSL_DOMAIN"

# Check if certificates exist, if not generate self-signed ones
if [ ! -f /etc/ssl/certs/selfsigned.crt ] || [ ! -f /etc/ssl/private/selfsigned.key ]; then
    echo "SSL certificates not found, generating self-signed certificates..."
    
    # Generate a self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/private/selfsigned.key \
      -out /etc/ssl/certs/selfsigned.crt \
      -subj "/C=US/ST=Washington/L=Seattle/O=BiteSwipe/CN=$SSL_DOMAIN" \
      -addext "subjectAltName=DNS:$SSL_DOMAIN"
      
    # Set appropriate permissions
    chmod 600 /etc/ssl/private/selfsigned.key
    
    echo "Self-signed certificates generated successfully."
fi

# Execute the original docker-entrypoint.sh with the provided arguments
exec /docker-entrypoint.sh "$@"
