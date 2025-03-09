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
        
    # Check if we're running on GitHub Actions main or develop branch
    github_ref = os.getenv('GITHUB_REF')
    if github_ref:
        if github_ref == 'refs/heads/main':
            # Use a fixed production tag for main branch
            return "master"
        elif github_ref == 'refs/heads/develop':
            # Use a fixed development tag for develop branch
            return "dev"
    
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
    """Run a command and stream its output in real-time."""
    try:
        # Use Popen to create a process we can read from as it runs
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line buffered
        )
        
        # Stream output in real-time
        stdout_data = []
        stderr_data = []
        
        # Function to handle output stream
        def read_stream(stream, data_list, prefix):
            for line in iter(stream.readline, ''):
                if line:
                    print(f"{prefix}: {line.rstrip()}")
                    data_list.append(line)
            stream.close()
        
        # Create threads to read stdout and stderr concurrently
        import threading
        stdout_thread = threading.Thread(target=read_stream, args=(process.stdout, stdout_data, "OUT"))
        stderr_thread = threading.Thread(target=read_stream, args=(process.stderr, stderr_data, "ERR"))
        
        # Start the threads
        stdout_thread.start()
        stderr_thread.start()
        
        # Wait for threads to complete
        stdout_thread.join()
        stderr_thread.join()
        
        # Wait for the process to finish and get the return code
        return_code = process.wait()
        
        if return_code == 0:
            return True
        else:
            print(f"Command failed with exit code: {return_code}")
            return False
            
    except Exception as e:
        print(f"Exception occurred while executing command: {command}")
        print(f"Exception details: {e}")
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
    print(f"\n🔍 Searching for existing resources with prefix '{owner_tag}-biteswipe'...")
    
    # Get subscription ID
    subscription_id = get_azure_subscription_id()
    if not subscription_id:
        print("Cannot import resources: No valid subscription ID")
        return False

    # Define specific resources to import
    resources_to_import = [
        {
            'type': 'azurerm_resource_group',
            'name': 'rg',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources"
        },
        {
            'type': 'azurerm_subnet',
            'name': 'subnet',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/virtualNetworks/{owner_tag}-biteswipe-network/subnets/{owner_tag}-internal"
        },
        {
            'type': 'azurerm_virtual_network',
            'name': 'vnet',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/virtualNetworks/{owner_tag}-biteswipe-network"
        },
        {
            'type': 'azurerm_network_security_group',
            'name': 'nsg',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
        },
        {
            'type': 'azurerm_public_ip',
            'name': 'public_ip',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/publicIPAddresses/{owner_tag}-biteswipe-public-ip"
        },
        {
            'type': 'azurerm_network_interface',
            'name': 'nic',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic"
        },
        {
            'type': 'azurerm_linux_virtual_machine',
            'name': 'vm',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Compute/virtualMachines/{owner_tag}-biteswipe"
        },
        {
            'type': 'azurerm_network_interface_security_group_association',
            'name': 'nic_nsg_association',
            'id': f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic|/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
        }
    ]

    success = True
    for resource in resources_to_import:
        resource_type = resource['type']
        resource_name = resource['name']
        resource_id = resource['id']

        # Check if resource already exists in Terraform state
        check_state_cmd = f"terraform state show {resource_type}.{resource_name}"
        result = subprocess.run(check_state_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        if result.returncode == 0:
            print(f"Resource {resource_type}.{resource_name} already in Terraform state, skipping import.")
            continue

        # For network interface security group association, we need to check if it exists in Azure first
        if resource_type == 'azurerm_network_interface_security_group_association':
            # Extract NIC and NSG IDs from the composite ID
            nic_id, nsg_id = resource_id.split('|')
            
            # Check if the association exists by checking if the NIC has an NSG
            check_cmd = ["az", "network", "nic", "show", "--ids", nic_id, "--query", "networkSecurityGroup.id", "-o", "tsv"]
            result = subprocess.run(check_cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout.strip() == nsg_id:
                print(f"Importing {resource_type}.{resource_name}...")
                import_cmd = f"terraform import {resource_type}.{resource_name} '{resource_id}'"
                subprocess.run(import_cmd, shell=True, check=True)
                print(f"✅ Successfully imported {resource_type}.{resource_name}")
            else:
                print(f"Resource {resource_id} does not exist in Azure, skipping...")
            continue

        # For all other resources, check if they exist in Azure
        print(f"Importing {resource_type}.{resource_name}...")
        import_cmd = f"terraform import {resource_type}.{resource_name} {resource_id}"
        try:
            subprocess.run(import_cmd, shell=True, check=True)
            print(f"✅ Successfully imported {resource_type}.{resource_name}")
        except subprocess.CalledProcessError as e:
            print(f"Failed to import {resource_type}.{resource_name}: {e}")
            success = False

    if success:
        print("\n✅ All resources imported successfully!")
    else:
        print("\n⚠️ Some resources failed to import. Check the logs above for details.")
    
    return success

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
    
    # Get the public IP from Terraform output with retries
    max_retries = 5
    retry_delay = 10  # Start with 10 seconds
    server_ip = None
    
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Attempt {attempt}/{max_retries}: Getting server IP from Terraform output...")
            server_ip = subprocess.check_output(
                ["terraform", "output", "-raw", "server_public_ip"],
                cwd=TERRAFORM_DIR
            ).decode('utf-8').strip()
            
            if server_ip:
                print(f"Successfully retrieved server IP: {server_ip}")
                break
            else:
                print("Warning: Empty server IP returned from Terraform output.")
        except subprocess.CalledProcessError as e:
            print(f"Warning: Could not get server IP from Terraform output (Attempt {attempt}/{max_retries})")
            print(f"Error details: {str(e)}")
            
            if attempt < max_retries:
                wait_time = retry_delay * (2 ** (attempt - 1))  # Exponential backoff
                print(f"Waiting {wait_time} seconds before retry...")
                time.sleep(wait_time)
            else:
                print("Error: Failed to get server IP after multiple attempts.")
                print("Please ensure Terraform has been applied successfully and the Azure resources are properly created.")
                raise Exception("Failed to retrieve server public IP from Terraform output")
    
    if not server_ip:
        print("Error: Unable to obtain a valid server IP after all retry attempts.")
        raise Exception("Failed to obtain a valid server IP")

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
