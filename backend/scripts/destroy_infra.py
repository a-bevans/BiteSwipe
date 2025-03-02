#!/usr/bin/env python3
import json
import os
import pathlib
import subprocess
import time
import re
import getpass
import argparse
import sys  # Added for sys.exit

# Determine the path to the terraform directory relative to the script
script_dir = pathlib.Path(__file__).resolve().parent
TERRAFORM_DIR = script_dir / '../terraform'

def get_owner_tag(prefix=None):
    """Get owner tag from command-line argument, environment, or system username."""
    # First check if a prefix was provided as a command-line argument
    if prefix:
        return prefix
        
    # Check if we're running on GitHub Actions main branch
    github_ref = os.getenv('GITHUB_REF')
    if github_ref and github_ref == 'refs/heads/main':
        # Use a fixed production tag for main branch
        return "master"
        
    # For any other branch on GH Actions, use GITHUB_ACTOR
    owner = os.getenv('GITHUB_ACTOR')
    if not owner:
        # Fallback to system username for local runs
        owner = getpass.getuser()
    
    return owner

def check_resource_group_exists(resource_group_name):
    """Check if a resource group exists."""
    try:
        result = subprocess.run(
            ["az", "group", "show", "--name", resource_group_name],
            capture_output=True,
            text=True,
            check=False
        )
        return result.returncode == 0
    except Exception:
        return False

def generate_tfvars(owner_tag):
    """Generate terraform.tfvars file."""
    tfvars_content = f'owner_tag = "{owner_tag}"'
    tfvars_file = TERRAFORM_DIR / 'terraform.tfvars'
    
    print(f"📝 Generating terraform.tfvars...")
    with open(tfvars_file, 'w') as f:
        f.write(tfvars_content)
    print(f"Generated terraform.tfvars with owner_tag = {owner_tag}")

def get_azure_resources(owner_tag):
    """Get all Azure resources with the given prefix."""
    try:
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
    name = resource_name.replace(f"{owner_tag}-biteswipe-", "")
    name_map = {
        'network': 'vnet',
        'public-ip': 'public_ip',
        'nsg': 'nsg',
        'nic': 'nic',
        'internal': 'subnet',
        'resources': 'rg'
    }
    return name_map.get(name, name)

