#!/usr/bin/env python3

import os
import getpass
from pathlib import Path

def generate_tfvars():
    """Generate terraform.tfvars with system username."""
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

if __name__ == "__main__":
    generate_tfvars()
