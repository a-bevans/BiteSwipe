#!/usr/bin/env python3
import os
import subprocess
import pathlib
import getpass

# Determine the path to the terraform directory relative to the script
script_dir = pathlib.Path(__file__).resolve().parent
TERRAFORM_DIR = script_dir.parent / 'terraform'

def get_owner_tag():
    """Get owner tag from environment or system username."""
    # First try to get from GITHUB_ACTOR environment variable
    owner = os.getenv('GITHUB_ACTOR')
    if not owner:
        # Fallback to system username
        owner = getpass.getuser()
    
    return owner

def import_resource_group(owner_tag):
    """Import the resource group into Terraform state."""
    resource_group_name = f"{owner_tag}-biteswipe-resources"
    terraform_resource = "azurerm_resource_group.rg"
    
    print(f"Checking if resource group {resource_group_name} exists...")
    
    # Check if the resource group exists
    try:
        result = subprocess.run(
            ["az", "group", "show", 
             "--name", resource_group_name],
            capture_output=True, 
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            print(f"Resource group {resource_group_name} does not exist.")
            return False
            
        print(f"Resource group {resource_group_name} exists. Importing into Terraform state...")
        
        # Import the resource group into Terraform state
        import_result = subprocess.run(
            ["terraform", "import", terraform_resource, 
             f"/subscriptions/{os.getenv('ARM_SUBSCRIPTION_ID')}/resourceGroups/{resource_group_name}"],
            cwd=TERRAFORM_DIR,
            capture_output=True,
            text=True,
            check=False
        )
        
        if import_result.returncode == 0:
            print(f"Successfully imported resource group {resource_group_name} into Terraform state.")
            return True
        else:
            print(f"Failed to import resource group: {import_result.stderr}")
            return False
            
    except Exception as e:
        print(f"Error checking resource group: {e}")
        return False

if __name__ == "__main__":
    owner_tag = get_owner_tag()
    print(f"Using owner tag: {owner_tag}")
    
    # Initialize terraform first
    subprocess.run(["terraform", "init"], cwd=TERRAFORM_DIR, check=True)
    
    if import_resource_group(owner_tag):
        print("✅ Resource group successfully imported!")
        print("You can now run deploy_infra.py")
    else:
        print("❌ Resource group import failed.")
