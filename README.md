# BiteSwipe

# Backend Deployment Instructions

## Azure VM Deployment

- SSH key setup:
  1. Download the private and public key pair from the shared Google drive.
  2. Fix permissions on the private key:
     ```bash
     chmod 400 <path>/CPEN321.pem
     ```
  3. update terraform/variables.tf with the key path (DO NOT GIT CHECK THIS CHANGE)
- Install azure-cli: `brew install azure-cli`
- Azure Login:
  1. Run: `az login`
  2. Browser will open, sign in with your Azure account
  3. Verify login with: `az account show`

- Terraform:
  1. Run this to create or update the Azure resources with your code 
  ```Bash
    <repo_root>/backend/scripts/deploy_infra.py
  ```
  2. when done run
  ```Bash
    <repo_root>/backend/scripts/destroy_infra.py
  ```