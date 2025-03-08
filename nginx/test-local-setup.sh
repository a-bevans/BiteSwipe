#!/bin/bash

echo "Setting up local testing environment for HTTPS..."

# Step 1: Generate test certificates if they don't exist
if [ ! -f "certs/selfsigned.crt" ] || [ ! -f "certs/selfsigned.key" ]; then
  echo "Generating self-signed certificates for testing..."
  ./generate-test-certs.sh
fi

# Step 2: Create a hosts file entry for testing (requires sudo)
echo "You may need to add an entry to your hosts file for testing."
echo "Run the following command if you haven't already:"
echo "sudo sh -c 'echo \"127.0.0.1 biteswipe.local\" >> /etc/hosts'"

# Step 3: Start the Docker Compose setup
echo "Starting Docker Compose setup..."
cd ../backend
docker-compose up -d

# Step 4: Check if the services are running
echo "Checking if services are running..."
docker ps

echo ""
echo "==================================================================="
echo "Testing Instructions:"
echo "==================================================================="
echo "1. Open your browser and navigate to: https://localhost"
echo "   (You'll see a security warning because we're using a self-signed certificate)"
echo "2. Click 'Advanced' and then 'Proceed to localhost (unsafe)'"
echo "3. You should now see your BiteSwipe application running over HTTPS"
echo ""
echo "To test HTTP to HTTPS redirection, visit: http://localhost"
echo "You should be automatically redirected to https://localhost"
echo ""
echo "To stop the services, run: cd ../backend && docker-compose down"
echo "==================================================================="