def resource_exists(owner_tag, resource_type, resource_name):
    """Check if an Azure resource exists."""
    resource_group_name = f"{owner_tag}-biteswipe-resources"
    
    # First check if resource group exists
    if not check_resource_group_exists(resource_group_name):
        return False
        
    try:
        subprocess.run(
            ["az", "resource", "show",
             "--resource-group", resource_group_name,
             "--resource-type", resource_type,
             "--name", resource_name],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except subprocess.CalledProcessError:
        return False

def get_azure_subscription_id():
    """Get Azure subscription ID from environment variable or Azure CLI."""
    # First try to get from environment variable
    subscription_id = os.getenv('ARM_SUBSCRIPTION_ID')
    
    # If not found, try to get from Azure CLI
    if not subscription_id:
        try:
            result = subprocess.run(
                ["az", "account", "show", "--query", "id", "-o", "tsv"],
                capture_output=True,
                text=True,
                check=True
            )
            subscription_id = result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Error: Could not get subscription ID from Azure CLI")
            subscription_id = None
            
    if not subscription_id:
        print("Error: Azure subscription ID not found. Make sure you're logged in to Azure CLI or ARM_SUBSCRIPTION_ID is set.")
    else:
        print(f"Using Azure Subscription ID: {subscription_id}")
        
    return subscription_id

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

def import_resource(owner_tag, azure_type, resource_name, tf_type, tf_name):
    """Import a resource into Terraform state if it exists."""
    if not resource_exists(owner_tag, azure_type, resource_name):
        print(f"Resource {azure_type}/{resource_name} does not exist, skipping import")
        return False
        
    # Get the subscription ID
    subscription_id = get_azure_subscription_id()
    if not subscription_id:
        print(f"Cannot import {resource_name}: No valid subscription ID found")
        return False

    # Check if the resource is already in Terraform state
    resource_address = f"{tf_type}.{tf_name}"
    if is_in_terraform_state(resource_address):
        print(f"Resource {resource_name} is already in Terraform state as {resource_address}, skipping import")
        return True

    try:
        resource_id = f"/subscriptions/{subscription_id}/resourceGroups/{owner_tag}-biteswipe-resources/providers/{azure_type}/{resource_name}"
        print(f"Importing {resource_name} as {tf_type}.{tf_name}...")
        subprocess.run(
            ["terraform", "import", f"{tf_type}.{tf_name}", resource_id],
            cwd=TERRAFORM_DIR,
            check=True
        )
        print(f"Successfully imported {tf_type}: {tf_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to import {tf_type}: {tf_name}")
        print(f"Error: {e}")
        return False

def get_azure_subscription_id():
    """Get Azure subscription ID from environment variable or Azure CLI."""
    # First try to get from environment variable
    subscription_id = os.getenv('ARM_SUBSCRIPTION_ID')
    
    # If not found, try to get from Azure CLI
    if not subscription_id:
        try:
            result = subprocess.run(
                ["az", "account", "show", "--query", "id", "-o", "tsv"],
                capture_output=True,
                text=True,
                check=True
            )
            subscription_id = result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Error: Could not get subscription ID from Azure CLI")
            subscription_id = None
            
    if not subscription_id:
        print("Error: Azure subscription ID not found. Make sure you're logged in to Azure CLI or ARM_SUBSCRIPTION_ID is set.")
    else:
        print(f"Using Azure Subscription ID: {subscription_id}")
        
    return subscription_id

def destroy_resource(owner_tag, resource_type, resource_name, force=False):
    """Try to destroy a specific Azure resource."""
    resource_group_name = f"{owner_tag}-biteswipe-resources"
    
    # Check if the resource group exists first
    if not check_resource_group_exists(resource_group_name):
        print(f"Resource group {resource_group_name} does not exist, skipping deletion of {resource_type}/{resource_name}")
        return True  # Return true since we don't need to delete anything
        
    try:
        print(f"Attempting to delete {resource_type}/{resource_name}...")
        subprocess.run(
            ["az", "resource", "delete",
             "--resource-group", resource_group_name,
             "--resource-type", resource_type,
             "--name", resource_name,
             "--verbose"] + (["--force"] if force else []),
            check=True
        )
        print(f"Successfully deleted {resource_type}/{resource_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to delete {resource_type}/{resource_name}: {e}")
        return False

def import_existing_resources(owner_tag):
    """Import existing Azure resources into Terraform state."""
    print(f"Searching for existing resources with prefix '{owner_tag}-biteswipe'...")
    
    # Define resources to import
    resources_to_import = [
        ("Microsoft.Network/publicIPAddresses", f"{owner_tag}-biteswipe-public-ip", "azurerm_public_ip", "public_ip"),
        ("Microsoft.Network/virtualNetworks", f"{owner_tag}-biteswipe-network", "azurerm_virtual_network", "vnet"),
        ("Microsoft.Network/networkInterfaces", f"{owner_tag}-biteswipe-nic", "azurerm_network_interface", "nic"),
        ("Microsoft.Compute/virtualMachines", f"{owner_tag}-biteswipe", "azurerm_linux_virtual_machine", "vm"),
        ("Microsoft.Network/networkSecurityGroups", f"{owner_tag}-biteswipe-nsg", "azurerm_network_security_group", "nsg")
    ]

    imported_resources = []
    for azure_type, resource_name, tf_type, tf_name in resources_to_import:
        if import_resource(owner_tag, azure_type, resource_name, tf_type, tf_name):
            imported_resources.append((azure_type, resource_name))

    # Try to import network interface association only if both NIC and NSG exist
    if any(r[0] == "Microsoft.Network/networkInterfaces" for r in imported_resources) and \
       any(r[0] == "Microsoft.Network/networkSecurityGroups" for r in imported_resources):
        try:
            nic_id = f"/subscriptions/{get_azure_subscription_id()}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic"
            nsg_id = f"/subscriptions/{get_azure_subscription_id()}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
            association_id = f"{nic_id}|{nsg_id}"
            
            print("Importing network interface association...")
            subprocess.run(
                ["terraform", "import", "azurerm_network_interface_security_group_association.nic_nsg_association", association_id],
                cwd=TERRAFORM_DIR,
                check=True
            )
            print("Successfully imported network interface association")
        except subprocess.CalledProcessError:
            print("Warning: Failed to import network interface association")

def destroy_infrastructure(prefix=None):
    """Destroy the Azure infrastructure in the correct order."""
    # Initialize Terraform
    subprocess.run(["terraform", "init"], cwd=TERRAFORM_DIR, check=True)

    # Get owner tag and generate tfvars
    owner_tag = get_owner_tag(prefix)
    generate_tfvars(owner_tag)
    
    print(f"Using owner tag: {owner_tag}")
    
    # Try to import existing resources first, so Terraform knows what to destroy
    try:
        if check_resource_group_exists(f"{owner_tag}-biteswipe-resources"):
            import_existing_resources(owner_tag)
    except Exception as e:
        print(f"Warning: Error during resource import: {e}")
        print("Continuing with deletion process...")
    
    # Track if any resource group was successfully deleted
    any_resources_deleted = False
    
    # Check for the existence of resource group patterns
    resource_group_patterns = [
        f"{owner_tag}-biteswipe-resources"
    ]
    
    # Only add vm-biteswipe-resources if not using a custom prefix
    if not prefix:
        resource_group_patterns.append("vm-biteswipe-resources")
    
    for rg_name in resource_group_patterns:
        print(f"\nChecking if resource group {rg_name} exists...")
        if check_resource_group_exists(rg_name):
            print(f"Resource group {rg_name} exists. Attempting direct deletion...")
            try:
                # Try to delete the resource group directly
                subprocess.run(
                    ["az", "group", "delete",
                    "--name", rg_name,
                    "--yes"],
                    check=True
                )
                print(f"✅ Successfully deleted resource group {rg_name} directly")
                any_resources_deleted = True
                continue  # Skip to next resource group pattern
            except subprocess.CalledProcessError:
                print(f"Direct resource group deletion failed for {rg_name}, falling back to individual resource deletion...")
        else:
            print(f"Resource group {rg_name} does not exist, skipping")
            continue  # Skip to next resource group pattern
            
        # If we get here, we need to try individual resource deletion
        # Get the resource prefix based on the resource group name
        resource_prefix = "vm" if rg_name.startswith("vm-") else owner_tag
        
        resource_order = [
            # First delete the VM
            ("Microsoft.Compute/virtualMachines", f"{resource_prefix}-biteswipe"),
            
            # Then delete network interface associations
            ("Microsoft.Network/networkInterfaces", f"{resource_prefix}-biteswipe-nic"),
            
            # Then delete the subnet
            ("Microsoft.Network/virtualNetworks/subnets", f"{resource_prefix}-internal"),
            
            # Then delete networking resources
            ("Microsoft.Network/publicIPAddresses", f"{resource_prefix}-biteswipe-public-ip"),
            ("Microsoft.Network/networkSecurityGroups", f"{resource_prefix}-biteswipe-nsg"),
            ("Microsoft.Network/virtualNetworks", f"{resource_prefix}-biteswipe-network"),
        ]

        max_attempts = 3
        for attempt in range(max_attempts):
            print(f"\nAttempt {attempt + 1} of {max_attempts} for {rg_name}")
            failed_resources = []

            # Try to delete resources in order
            for resource_type, resource_name in resource_order:
                if not destroy_resource(resource_prefix, resource_type, resource_name, force=(attempt > 0)):
                    failed_resources.append((resource_type, resource_name))

            if not failed_resources:
                print(f"\nAll resources in {rg_name} deleted successfully!")
                any_resources_deleted = True
                break
            elif attempt < max_attempts - 1:
                print(f"\nSome resources in {rg_name} failed to delete. Waiting before retry...")
                print("Failed resources:", failed_resources)
                time.sleep(30)  # Wait before next attempt
            else:
                print(f"\nFailed to delete some resources in {rg_name} after all attempts.")
                print("Failed resources:", failed_resources)
                
                # As a last resort, try to delete the entire resource group with force
                print(f"\nAttempting to force delete entire resource group {rg_name}...")
                try:
                    subprocess.run(
                        ["az", "group", "delete",
                        "--name", rg_name,
                        "--yes", "--force"],
                        check=True
                    )
                    print(f"Successfully force deleted resource group {rg_name}")
                    any_resources_deleted = True
                except subprocess.CalledProcessError:
                    print(f"Failed to force delete resource group {rg_name}")
    
    # Return success if any resource group was deleted or if no resource groups were found
    # (which means there's nothing to delete, so it's a success)
    return any_resources_deleted or all(not check_resource_group_exists(rg) for rg in resource_group_patterns)

if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Destroy Azure infrastructure for BiteSwipe.')
    parser.add_argument('--prefix', type=str, help='Prefix for resource names (overrides GITHUB_ACTOR/username)')
    args = parser.parse_args()
    
    if destroy_infrastructure(args.prefix):
        print("✅ Infrastructure destroyed successfully")
        sys.exit(0)
    else:
        print("❌ Failed to destroy infrastructure")
        sys.exit(1)
