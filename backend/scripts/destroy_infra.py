#!/usr/bin/env python3

import os
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    """Run a command and return its output."""
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        print(f"Error output: {e.stderr}")
        return False

def destroy_infrastructure():
    """Destroy the Azure infrastructure using Terraform."""
    # Get the directory containing this script
    script_dir = Path(__file__).parent.absolute()
    
    # Navigate to the Terraform directory
    terraform_dir = script_dir.parent / "terraform"
    
    if not terraform_dir.exists():
        print(f"Error: Terraform directory not found at {terraform_dir}")
        sys.exit(1)

    print("🔥 Starting infrastructure destruction...")
    
    # Initialize Terraform if needed
    print("\n📦 Initializing Terraform...")
    if not run_command("terraform init", cwd=terraform_dir):
        sys.exit(1)

    # Run terraform destroy with auto-approve
    print("\n💥 Destroying infrastructure...")
    if not run_command("terraform destroy -auto-approve", cwd=terraform_dir):
        print("❌ Failed to destroy infrastructure")
        sys.exit(1)

    print("\n✅ Infrastructure successfully destroyed!")

if __name__ == "__main__":
    destroy_infrastructure()
