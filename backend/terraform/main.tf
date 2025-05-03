# Configure the Azure provider
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Create a resource group
resource "azurerm_resource_group" "rg" {
  name     = "${var.owner_tag}-biteswipe-resources"
  location = var.location

  tags = {
    owner = var.owner_tag
  }
}

# Create a virtual network
resource "azurerm_virtual_network" "vnet" {
  name                = "${var.owner_tag}-biteswipe-network"
  address_space       = ["10.0.0.0/16"]
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name

  tags = {
    owner = var.owner_tag
  }
}

# Create a subnet
resource "azurerm_subnet" "subnet" {
  name                 = "${var.owner_tag}-internal"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/24"]
}

# Create a public IP
resource "azurerm_public_ip" "public_ip" {
  name                = "${var.owner_tag}-biteswipe-public-ip"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "${var.owner_tag}-biteswipe"

  tags = {
    owner = var.owner_tag
  }
}

# Create a network interface
resource "azurerm_network_interface" "nic" {
  name                = "${var.owner_tag}-biteswipe-nic"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.public_ip.id
  }

  tags = {
    owner = var.owner_tag
  }
}

# Create Network Security Group
resource "azurerm_network_security_group" "nsg" {
  name                = "${var.owner_tag}-biteswipe-nsg"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "AllowAllInbound"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    owner = var.owner_tag
  }
}

# Associate NSG with network interface
resource "azurerm_network_interface_security_group_association" "nic_nsg_association" {
  network_interface_id      = azurerm_network_interface.nic.id
  network_security_group_id = azurerm_network_security_group.nsg.id
}

# Create a virtual machine (using smallest size that can run Docker)
resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${var.owner_tag}-biteswipe"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  size                = "Standard_B2s" # 2 vCPUs, 4GB RAM
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  allow_extension_operations                             = true
  bypass_platform_safety_checks_on_user_schedule_enabled = false
  encryption_at_host_enabled                             = false
  patch_assessment_mode                                  = "ImageDefault"
  patch_mode                                             = "ImageDefault"
  provision_vm_agent                                     = true
  secure_boot_enabled                                    = false
  vtpm_enabled                                           = false
  vm_agent_platform_updates_enabled                      = false

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(var.ssh_public_key_path)
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-focal"
    sku       = "20_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    set -ex

    ROOT_PATH="/app"
    BACKEND_PATH="$ROOT_PATH/backend"

    # Update package list
    apt-get update

    # Install Docker and Docker Compose
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose

    # Configure Docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker adminuser

    # Create app directory and set permissions
    mkdir -p $BACKEND_PATH
    chown -R adminuser:adminuser $ROOT_PATH
    chmod -R 755 $ROOT_PATH

    # Create a script that will be run after first login
    cat > /home/adminuser/setup_docker.sh << 'SETUP'
    #!/bin/bash
    # Verify docker works
    docker ps
    if [ $? -eq 0 ]; then
        touch /tmp/docker_verified
    fi
    SETUP

    chmod +x /home/adminuser/setup_docker.sh
    chown adminuser:adminuser /home/adminuser/setup_docker.sh

    # Mark setup as complete
    touch /tmp/setup_complete
    EOF
  )

  tags = {
    owner = var.owner_tag
  }
}

# Add locals block for environment variables
locals {
  # Read and extract environment variables from .env
  env_content = file("${path.module}/../.env")
  
  # Extract Google Maps API key
  google_maps_api_key = trimspace(replace(
    regexall("GOOGLE_MAPS_API_KEY=[^\n]*", local.env_content)[0],
    "GOOGLE_MAPS_API_KEY=", 
    ""
  ))
  
  # Extract Google Web Client ID
  google_web_client_id = trimspace(replace(
    regexall("GOOGLE_WEB_CLIENT_ID=[^\n]*", local.env_content)[0],
    "GOOGLE_WEB_CLIENT_ID=", 
    ""
  ))
  
  # Extract Google Test Email
  google_test_email = trimspace(replace(
    regexall("GOOGLE_TEST_EMAIL=[^\n]*", local.env_content)[0],
    "GOOGLE_TEST_EMAIL=", 
    ""
  ))
}

# Add Azure storage blob data source and download step for Firebase cert
data "azurerm_storage_account" "certs" {
  name                = "productionstorageaccoun2"
  resource_group_name = "CPEN321RSRCGROUP"
}

