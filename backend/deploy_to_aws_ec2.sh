#!/bin/bash

# Define variables
EC2_INSTANCE="ec2-34-216-147-168.us-west-2.compute.amazonaws.com"
SSH_KEY="$HOME/.ssh/to_aws/CPEN321.pem"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_DIR="/home/ec2-user/project"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "SSH key not found: $SSH_KEY"
    exit 1
fi

# Sync project files to EC2 instance

rsync -avz -e "ssh -i $SSH_KEY" --exclude '.git' "$PROJECT_DIR/" "ec2-user@$EC2_INSTANCE:$REMOTE_DIR"

# echo the command that was run
echo "rsync -avz -e \"ssh -i $SSH_KEY\" --exclude '.git' \"$PROJECT_DIR/\" \"ec2-user@$EC2_INSTANCE:$REMOTE_DIR\""

# Connect to EC2 instance and perform any necessary setup
ssh -i "$SSH_KEY" "ec2-user@$EC2_INSTANCE" << EOF
    cd $REMOTE_DIR
    
    # Add any setup commands here, for example:
    # npm install
    # pm2 restart all
EOF

echo "Deployment to $EC2_INSTANCE completed."