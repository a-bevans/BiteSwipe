# BiteSwipe

# Backend Deployment Instructions

## Azure VM Deployment

### Prerequisites
- SSH key setup:
  1. Download the private and public key pair from the shared Google drive.
  2. Fix permissions on the private key:
     ```bash
     chmod 400 <path>/CPEN321.pem
     ```
  3. Update terraform/variables.tf with the key path (DO NOT GIT CHECK THIS CHANGE)
- Install azure-cli: `brew install azure-cli`
- Azure Login:
  1. Run: `az login`
  2. Browser will open, sign in with your Azure account
  3. Verify login with: `az account show`

### Deployment Steps
1. Deploy Infrastructure:
   ```bash
   <repo_root>/backend/scripts/deploy_infra.py
   ```
   This will:
   - Create Azure resources (VM, network, etc.)
   - Deploy your code to the VM
   - Start the application in Docker containers

2. Access Points:
   After deployment, you'll get several URLs:
   - Application: `http://<vm-dns-name>:3000` or `http://<vm-ip>:3000`
   - MongoDB: `mongodb://<vm-dns-name>:27017`
   - SSH Access: `ssh -i <path>/CPEN321.pem adminuser@<vm-ip>`

3. Cleanup:
   When done, destroy the infrastructure:
   ```bash
   <repo_root>/backend/scripts/destroy_infra.py
   ```

### Security Notes
- The VM is configured with open inbound access for development
- For production, restrict the security group rules to specific ports/IPs
- MongoDB is accessible on port 27017 - secure this for production use