#!/bin/bash

# Create certificates directory
mkdir -p certs

# Convert PFX to key and certificate
if [ -f "cert.pfx" ]; then
  echo "Converting PFX certificate..."
  openssl pkcs12 -in cert.pfx -nocerts -out certs/selfsigned.key -nodes 
  openssl pkcs12 -in cert.pfx -clcerts -nokeys -out certs/selfsigned.crt
  echo "Certificate conversion complete."
else
  echo "Error: cert.pfx file not found in current directory."
  echo "Please place your cert.pfx file in the nginx directory and run this script again."
  exit 1
fi

# Set appropriate permissions
chmod 600 certs/selfsigned.key

echo "Certificate setup complete. You can now run docker-compose up -d"
