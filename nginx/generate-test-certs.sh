#!/bin/bash

# Create certificates directory
mkdir -p certs

# Generate a self-signed certificate for testing
echo "Generating self-signed certificates for local testing..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/selfsigned.key \
  -out certs/selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set appropriate permissions
chmod 600 certs/selfsigned.key

echo "Test certificates generated successfully."
echo "You can now test your HTTPS setup locally."
