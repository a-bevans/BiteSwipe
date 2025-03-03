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
    command = <<EOF
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      
      # --- Configuration ---
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      VM_FQDN="${azurerm_public_ip.public_ip.fqdn}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
      BACKEND_PATH="$(pwd)/../../backend"
      BACKEND_REMOTE_PATH="/app/backend"

      # --- Functions ---
      
      # Print configuration information
      print_config() {
        echo "[Deploy] Using VM IP: $VM_IP"
        echo "[Deploy] Using VM FQDN: $VM_FQDN"
        echo "[Deploy] Using SSH key: $SSH_KEY"
        echo "[Deploy] Backend path: $BACKEND_PATH"
      }
      
      # Verify SSH key exists and set permissions
      setup_ssh_key() {
        ls -l $SSH_KEY
        chmod 600 $SSH_KEY
      }
      
      # Wait for SSH connectivity
      wait_for_ssh() {
        echo "[Deploy] Waiting for SSH to become available..."
        for i in $(seq 1 30); do
          if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "echo 'SSH connection successful'" 2>/dev/null; then
            echo "[Deploy] SSH is now available"
            return 0
          fi
          echo "[Deploy] Attempt $i: Waiting for SSH... (VM_IP=$VM_IP)"
          sleep 10
        done
        echo "[Deploy] Failed to establish SSH connection after 30 attempts"
        return 1
      }
      
      # Wait for VM setup to complete
      wait_for_setup() {
        echo "[Deploy] Waiting for setup script to complete..."
        for i in $(seq 1 30); do
          if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/setup_complete && echo 'Setup complete file found'"; then
            echo "[Deploy] Setup script completed successfully"
            return 0
          fi
          echo "[Deploy] Attempt $i: Setup still in progress..."
          # Check if we can see the cloud-init log
          ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "sudo tail -n 5 /var/log/cloud-init-output.log" || echo "Could not read cloud-init log"
          sleep 10
        done
        echo "[Deploy] Failed to complete setup after 30 attempts"
        return 1
      }
      
      # Verify Docker installation
      verify_docker() {
        echo "[Deploy] Verifying Docker setup..."
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "~/setup_docker.sh"
        
        echo "[Deploy] Waiting for Docker verification..."
        for i in $(seq 1 10); do
          if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/docker_verified"; then
            echo "[Deploy] Docker verified successfully"
            return 0
          fi
          echo "[Deploy] Attempt $i: Waiting for Docker verification..."
          sleep 5
        done
        echo "[Deploy] Failed to verify Docker after 10 attempts"
        return 1
      }
      
      # Create environment file
      create_env_file() {
        echo "[Deploy] Creating .env file..."
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "cat > $BACKEND_REMOTE_PATH/.env" << ENVFILE
PORT=3000
DB_URI=mongodb://mongo:27017/biteswipe
GOOGLE_MAPS_API_KEY=${local.google_maps_api_key}
FIREBASE_CREDENTIALS_JSON_PATHNAME=$BACKEND_REMOTE_PATH/biteswipe-132f1-firebase-adminsdk-fbsvc-76c5bb6fe5.json
ENVFILE
      }
      
      # Copy backend files to VM
      copy_backend_files() {
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
      }
      
      # Start application services
      start_services() {
        echo "[Deploy] Starting Docker services..."
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
          set -x
          cd $BACKEND_REMOTE_PATH
          pwd
          ls -la
          echo '[Deploy] Verifying environment variables:'
          cat .env
          echo '[Deploy] Stopping existing containers...'
          docker-compose down --remove-orphans || true
          echo '[Deploy] Building and starting containers...'
          docker-compose up -d --build
          if [ \$? -ne 0 ]; then
            echo \"[Deploy] ERROR: Docker-compose failed\"
            exit 1
          fi
          echo '[Deploy] Containers started successfully!'
          
          # Wait for containers to stabilize
          echo '[Deploy] Waiting for containers to be ready...'
          sleep 15
          
          # Check if exactly 2 containers are running
          RUNNING_CONTAINERS=\$(docker ps --format '{{.Names}}' | wc -l)
          echo \"[Deploy] Number of running containers: \$RUNNING_CONTAINERS\"
          
          if [ \"\$RUNNING_CONTAINERS\" -ne 2 ]; then
            echo \"[Deploy] ERROR: Expected 2 running containers but found \$RUNNING_CONTAINERS\"
            docker ps
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
            docker ps
            docker-compose logs app
            exit 1
          fi
          
          echo \"[Deploy] Deployment validation successful - all containers are running and API is healthy!\"
          docker ps
        "
      }
      
      # --- Main Execution ---
      print_config
      setup_ssh_key
      wait_for_ssh
      wait_for_setup
      verify_docker

      create_env_file
      copy_backend_files
      start_services
      
      echo "[Deploy] Deployment completed successfully!"
EOF
  }

  depends_on = [
    azurerm_linux_virtual_machine.vm
  ]
}
