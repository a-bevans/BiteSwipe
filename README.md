# BiteSwipe

# Frontend Deployment Instructions

### For development
- View Project Files
1. Clone the repo into a folder of your choice
2. In Android Studio, Open an existing project. Use the path ` BiteSwipe/Frontend`. Gradle should build and set up project dependencies automatically.

- Manage Backend Requests
1. Change the value in strings.js to the http server
2. In the login page, find the email and displayName parameters, and set your own custom values to hide data.
3. In the ApiHelper class, make sure to change the format to support http requests instead. This saves in cost.
### Deploying Frontend
1. Find the cert.pfx file in the google drive. It is in the path `M4/need_for_https`. Download and store it locally.
2. Convert this into a .crt file using the following code:
```
openssl pkcs12 -in cert.pfx -clcerts -nokeys -out server.crt

```
3. In the android studio project, create a new directory under `/res` called `raw`. Paste the server.crt file in there.
4. Hit Build -> Build APK. You can install the output file in the directory of your choice. 

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