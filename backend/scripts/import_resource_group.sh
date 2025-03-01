#!/bin/bash
# Script to import existing resource group into Terraform state

# Get owner tag (could be from environment or parameters)
OWNER_TAG=${GITHUB_ACTOR:-$(whoami)}
RESOURCE_GROUP="${OWNER_TAG}-biteswipe-resources"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "Importing resource group: $RESOURCE_GROUP"
cd $(dirname $0)/../terraform

# Initialize Terraform
terraform init

# Import the resource group
terraform import azurerm_resource_group.rg "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

echo "Resource group import completed. You can now run deploy_infra.py"
