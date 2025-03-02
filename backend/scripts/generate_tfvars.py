#!/usr/bin/env python3

import os
import getpass
import sys
from pathlib import Path

def generate_tfvars(custom_owner_tag=None):
    """Generate terraform.tfvars with custom tag, GitHub actor, or system username."""
    # Priority: 1. Custom owner tag (if provided)
    #          2. GitHub Actions environment for main branch
    #          3. GitHub actor environment variable
    #          4. System username
    
    if custom_owner_tag:
        # Use the provided custom owner tag
        username = custom_owner_tag
    elif os.environ.get('GITHUB_REF') == 'refs/heads/main':
        # Use a fixed production tag for main branch
        username = "master"
    else:
        # Get the username from GitHub Actions or system
        username = os.environ.get('GITHUB_ACTOR') or getpass.getuser()
    
    # Get the terraform directory
    script_dir = Path(__file__).parent.absolute()
    terraform_dir = script_dir.parent / "terraform"
    
    # Create tfvars content
    tfvars_content = f'owner_tag = "{username}"\n'
    
    # Write to terraform.tfvars
    tfvars_path = terraform_dir / "terraform.tfvars"
    with open(tfvars_path, 'w') as f:
        f.write(tfvars_content)
    
    print(f"Generated terraform.tfvars with owner_tag = {username}")
    return username

if __name__ == "__main__":
    # Check for command-line argument
    custom_tag = sys.argv[1] if len(sys.argv) > 1 else None
    generate_tfvars(custom_tag)
