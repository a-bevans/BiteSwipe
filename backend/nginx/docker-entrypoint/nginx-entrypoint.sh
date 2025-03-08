#!/bin/sh
set -e

# Create directories for SSL certificates if they don't exist
mkdir -p /etc/ssl/certs
mkdir -p /etc/ssl/private

# Check if certificates exist, if not generate self-signed ones
if [ ! -f /etc/ssl/certs/selfsigned.crt ] || [ ! -f /etc/ssl/private/selfsigned.key ]; then
    echo "SSL certificates not found, generating self-signed certificates..."
    
    # Generate a self-signed certificate for Azure domain only
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/private/selfsigned.key \
      -out /etc/ssl/certs/selfsigned.crt \
      -subj "/C=US/ST=Washington/L=Seattle/O=BiteSwipe/CN=*-biteswipe.westus2.cloudapp.azure.com" \
      -addext "subjectAltName=DNS:*-biteswipe.westus2.cloudapp.azure.com"
      
    # Set appropriate permissions
    chmod 600 /etc/ssl/private/selfsigned.key
    
    echo "Self-signed certificates generated successfully."
fi

# Execute the original docker-entrypoint.sh with the provided arguments
exec /docker-entrypoint.sh "$@"