data "azurerm_storage_blob" "firebase_cert" {
  name                   = "biteswipe-452501-firebase-adminsdk-fbsvc-f7b58ac1e2.json"
  storage_account_name   = data.azurerm_storage_account.certs.name
  storage_container_name = "production-container"
}

data "azurerm_storage_blob" "ssl_cert" {
  name                   = "selfsigned.crt"
  storage_account_name   = data.azurerm_storage_account.certs.name
  storage_container_name = "production-container"
}

data "azurerm_storage_blob" "ssl_key" {
  name                   = "selfsigned.key"
  storage_account_name   = data.azurerm_storage_account.certs.name
  storage_container_name = "production-container"
}

# Separate deployment resource that can be triggered independently
resource "null_resource" "deploy_backend" {
  triggers = {
    always_run = "${timestamp()}"
  }

  provisioner "local-exec" {
    # Setup and initial connectivity checks
    on_failure = fail
    command = <<EOF
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      echo [**********************] Setup and initial connectivity checks [**********************]
      # --- Configuration ---
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      VM_FQDN="${azurerm_public_ip.public_ip.fqdn}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
      BACKEND_PATH="$(pwd)/../../backend"
      BACKEND_REMOTE_PATH="/app/backend"

      # Print configuration information
      echo "[Deploy] Using VM IP: $VM_IP"
      echo "[Deploy] Using VM FQDN: $VM_FQDN"
      echo "[Deploy] Using SSH key: $SSH_KEY"
      echo "[Deploy] Backend path: $BACKEND_PATH"
      
      # Verify SSH key exists and set permissions
      ls -l $SSH_KEY
      chmod 600 $SSH_KEY
      
      # Wait for SSH connectivity
      echo "[Deploy] Waiting for SSH to become available..."
      for i in $(seq 1 30); do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "echo 'SSH connection successful'" 2>/dev/null; then
          echo "[Deploy] SSH is now available"
          break
        fi
        echo "[Deploy] Attempt $i: Waiting for SSH... (VM_IP=$VM_IP)"
        sleep 10
        if [ $i -eq 30 ]; then
          echo "[Deploy] Failed to establish SSH connection after 30 attempts"
          exit 1
        fi
      done
      
      # Wait for VM setup to complete
      echo "[Deploy] Waiting for setup script to complete..."
      for i in $(seq 1 30); do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/setup_complete && echo 'Setup complete file found'"; then
          echo "[Deploy] Setup script completed successfully"
          break
        fi
        echo "[Deploy] Attempt $i: Setup still in progress..."
        # Check if we can see the cloud-init log
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "sudo tail -n 5 /var/log/cloud-init-output.log" || echo "Could not read cloud-init log"
        sleep 10
        if [ $i -eq 30 ]; then
          echo "[Deploy] Failed to complete setup after 30 attempts"
          exit 1
        fi
      done
      
      # Verify Docker installation
      echo "[Deploy] Verifying Docker setup..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "~/setup_docker.sh"
      
      echo "[Deploy] Waiting for Docker verification..."
      for i in $(seq 1 10); do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/docker_verified"; then
          echo "[Deploy] Docker verified successfully"
          break
        fi
        echo "[Deploy] Attempt $i: Waiting for Docker verification..."
        sleep 5
        if [ $i -eq 10 ]; then
          echo "[Deploy] Failed to verify Docker after 10 attempts"
          exit 1
        fi
      done
      
      echo "[Deploy] Setup and connectivity phase completed successfully!"
      echo [**********************] Setup and initial connectivity checks [**********************]
EOF
  }
  
  provisioner "local-exec" {
    # Environment preparation
    on_failure = fail
    command = <<EOF
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      echo [**********************] Environment preparation [**********************]
      # --- Configuration ---
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
      BACKEND_PATH="$(pwd)/../../backend"
      BACKEND_REMOTE_PATH="/app/backend"
      
      # Create environment file
      echo "[Deploy] Creating .env file..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "cat > $BACKEND_REMOTE_PATH/.env" << ENVFILE
PORT=3000
DB_URI=mongodb://mongo:27017/biteswipe
GOOGLE_MAPS_API_KEY=${local.google_maps_api_key}
GOOGLE_WEB_CLIENT_ID=${local.google_web_client_id}
GOOGLE_TEST_EMAIL=${local.google_test_email}
FIREBASE_CREDENTIALS_JSON_PATHNAME=$BACKEND_REMOTE_PATH/biteswipe-452501-firebase-adminsdk-fbsvc-f7b58ac1e2.json
ENVFILE
      
      echo "[Deploy] Environment preparation phase completed successfully!"
      echo [**********************] Environment preparation [**********************]
EOF
  }
  
  provisioner "local-exec" {
    # File deployment
    on_failure = fail
    command = <<EOF
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      echo [**********************] File deployment [**********************]

      # --- Configuration ---
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
      BACKEND_PATH="$(pwd)/../../backend"
      BACKEND_REMOTE_PATH="/app/backend"
      
      # Copy backend files to VM
      echo "[Deploy] Copying backend files..."
      ls -la $BACKEND_PATH
      
      # Download Firebase cert from Azure Storage using account key
      echo "[Deploy] Downloading Firebase cert from Azure Storage..."
      az storage blob download \
        --account-name ${data.azurerm_storage_account.certs.name} \
        --container-name production-container \
        --name ${data.azurerm_storage_blob.firebase_cert.name} \
        --file $BACKEND_PATH/biteswipe-452501-firebase-adminsdk-fbsvc-f7b58ac1e2.json \
        --account-key "${data.azurerm_storage_account.certs.primary_access_key}"
      
      # Download SSL certificate files from Azure Storage
      echo "[Deploy] Downloading SSL certificate files from Azure Storage..."
      mkdir -p $BACKEND_PATH/nginx/certs
      
      # Download selfsigned.crt
      az storage blob download \
        --account-name ${data.azurerm_storage_account.certs.name} \
        --container-name ${data.azurerm_storage_blob.ssl_cert.storage_container_name} \
        --name ${data.azurerm_storage_blob.ssl_cert.name} \
        --file $BACKEND_PATH/nginx/certs/selfsigned.crt \
        --account-key "${data.azurerm_storage_account.certs.primary_access_key}"
      
      # Download selfsigned.key
      az storage blob download \
        --account-name ${data.azurerm_storage_account.certs.name} \
        --container-name ${data.azurerm_storage_blob.ssl_key.storage_container_name} \
        --name ${data.azurerm_storage_blob.ssl_key.name} \
        --file $BACKEND_PATH/nginx/certs/selfsigned.key \
        --account-key "${data.azurerm_storage_account.certs.primary_access_key}"
      
      # Copy files to VM
      scp $SSH_OPTS -i $SSH_KEY -r $BACKEND_PATH/* adminuser@$VM_IP:$BACKEND_REMOTE_PATH/
      
      # Verify the Firebase credentials file was copied
      echo "[Deploy] Verifying Firebase credentials file..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
        if [ -f $BACKEND_REMOTE_PATH/biteswipe-452501-firebase-adminsdk-fbsvc-f7b58ac1e2.json ]; then
          echo '[Deploy] Firebase credentials file found'
          ls -la $BACKEND_REMOTE_PATH/biteswipe-452501-firebase-adminsdk-fbsvc-f7b58ac1e2.json
        else
          echo '[Deploy] FATAL ERROR: Firebase credentials file not found!'
          echo '[Deploy] Deployment cannot continue without Firebase credentials.'
          exit 1
        fi
        
        # Verify SSL certificate files
        echo '[Deploy] Verifying SSL certificate files...'
        if [ -f $BACKEND_REMOTE_PATH/nginx/certs/selfsigned.crt ] && [ -f $BACKEND_REMOTE_PATH/nginx/certs/selfsigned.key ]; then
          echo '[Deploy] SSL certificate files found'
          ls -la $BACKEND_REMOTE_PATH/nginx/certs/selfsigned.crt
          ls -la $BACKEND_REMOTE_PATH/nginx/certs/selfsigned.key
        else
          echo '[Deploy] ERROR: SSL certificate files not found!'
          exit 1
        fi
      "
      
      echo "[Deploy] File deployment phase completed successfully!"
      echo [**********************] File deployment [**********************]
EOF
  }
  
  provisioner "local-exec" {
    # Service deployment and validation
    on_failure = fail
    command = <<EOF
      #!/bin/bash
      # Run the deployment script with the VM IP address - using absolute path
      bash "${path.module}/deploy_services.sh" --vm-ip="${azurerm_public_ip.public_ip.ip_address}" --run-mode="${var.run_mode}"
EOF
  }

  depends_on = [
    azurerm_linux_virtual_machine.vm
  ]
}
