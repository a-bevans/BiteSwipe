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
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  allocation_method   = "Static"
  sku                = "Standard"
  
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
  name                = "${var.owner_tag}-biteswipe-vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  size                = var.vm_size  # Standard_B1s: 1vCPU, 1GB RAM, burstable performance
  admin_username      = var.admin_username

  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    
    # Create app directory
    mkdir -p /app/backend
    
    # Make sure docker is running
    systemctl start docker
    systemctl enable docker
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
    publisher = "canonical"
    offer     = "0001-com-ubuntu-server-docker-certified"
    sku       = "20_04-lts-gen2"
    version   = "latest"
  }
  
  tags = {
    owner = var.owner_tag
  }
}

# Separate deployment resource that can be triggered independently
resource "null_resource" "deploy_backend" {
  # This will trigger a new deployment when any file in the backend directory changes
  triggers = {
    backend_hash = sha256(join("", [for f in fileset(path.root, "../../backend/**/*"): filesha256(f)]))
  }

  # Wait for VM to be ready
  depends_on = [azurerm_linux_virtual_machine.vm]

  provisioner "local-exec" {
    command = <<-EOT
      # Copy backend folder to VM
      scp -o StrictHostKeyChecking=no -i ${var.ssh_private_key_path} -r ${path.root}/../../backend/* ${var.admin_username}@${azurerm_public_ip.public_ip.ip_address}:/app/backend/
      
      # SSH into VM and start docker services
      ssh -o StrictHostKeyChecking=no -i ${var.ssh_private_key_path} ${var.admin_username}@${azurerm_public_ip.public_ip.ip_address} '
        cd /app/backend
        docker-compose down --remove-orphans
        docker-compose up -d --build
      '
    EOT
  }
}
