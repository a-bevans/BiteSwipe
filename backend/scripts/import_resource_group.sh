#!/bin/bash
# Script to import existing resource group into Terraform state

# Get owner tag (could be from environment or parameters)
OWNER_TAG=${GITHUB_ACTOR:-$(whoami)}
RESOURCE_GROUP="${OWNER_TAG}-biteswipe-resources"

# Get subscription ID from environment variable or Azure CLI
SUBSCRIPTION_ID=${ARM_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}

if [ -z "$SUBSCRIPTION_ID" ]; then
    echo "Error: Azure subscription ID not found. Make sure you're logged in to Azure CLI or ARM_SUBSCRIPTION_ID is set."
    exit 1
fi

echo "Using Subscription ID: $SUBSCRIPTION_ID"
echo "Importing resource group: $RESOURCE_GROUP"
cd $(dirname $0)/../terraform

# Initialize Terraform
terraform init

# Import the resource group
terraform import azurerm_resource_group.rg "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

echo "Resource group import completed. You can now run deploy_infra.py"
