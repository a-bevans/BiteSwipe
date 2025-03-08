#!/bin/sh
set -e

# Create directories for SSL certificates if they don't exist
mkdir -p /etc/ssl

# Set default domain if not provided
SSL_DOMAIN=${SSL_DOMAIN:-"*-biteswipe.westus2.cloudapp.azure.com"}
echo "Generating certificates for domain: $SSL_DOMAIN"

# Check if certificates exist, if not generate self-signed ones
if [ ! -f /etc/ssl/selfsigned.crt ] || [ ! -f /etc/ssl/selfsigned.key ]; then
    echo "SSL certificates not found, generating self-signed certificates..."
    
    # Find OpenSSL config file - try multiple possible locations
    OPENSSL_CNF=""
    for path in /etc/ssl/openssl.cnf /etc/openssl/openssl.cnf /etc/pki/tls/openssl.cnf /usr/local/etc/openssl/openssl.cnf; do
        if [ -f "$path" ]; then
            OPENSSL_CNF="$path"
            echo "Found OpenSSL config at: $OPENSSL_CNF"
            break
        fi
    done
    
    # If no config file found, create a minimal one
    if [ -z "$OPENSSL_CNF" ]; then
        echo "No OpenSSL config found, creating a minimal one"
        OPENSSL_CNF="/tmp/openssl.cnf"
        cat > "$OPENSSL_CNF" << 'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Washington
L = Seattle
O = BiteSwipe
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
EOF
    fi
    
    # Generate a self-signed certificate using the config file
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/selfsigned.key \
      -out /etc/ssl/selfsigned.crt \
      -subj "/C=US/ST=Washington/L=Seattle/O=BiteSwipe/CN=$SSL_DOMAIN" \
      -addext "subjectAltName=DNS:$SSL_DOMAIN" \
      -config "$OPENSSL_CNF" || {
        # Fallback method if the above fails
        echo "Standard OpenSSL command failed, trying fallback method"
        # Simple fallback that doesn't require a config file
        openssl genrsa -out /etc/ssl/selfsigned.key 2048
        openssl req -new -key /etc/ssl/selfsigned.key -out /tmp/selfsigned.csr -subj "/CN=$SSL_DOMAIN"
        openssl x509 -req -days 365 -in /tmp/selfsigned.csr -signkey /etc/ssl/selfsigned.key -out /etc/ssl/selfsigned.crt
        rm -f /tmp/selfsigned.csr
      }
      
    # Set appropriate permissions
    chmod 600 /etc/ssl/selfsigned.key
    
    # Verify certificates were created
    if [ -f /etc/ssl/selfsigned.crt ] && [ -f /etc/ssl/selfsigned.key ]; then
        echo "Self-signed certificates generated successfully."
    else
        echo "Failed to generate certificates. Creating empty placeholder files to prevent container crash."
        echo "WARNING: These are dummy certificates and not secure!"
        echo "Dummy certificate" > /etc/ssl/selfsigned.crt
        echo "Dummy key" > /etc/ssl/selfsigned.key
        chmod 600 /etc/ssl/selfsigned.key
    fi
fi

# Execute the original NGINX docker-entrypoint with the provided arguments
exec /docker-entrypoint.sh "$@"
