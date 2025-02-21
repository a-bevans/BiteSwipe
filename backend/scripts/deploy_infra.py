#!/usr/bin/env python3

import os
import subprocess
import pathlib
import re
import sys

# Determine the path to the terraform directory relative to the script
script_dir = pathlib.Path(__file__).resolve().parent
TERRAFORM_DIR = script_dir.parent / 'terraform'

def get_terraform_variable(var_name):
    """Read a variable value from the Terraform variables file."""
    variables_file = TERRAFORM_DIR / 'variables.tf'
    with open(variables_file, 'r') as f:
        content = f.read()
    
    # Find the variable block
    pattern = rf'variable\s+"{var_name}"\s+{{.*?default\s+=\s+"([^"]+)".*?}}'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        return match.group(1)
    raise ValueError(f"Variable {var_name} not found in variables.tf")

# Get the private key path from Terraform variables
AZURE_VM_PRIVATE_KEY_PATHNAME_STR = get_terraform_variable("ssh_private_key_path")

AZURE_VM_PRIVATE_KEY_PATHNAME = (
    pathlib.Path(AZURE_VM_PRIVATE_KEY_PATHNAME_STR).expanduser().resolve()
)
# validate the key path
if not AZURE_VM_PRIVATE_KEY_PATHNAME.is_file():
    raise ValueError("Private key file not found at the specified path.")


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

def set_script_directory():
    # Get the directory where the script is located
    os.chdir(os.path.dirname(os.path.abspath(__file__)))


def set_terraform_directory():
    # Change to the Terraform directory
    os.chdir(TERRAFORM_DIR)


def kill_terraform_processes():
    # Kill any existing terraform processes
    subprocess.run(["pkill", "terraform"], check=False)


def clean_lock_files():
    # Clean up any existing lock files
    lock_files = [".terraform.tfstate.lock.info", "terraform.tfstate.lock.info"]
    for lock_file in lock_files:
        if os.path.exists(lock_file):
            os.remove(lock_file)


def force_unlock_terraform():
    # Force unlock if there's a lock
    try:
        command = "terraform force-unlock 2>&1"
        if os.name == "nt":  # Windows
            grep_command = 'findstr /C:"Lock Info:" /C:"ID:"'
            awk_command = 'for /f "tokens=2" %i in (\'findstr /C:"ID:"\') do @echo %i'
        else:  # Unix-like systems
            grep_command = "grep 'Lock Info:' -A 2 | grep 'ID:'"
            awk_command = "awk '{print $2}'"

        # Build the full command
        full_command = f"{command} | {grep_command} | {awk_command}"

        # Execute the command to get the lock ID
        lock_id = subprocess.check_output(full_command, shell=True, text=True).strip()

        # If a lock ID was found, force unlock
        if lock_id:
            subprocess.run(
                ["terraform", "force-unlock", "-force", lock_id], check=False
            )
    except subprocess.CalledProcessError:
        pass


def run_terraform_commands():
    # Run terraform commands with auto-approve
    subprocess.run(["terraform", "init", "-input=false"], cwd=TERRAFORM_DIR, check=True)
    subprocess.run(["terraform", "apply", "-auto-approve=true"], cwd=TERRAFORM_DIR, check=True)


def update_ssh_config():
    """Update SSH config with the new server IP."""
    script_path = script_dir / "update_ssh_config_with_new_ips.py"
    
    # Get the public IP from Terraform output
    try:
        server_ip = subprocess.check_output(
            ["terraform", "output", "-raw", "server_public_ip"],
            cwd=TERRAFORM_DIR
        ).decode('utf-8').strip()
    except subprocess.CalledProcessError:
        print("Warning: Could not get server IP from Terraform output. Waiting for IP to be available...")
        # Wait a bit and try again as sometimes it takes time for the IP to be assigned
        import time
        time.sleep(30)
        server_ip = subprocess.check_output(
            ["terraform", "output", "-raw", "server_public_ip"],
            cwd=TERRAFORM_DIR
        ).decode('utf-8').strip()

    subprocess.run(
        [
            "python3",
            str(script_path),
            "CPEN321_SERVER",
            server_ip,
            str(AZURE_VM_PRIVATE_KEY_PATHNAME),
        ],
        check=True,
    )


def main():
    set_script_directory()
    set_terraform_directory()
    kill_terraform_processes()
    clean_lock_files()
    force_unlock_terraform()
    
    # Generate tfvars first
    print("\n📝 Generating terraform.tfvars...")
    generate_tfvars_script = script_dir / "generate_tfvars.py"
    if not run_command(f"{generate_tfvars_script}", cwd=script_dir):
        sys.exit(1)
    
    run_terraform_commands()
    update_ssh_config()



if __name__ == "__main__":
    main()
