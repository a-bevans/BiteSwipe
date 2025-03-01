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
    public_ip_address_id         = azurerm_public_ip.public_ip.id
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
    source_port_range         = "*"
    destination_port_range    = "*"
    source_address_prefix     = "*"
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
  size                = "Standard_B2s"  # 2 vCPUs, 4GB RAM
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(var.ssh_public_key_path)
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
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
    mkdir -p /app/backend
    chown -R adminuser:adminuser /app
    chmod -R 755 /app

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

# Separate deployment resource that can be triggered independently
resource "null_resource" "deploy_backend" {
  triggers = {
    always_run = "${timestamp()}"
  }

  provisioner "local-exec" {
    command = <<-EOF
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      
      SSH_KEY="$HOME/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

      echo "[Deploy] Using VM IP: $VM_IP"
      echo "[Deploy] Using SSH key: $SSH_KEY"
      
      # Verify SSH key exists and has correct permissions
      ls -l $SSH_KEY
      chmod 600 $SSH_KEY
      
      # Wait for SSH to be available
      echo "[Deploy] Waiting for SSH to become available..."
      for i in $(seq 1 30); do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "echo 'SSH connection successful'" 2>/dev/null; then
          echo "[Deploy] SSH is now available"
          break
        fi
        echo "[Deploy] Attempt $i: Waiting for SSH... (VM_IP=$VM_IP)"
        sleep 10
      done

      # Wait for setup to complete
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
      done

      # Run Docker verification script
      echo "[Deploy] Verifying Docker setup..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "~/setup_docker.sh"
      
      # Wait for Docker verification
      echo "[Deploy] Waiting for Docker verification..."
      for i in $(seq 1 10); do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/docker_verified"; then
          echo "[Deploy] Docker verified successfully"
          break
        fi
        echo "[Deploy] Attempt $i: Waiting for Docker verification..."
        sleep 5
      done

      # Copy files
      echo "[Deploy] Copying backend files..."
      BACKEND_PATH="$(pwd)/../../backend"
      echo "[Deploy] Backend path: $BACKEND_PATH"
      ls -la $BACKEND_PATH
      
      # Create .env file first
      echo "[Deploy] Creating .env file..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "cat > /app/backend/.env" << 'ENVFILE'
PORT=3000
DB_URI=mongodb://mongo:27017/biteswipe
ENVFILE
      
      echo "[Deploy] Copying backend files..."
      scp $SSH_OPTS -i $SSH_KEY -r $BACKEND_PATH/* adminuser@$VM_IP:/app/backend/

      # Start services
      echo "[Deploy] Starting Docker services..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
        set -x
        cd /app/backend
        pwd
        ls -la
        echo '[Deploy] Verifying environment variables:'
        cat .env
        echo '[Deploy] Stopping existing containers...'
        docker-compose down --remove-orphans || true
        echo '[Deploy] Building and starting containers...'
        docker-compose up -d --build
        echo '[Deploy] Containers started successfully!'
        docker ps
      "
    EOF
  }

  depends_on = [
    azurerm_linux_virtual_machine.vm
  ]
}
