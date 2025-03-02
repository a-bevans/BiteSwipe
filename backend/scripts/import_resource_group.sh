#!/bin/bash

# Script to import an existing Azure resource group into Terraform state

# Determine the owner tag (custom prefix from command line, GitHub actor, or local username)
if [ "$1" != "" ]; then
    OWNER_TAG="$1"
    echo "Using custom owner tag: $OWNER_TAG"
elif [ "$GITHUB_ACTOR" != "" ]; then
    # Check if we're on main branch, use 'master' tag
    if [ "$GITHUB_REF" = "refs/heads/main" ]; then
        OWNER_TAG="master"
        echo "Using master owner tag for main branch"
    else
        OWNER_TAG="$GITHUB_ACTOR"
        echo "Using GitHub actor: $OWNER_TAG"
    fi
else
    OWNER_TAG=$(whoami)
    echo "Using local username: $OWNER_TAG"
fi

# Get the subscription ID from environment variable or Azure CLI
SUBSCRIPTION_ID=${ARM_SUBSCRIPTION_ID}
if [ -z "$SUBSCRIPTION_ID" ]; then
    echo "Trying to get subscription ID from Azure CLI..."
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    if [ -z "$SUBSCRIPTION_ID" ]; then
        echo "Error: Could not get Azure subscription ID. Make sure you're logged in to Azure CLI or ARM_SUBSCRIPTION_ID is set."
        exit 1
    fi
fi
echo "Using Azure subscription ID: $SUBSCRIPTION_ID"

# Define resource group name
RESOURCE_GROUP="${OWNER_TAG}-biteswipe-resources"
echo "Checking if resource group $RESOURCE_GROUP exists..."

# Check if resource group exists
GROUP_EXISTS=$(az group exists --name $RESOURCE_GROUP)
if [ "$GROUP_EXISTS" = "false" ]; then
    echo "Resource group $RESOURCE_GROUP does not exist, nothing to import."
    exit 0
fi

echo "Resource group $RESOURCE_GROUP exists. Checking if it's already in Terraform state..."

# Change to the terraform directory
cd $(dirname $0)/../terraform
terraform init

# Check if the resource group is already in the Terraform state
STATE_CHECK=$(terraform state list azurerm_resource_group.rg 2>/dev/null)
if [ -n "$STATE_CHECK" ]; then
    echo "Resource group $RESOURCE_GROUP is already in Terraform state, skipping import."
    exit 0
fi

echo "Importing resource group $RESOURCE_GROUP to Terraform state..."
# Import the resource group
RESOURCE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
terraform import azurerm_resource_group.rg $RESOURCE_ID

if [ $? -eq 0 ]; then
    echo "Successfully imported resource group $RESOURCE_GROUP"
else
    echo "Failed to import resource group $RESOURCE_GROUP"
    exit 1
fi
