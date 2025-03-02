#!/usr/bin/env python3

import os
import subprocess
import pathlib
import re
import sys
import time
import json
import argparse

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

def get_owner_tag(prefix=None):
    """Get the owner tag from command-line argument, environment or terraform.tfvars."""
    # First check if a prefix was provided as a command-line argument
    if prefix:
        return prefix
        
    # Check if we're running on GitHub Actions main branch
    github_ref = os.getenv('GITHUB_REF')
    if github_ref and github_ref == 'refs/heads/main':
        # Use a fixed production tag for main branch
        return "master"
    
    # For any other case, try to read from terraform.tfvars
    try:
        with open(TERRAFORM_DIR / "terraform.tfvars", "r") as f:
            content = f.read()
            match = re.search(r'owner_tag\s*=\s*"([^"]+)"', content)
            if match:
                return match.group(1)
    except (FileNotFoundError, IOError):
        pass
        
    # If no terraform.tfvars, check if we're in GitHub Actions
    owner = os.getenv('GITHUB_ACTOR')
    if owner:
        return owner
        
    # Fallback to system username for local runs
    import getpass
    return getpass.getuser()

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
                subscription_id = result
                print(f"Using Azure Subscription ID from CLI: {subscription_id}")
                return subscription_id
        except subprocess.CalledProcessError:
            print("Warning: Could not get subscription ID from Azure CLI")
    
    if not subscription_id:
        print("Error: Azure subscription ID not found. Make sure you're logged in to Azure CLI or ARM_SUBSCRIPTION_ID is set.")
    else:
        print(f"Using Azure Subscription ID from env: {subscription_id}")
        
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

def is_in_terraform_state(resource_address):
    """Check if a resource is already in the Terraform state."""
    try:
        result = subprocess.run(
            ["terraform", "state", "list", resource_address],
            cwd=TERRAFORM_DIR,
            capture_output=True,
            text=True,
            check=False
        )
        # If the command returns the resource address, it's in the state
        return resource_address in result.stdout
    except Exception:
        # If there's an error, assume it's not in the state
        return False

def import_existing_resources(owner_tag):
    """Import existing resources into Terraform state."""
    print(f"Searching for existing resources with prefix '{owner_tag}-biteswipe'...")
    
    # Get subscription ID (and validate it's not None)
    subscription_id = get_azure_subscription_id()
    if not subscription_id:
        print("Cannot import resources: No valid subscription ID")
        return []
        
    # Define resources to import
    resources_to_import = [
        ("Microsoft.Network/publicIPAddresses", f"{owner_tag}-biteswipe-public-ip", "azurerm_public_ip", "public_ip"),
        ("Microsoft.Network/virtualNetworks", f"{owner_tag}-biteswipe-network", "azurerm_virtual_network", "vnet"),
        ("Microsoft.Network/networkInterfaces", f"{owner_tag}-biteswipe-nic", "azurerm_network_interface", "nic"),
        ("Microsoft.Compute/virtualMachines", f"{owner_tag}-biteswipe", "azurerm_linux_virtual_machine", "vm"),
        ("Microsoft.Network/networkSecurityGroups", f"{owner_tag}-biteswipe-nsg", "azurerm_network_security_group", "nsg")
    ]
    
    imported_resources = []
    
    for resource_type, resource_name, tf_type, tf_name in resources_to_import:
        try:
            # Check if the resource exists first
            try:
                subprocess.run(
                    ["az", "resource", "show",
                     "--resource-group", f"{owner_tag}-biteswipe-resources",
                     "--resource-type", resource_type,
                     "--name", resource_name],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            except subprocess.CalledProcessError:
                print(f"Resource {resource_type}/{resource_name} does not exist, skipping import")
                continue
                
            # Check if resource is already in the Terraform state
            resource_address = f"{tf_type}.{tf_name}"
            if is_in_terraform_state(resource_address):
                print(f"Resource {resource_name} is already in Terraform state as {resource_address}, skipping import")
                imported_resources.append((resource_type, resource_name))
                continue
                
            resource_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/{resource_type}/{resource_name}"
            print(f"Importing {resource_name} as {tf_type}.{tf_name}...")
            subprocess.run(
                ["terraform", "import", f"{tf_type}.{tf_name}", resource_id],
                cwd=TERRAFORM_DIR,
                check=True
            )
            print(f"Successfully imported {tf_type}: {tf_name}")
            imported_resources.append((resource_type, resource_name))
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to import {tf_type}: {tf_name}")
            print(f"Error: {e}")
    
    # Try to import network interface associations after all resources are imported
    try:
        # Check if both the NIC and NSG were imported successfully
        if any(r[0] == "Microsoft.Network/networkInterfaces" for r in imported_resources) and \
           any(r[0] == "Microsoft.Network/networkSecurityGroups" for r in imported_resources):
                
            # Check if the association is already in the state
            if is_in_terraform_state("azurerm_network_interface_security_group_association.nic_nsg_association"):
                print("Network interface association already in state, skipping import")
                return imported_resources
                
            print("Importing network interface association...")
            nic_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic"
            nsg_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
            association_id = f"{nic_id}|{nsg_id}"
            
            # Import the network interface association
            subprocess.run(
                ["terraform", "import", "azurerm_network_interface_security_group_association.nic_nsg_association", association_id],
                cwd=TERRAFORM_DIR,
                check=True
            )
            print("Successfully imported network interface association")
    except subprocess.CalledProcessError:
        print("Warning: Failed to import network interface association")
        
    return imported_resources

def run_terraform_commands(owner_tag):
    """Run Terraform plan and apply commands with prompt for approval."""
    print("\n🔍 Running Terraform init...")
    if not run_command("terraform init", cwd=TERRAFORM_DIR):
        return False
        
    # Try to import existing resource group if it exists
    print("\n🔍 Checking for existing resource group...")
    import_resource_group_script = script_dir / "import_resource_group.sh"
    if os.path.exists(import_resource_group_script):
        # Pass owner_tag as an argument to the script
        if not run_command(f"{import_resource_group_script} {owner_tag}", cwd=script_dir):
            print("Warning: Resource group import failed, but continuing with deployment")
            
    # Try to import other existing resources
    print("\n🔍 Checking for existing Azure resources...")
    try:
        import_existing_resources(owner_tag)
    except Exception as e:
        print(f"Warning: Resource import failed: {e}")
        print("Continuing with deployment...")
        
    print("\n📋 Running Terraform plan...")
    if not run_command("terraform plan -out=tfplan", cwd=TERRAFORM_DIR):
        return False
        
    print("\n🚀 Running Terraform apply...")
    return run_command("terraform apply -auto-approve tfplan", cwd=TERRAFORM_DIR)


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


def main(prefix=None):
    """Main function to deploy infrastructure."""
    # Get owner tag and generate terraform.tfvars
    owner_tag = get_owner_tag(prefix)
    
    set_script_directory()
    set_terraform_directory()
    kill_terraform_processes()
    
    # Generate tfvars
    print(f"\nUsing owner tag: {owner_tag}")
    print("\n📝 Generating terraform.tfvars...")
    generate_tfvars_script = script_dir / "generate_tfvars.py"
    if not run_command(f"{generate_tfvars_script} {owner_tag}", cwd=script_dir):
        sys.exit(1)
    
    run_terraform_commands(owner_tag)
    update_ssh_config()



if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Deploy Azure infrastructure for BiteSwipe.')
    parser.add_argument('--prefix', type=str, help='Prefix for resource names (overrides GITHUB_ACTOR/username)')
    args = parser.parse_args()
    
    # Call the main function
    main(args.prefix)
