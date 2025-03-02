#!/usr/bin/env python3
import json
import os
import pathlib
import subprocess
import time
import re
import getpass

# Determine the path to the terraform directory relative to the script
script_dir = pathlib.Path(__file__).resolve().parent
TERRAFORM_DIR = script_dir / '../terraform'

def get_owner_tag():
    """Get owner tag from environment or system username."""
    # First try to get from GITHUB_ACTOR environment variable
    owner = os.getenv('GITHUB_ACTOR')
    if not owner:
        # Fallback to system username
        owner = getpass.getuser()
    
    return owner

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
    try:
        subprocess.run(
            ["az", "resource", "show",
             "--resource-group", f"{owner_tag}-biteswipe-resources",
             "--resource-type", resource_type,
             "--name", resource_name],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except subprocess.CalledProcessError:
        return False

def import_resource(owner_tag, azure_type, resource_name, tf_type, tf_name):
    """Import a resource into Terraform state if it exists."""
    if not resource_exists(owner_tag, azure_type, resource_name):
        print(f"Resource {azure_type}/{resource_name} does not exist, skipping import")
        return False

    try:
        resource_id = f"/subscriptions/{os.getenv('ARM_SUBSCRIPTION_ID')}/resourceGroups/{owner_tag}-biteswipe-resources/providers/{azure_type}/{resource_name}"
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
            nic_id = f"/subscriptions/{os.getenv('ARM_SUBSCRIPTION_ID')}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkInterfaces/{owner_tag}-biteswipe-nic"
            nsg_id = f"/subscriptions/{os.getenv('ARM_SUBSCRIPTION_ID')}/resourceGroups/{owner_tag}-biteswipe-resources/providers/Microsoft.Network/networkSecurityGroups/{owner_tag}-biteswipe-nsg"
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

def destroy_resource(owner_tag, resource_type, resource_name, force=False):
    """Try to destroy a specific Azure resource."""
    try:
        print(f"Attempting to delete {resource_type}/{resource_name}...")
        subprocess.run(
            ["az", "resource", "delete",
             "--resource-group", f"{owner_tag}-biteswipe-resources",
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

def destroy_infrastructure():
    """Destroy the Azure infrastructure in the correct order."""
    # Initialize Terraform
    subprocess.run(["terraform", "init"], cwd=TERRAFORM_DIR, check=True)

    # Get owner tag and generate tfvars
    owner_tag = get_owner_tag()
    generate_tfvars(owner_tag)
    
    # Import all existing resources
    import_existing_resources(owner_tag)

    # Check if resource group exists and try to delete it first
    resource_group_name = f"{owner_tag}-biteswipe-resources"
    print(f"\nChecking if resource group {resource_group_name} exists...")
    try:
        result = subprocess.run(
            ["az", "group", "show", "--name", resource_group_name],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            print(f"Resource group {resource_group_name} exists. Attempting direct deletion...")
            try:
                # Try to delete the resource group directly first
                subprocess.run(
                    ["az", "group", "delete",
                     "--name", resource_group_name,
                     "--yes"],
                    check=True
                )
                print("✅ Successfully deleted resource group directly")
                return True
            except subprocess.CalledProcessError:
                print("Direct resource group deletion failed, falling back to individual resource deletion...")
    except Exception as e:
        print(f"Error checking resource group: {e}")

    # Define resource deletion order
    resource_order = [
        # First delete the VM
        ("Microsoft.Compute/virtualMachines", f"{owner_tag}-biteswipe"),
        
        # Then delete network interface associations
        ("Microsoft.Network/networkInterfaces", f"{owner_tag}-biteswipe-nic"),
        
        # Then delete the subnet
        ("Microsoft.Network/virtualNetworks/subnets", f"{owner_tag}-internal"),
        
        # Then delete networking resources
        ("Microsoft.Network/publicIPAddresses", f"{owner_tag}-biteswipe-public-ip"),
        ("Microsoft.Network/networkSecurityGroups", f"{owner_tag}-biteswipe-nsg"),
        ("Microsoft.Network/virtualNetworks", f"{owner_tag}-biteswipe-network"),
    ]

    max_attempts = 3
    for attempt in range(max_attempts):
        print(f"\nAttempt {attempt + 1} of {max_attempts}")
        failed_resources = []

        # Try to delete resources in order
        for resource_type, resource_name in resource_order:
            if not destroy_resource(owner_tag, resource_type, resource_name, force=(attempt > 0)):
                failed_resources.append((resource_type, resource_name))

        if not failed_resources:
            print("\nAll resources deleted successfully!")
            break
        elif attempt < max_attempts - 1:
            print(f"\nSome resources failed to delete. Waiting before retry...")
            print("Failed resources:", failed_resources)
            time.sleep(30)  # Wait before next attempt
        else:
            print("\nFailed to delete some resources after all attempts.")
            print("Failed resources:", failed_resources)
            
            # As a last resort, try to delete the entire resource group
            print("\nAttempting to delete entire resource group...")
            try:
                subprocess.run(
                    ["az", "group", "delete",
                     "--name", f"{owner_tag}-biteswipe-resources",
                     "--yes", "--force"],
                    check=True
                )
                print("Successfully deleted resource group")
            except subprocess.CalledProcessError as e:
                print(f"Failed to delete resource group: {e}")
                
                # If that fails too, try Terraform destroy
                print("\nAttempting Terraform destroy as last resort...")
                try:
                    subprocess.run(
                        ["terraform", "destroy", "-auto-approve=true"],
                        cwd=TERRAFORM_DIR,
                        check=True
                    )
                    print("Successfully destroyed infrastructure via Terraform")
                except subprocess.CalledProcessError as e:
                    print(f"Terraform destroy also failed: {e}")
                    print("Manual cleanup may be required.")
                    return False

    return True

if __name__ == "__main__":
    if destroy_infrastructure():
        print("\n✅ Infrastructure destruction completed!")
    else:
        print("\n❌ Infrastructure destruction failed. Some resources may need manual cleanup.")
