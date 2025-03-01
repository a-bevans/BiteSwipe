#!/usr/bin/env python3

import os
import subprocess
import pathlib
import re
import sys
import time
import json

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

def get_owner_tag():
    """Get the owner tag from terraform.tfvars."""
    try:
        with open(TERRAFORM_DIR / "terraform.tfvars", "r") as f:
            content = f.read()
            match = re.search(r'owner_tag\s*=\s*"([^"]+)"', content)
            if match:
                return match.group(1)
    except (FileNotFoundError, IOError):
        pass
    return "runner"  # Default value

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


def get_azure_resources(owner_tag):
    """Get all Azure resources with the given prefix."""
    try:
        # List all resources in the resource group
        result = subprocess.check_output(
            ["az", "resource", "list", 
             "--resource-group", f"{owner_tag}-biteswipe-resources",
             "--query", "[].{name: name, type: type, id: id}",
             "--output", "json"],
            text=True
        )
        return json.loads(result)
    except subprocess.CalledProcessError:
        print(f"Warning: Could not list resources in resource group {owner_tag}-biteswipe-resources")
        return []

def get_terraform_resource_type(azure_type):
    """Convert Azure resource type to Terraform resource type."""
    # Map of Azure resource types to Terraform resource types
    type_map = {
        'Microsoft.Network/virtualNetworks': 'azurerm_virtual_network',
        'Microsoft.Network/publicIPAddresses': 'azurerm_public_ip',
        'Microsoft.Network/networkSecurityGroups': 'azurerm_network_security_group',
        'Microsoft.Network/networkInterfaces': 'azurerm_network_interface',
        'Microsoft.Network/virtualNetworks/subnets': 'azurerm_subnet',
        'Microsoft.Compute/virtualMachines': 'azurerm_linux_virtual_machine',
        'Microsoft.Resources/resourceGroups': 'azurerm_resource_group'
    }
    return type_map.get(azure_type)

def get_terraform_resource_name(resource_name, owner_tag):
    """Generate Terraform resource name from Azure resource name."""
    # Remove the owner prefix from resource name
    name = resource_name.replace(f"{owner_tag}-biteswipe-", "")
    
    # Map of Azure resource names to Terraform resource names
    name_map = {
        'network': 'vnet',
        'public-ip': 'public_ip',
        'nsg': 'nsg',
        'nic': 'nic',
        'internal': 'subnet',
        'resources': 'rg'
    }
    return name_map.get(name, name)

def get_azure_subscription_id():
    """Get the Azure subscription ID from environment or from az CLI."""
    subscription_id = os.getenv('ARM_SUBSCRIPTION_ID')
    if not subscription_id:
        try:
            # Try to get the subscription ID using az CLI
            result = subprocess.check_output(
                ["az", "account", "show", "--query", "id", "-o", "tsv"],
                text=True
            ).strip()
            if result:
                return result
        except subprocess.CalledProcessError:
            print("Warning: Could not get subscription ID from Azure CLI")
    return subscription_id

def import_resource_group(owner_tag):
    """Import the resource group into Terraform state."""
    subscription_id = get_azure_subscription_id()
    if not subscription_id:
        print("Warning: Azure subscription ID not found. Skipping resource group import.")
        return False
        
    resource_group_name = f"{owner_tag}-biteswipe-resources"
    resource_id = f"/subscriptions/{subscription_id}/resourceGroups/{resource_group_name}"
    
    try:
        # Check if the resource group exists
        print(f"Checking if resource group {resource_group_name} exists...")
        result = subprocess.run(
            ["az", "group", "show", "--name", resource_group_name],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            print(f"Resource group {resource_group_name} does not exist.")
            return False
            
        print(f"Resource group {resource_group_name} exists. Importing to Terraform state...")
        subprocess.run(
            ["terraform", "import", "azurerm_resource_group.rg", resource_id],
            cwd=TERRAFORM_DIR,
            check=True
        )
        print(f"Successfully imported resource group {resource_group_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to import resource group {resource_group_name}")
        print(f"Error: {e}")
        return False

def import_existing_resources(owner_tag):
    """Import existing Azure resources into Terraform state."""
    print(f"Searching for existing resources with prefix '{owner_tag}-biteswipe'...")
    
    # Get the subscription ID
    subscription_id = get_azure_subscription_id()
    if not subscription_id:
        print("Warning: Azure subscription ID not found. Skipping resource import.")
        return
    
    # Get all resources in the resource group
    resources = get_azure_resources(owner_tag)
    
    for resource in resources:
        tf_type = get_terraform_resource_type(resource['type'])
        if tf_type:
            tf_name = get_terraform_resource_name(resource['name'], owner_tag)
            try:
                print(f"Importing {resource['name']} as {tf_type}.{tf_name}...")
                subprocess.run(
                    ["terraform", "import", f"{tf_type}.{tf_name}", resource['id']],
                    cwd=TERRAFORM_DIR,
                    check=True
                )
                print(f"Successfully imported {tf_type}: {tf_name}")
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to import {tf_type}: {tf_name}")
                print(f"Error: {e}")

    # Try to import network interface associations after all resources are imported
    try:
        nic_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic"
        nsg_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
        association_id = f"{nic_id}|{nsg_id}"
        
        subprocess.run(
            ["terraform", "import", "azurerm_network_interface_security_group_association.nic_nsg_association", association_id],
            cwd=TERRAFORM_DIR,
            check=True
        )
        print("Successfully imported network interface association")
    except subprocess.CalledProcessError:
        print("Warning: Failed to import network interface association")

def run_terraform_commands():
    """Run terraform commands to deploy infrastructure."""
    # Run terraform init
    print("Initializing terraform...")
    subprocess.run(["terraform", "init"], cwd=TERRAFORM_DIR, check=True)
    
    # Get the owner tag from terraform variables
    owner_tag = get_owner_tag()

    # First attempt to import the resource group if it exists
    # This helps avoid errors when the resource group exists but isn't in Terraform state
    try:
        import_resource_group(owner_tag)
    except Exception as e:
        print(f"Warning: Error during resource group import: {e}")
    
    # Try to import existing resources
    try:
        import_existing_resources(owner_tag)
    except Exception as e:
        print(f"Warning: Error during resource import: {e}")
        
    # Run terraform apply
    print("Applying new infrastructure...")
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
