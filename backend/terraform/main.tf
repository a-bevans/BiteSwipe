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

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    
    echo "[Setup] Starting VM configuration..."
    
    echo "[Setup] Updating package lists..."
    apt-get update
    
    echo "[Setup] Installing prerequisites..."
    apt-get install -y \
      apt-transport-https \
      ca-certificates \
      curl \
      software-properties-common

    echo "[Setup] Adding Docker repository..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository \
      "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) \
      stable"

    echo "[Setup] Installing Docker..."
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io

    echo "[Setup] Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    echo "[Setup] Configuring Docker permissions..."
    usermod -aG docker adminuser

    echo "[Setup] Starting Docker service..."
    systemctl start docker
    systemctl enable docker

    echo "[Setup] Creating application directories..."
    mkdir -p /app/backend
    chown -R adminuser:adminuser /app

    echo "[Setup] Configuration complete!"
    touch /tmp/setup_complete
  EOF
  )

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
    command = <<-EOT
      #!/bin/bash
      set -x  # Enable debug output
      set -e  # Exit on error
      
      SSH_KEY="/Users/vm/.ssh/to_azure/CPEN321.pem"
      VM_IP="${azurerm_public_ip.public_ip.ip_address}"
      SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

      echo "[Deploy] Using VM IP: $VM_IP"
      echo "[Deploy] Using SSH key: $SSH_KEY"
      
      # Verify SSH key exists and has correct permissions
      ls -l $SSH_KEY
      chmod 600 $SSH_KEY
      
      # Wait for SSH to be available
      echo "[Deploy] Waiting for SSH to become available..."
      for i in {1..30}; do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "echo 'SSH connection successful'" 2>/dev/null; then
          echo "[Deploy] SSH is now available"
          break
        fi
        echo "[Deploy] Attempt $i: Waiting for SSH... (VM_IP=$VM_IP)"
        sleep 10
      done

      # Wait for setup to complete
      echo "[Deploy] Waiting for setup script to complete..."
      for i in {1..30}; do
        if ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "test -f /tmp/setup_complete && echo 'Setup complete file found'"; then
          echo "[Deploy] Setup script completed successfully"
          break
        fi
        echo "[Deploy] Attempt $i: Setup still in progress..."
        # Check if we can see the cloud-init log
        ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "sudo tail -n 5 /var/log/cloud-init-output.log" || echo "Could not read cloud-init log"
        sleep 10
      done

      # Copy files
      echo "[Deploy] Copying backend files..."
      BACKEND_PATH="$(pwd)/../../backend"
      echo "[Deploy] Backend path: $BACKEND_PATH"
      ls -la $BACKEND_PATH
      
      # Make sure .env file exists and has the right content
      echo "[Deploy] Verifying .env file..."
      ssh $SSH_OPTS -i $SSH_KEY adminuser@$VM_IP "
        echo 'PORT=3000' > /app/backend/.env
        echo 'DB_URI=mongodb://mongo:27017' >> /app/backend/.env
        cat /app/backend/.env
      "
      
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
    EOT
  }

  depends_on = [
    azurerm_linux_virtual_machine.vm
  ]
}
