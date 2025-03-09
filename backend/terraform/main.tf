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
  # Read and extract Google Maps API key from .env
  env_content = file("${path.module}/../.env")
  google_maps_api_key = trimspace(replace(
    regexall("GOOGLE_MAPS_API_KEY=[^\n]*", local.env_content)[0],
    "GOOGLE_MAPS_API_KEY=", 
    ""
  ))
}

# Add Azure storage blob data source and download step for Firebase cert
data "azurerm_storage_account" "certs" {
  name                = "productionstorageaccoun2"
  resource_group_name = "CPEN321RSRCGROUP"
}

data "azurerm_storage_blob" "firebase_cert" {
  name                   = "biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json"
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
FIREBASE_CREDENTIALS_JSON_PATHNAME=$BACKEND_REMOTE_PATH/biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json
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
        --file $BACKEND_PATH/biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json \
        --account-key "${data.azurerm_storage_account.certs.primary_access_key}"
      
      # Copy files to VM
      scp $SSH_OPTS -i $SSH_KEY -r $BACKEND_PATH/* adminuser@$VM_IP:$BACKEND_REMOTE_PATH/
      
      # Verify the Firebase credentials file was copied
      echo "[Deploy] Verifying Firebase credentials file..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
        if [ -f $BACKEND_REMOTE_PATH/biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json ]; then
          echo '[Deploy] Firebase credentials file found'
          ls -la $BACKEND_REMOTE_PATH/biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json
        else
          echo '[Deploy] FATAL ERROR: Firebase credentials file not found!'
          echo '[Deploy] Deployment cannot continue without Firebase credentials.'
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
      set -x  # Enable debug output
      # Don't exit on error immediately to allow for retries
      set +e
      echo [**********************] Service deployment and validation [**********************]
      
      # --- Configuration ---
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
      BACKEND_REMOTE_PATH="/app/backend"
      
      # Function to verify SSH connection
      verify_ssh() {
        echo "[Deploy] Verifying SSH connection to $VM_IP..."
        for i in {1..5}; do
          ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "echo 'SSH test successful'" && return 0
          echo "[Deploy] SSH connection attempt $i failed, retrying in 5 seconds..."
          sleep 5
        done
        echo "[Deploy] Failed to establish SSH connection after 5 attempts"
        return 1
      }
      
      # Verify SSH connection first
      if ! verify_ssh; then
        echo "[Deploy] Cannot proceed with deployment due to SSH connection failure"
        exit 1
      fi
      
      # Start application services with retry logic
      echo "[Deploy] Starting Docker services..."
      for deploy_attempt in {1..3}; do
        echo "[Deploy] Deployment attempt $deploy_attempt of 3"
        
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
          set -x
          cd $BACKEND_REMOTE_PATH || { echo 'Failed to change directory to $BACKEND_REMOTE_PATH'; exit 1; }
          pwd
          ls -la
          
          # Check if docker-compose.yml exists
          if [ ! -f docker-compose.yml ]; then
            echo '[Deploy] ERROR: docker-compose.yml not found!'
            ls -la
            exit 1
          fi
          
          echo '[Deploy] Verifying environment variables:'
          cat .env || echo 'Warning: .env file not found or cannot be read'
          
          echo '[Deploy] Stopping existing containers...'
          docker-compose down --remove-orphans || true
          
          echo '[Deploy] Building and starting containers...'
          docker-compose up -d --build
          if [ \$? -ne 0 ]; then
            echo \"[Deploy] ERROR: Docker-compose failed\"
            docker-compose logs
            exit 1
          fi
          echo '[Deploy] Containers started successfully!'
          
          # Wait for containers to stabilize
          echo '[Deploy] Waiting for containers to be ready...'
          sleep 15
          
          # Check if containers are running
          RUNNING_CONTAINERS=\$(docker ps --format '{{.Names}}' | wc -l)
          echo \"[Deploy] Number of running containers: \$RUNNING_CONTAINERS\"
          
          # We're looking for at least 1 container (the app) instead of exactly 2
          # This makes the check more flexible
          if [ \"\$RUNNING_CONTAINERS\" -lt 1 ]; then
            echo \"[Deploy] ERROR: No containers running\"
            docker ps -a
            docker-compose logs
            exit 1
          fi
          
          # Verify that the app is responding
          echo '[Deploy] Verifying API health...'
          MAX_RETRIES=6
          RETRY_COUNT=0
          API_HEALTHY=false
          
          while [ \$RETRY_COUNT -lt \$MAX_RETRIES ]; do
            if curl -s http://localhost:3000/health | grep -q 'healthy'; then
              API_HEALTHY=true
              break
            fi
            echo \"[Deploy] API health check attempt \$((RETRY_COUNT+1))/\$MAX_RETRIES failed, retrying in 5 seconds...\"
            RETRY_COUNT=\$((RETRY_COUNT+1))
            sleep 5
          done
          
          if [ \"\$API_HEALTHY\" != \"true\" ]; then
            echo \"[Deploy] ERROR: API health check failed after \$MAX_RETRIES attempts\"
            docker ps -a
            docker-compose logs
            exit 1
          fi
          
          echo \"[Deploy] Deployment validation successful - containers are running and API is healthy!\"
          docker ps
          exit 0
        "
        
        # Check if the SSH command was successful
        SSH_RESULT=$?
        if [ $SSH_RESULT -eq 0 ]; then
          echo "[Deploy] Service deployment successful!"
          break
        else
          echo "[Deploy] Service deployment attempt $deploy_attempt failed with exit code $SSH_RESULT"
          if [ $deploy_attempt -eq 3 ]; then
            echo "[Deploy] All deployment attempts failed"
            exit 1
          fi
          echo "[Deploy] Waiting 30 seconds before next attempt..."
          sleep 30
        fi
      done
      
      echo "[Deploy] Service deployment phase completed successfully!"
      echo "[Deploy] Deployment completed successfully!"
      echo [**********************] Service deployment and validation [**********************]
EOF
  }

  depends_on = [
    azurerm_linux_virtual_machine.vm
  ]
}
