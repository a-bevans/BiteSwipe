variable "ssh_private_key_path" {
  description = "Path to the SSH private key (.pem file) for VM access"
  type        = string
  default     = "~/.ssh/to_azure/CPEN321.pem"
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key for VM access (must be the .pub file corresponding to your .pem key)"
  type        = string
  default     = "~/.ssh/to_azure/CPEN321.pub"  # This should be the public key of your .pem key
}

variable "admin_username" {
  description = "Username for VM admin access"
  type        = string
  default     = "adminuser"
}

variable "location" {
  description = "Azure region to deploy resources"
  type        = string
  default     = "westus2"
}

variable "vm_size" {
  description = "Size of the VM"
  type        = string
  default     = "Standard_B1ls"  # Smallest VM size that can run Docker effectively
}

variable "allowed_ip_address" {
  description = "IP address or CIDR range allowed to access the VM via SSH"
  type        = string
  default     = "*"  # WARNING: This allows all IPs, you should change this to your specific IP
}

variable "owner_tag" {
  description = "Username for resource tagging, defaults to system username"
  type        = string
  default     = null  # Will be set by terraform.tfvars
}

# VM Image Configuration
variable "ubuntu_version" {
  description = "Ubuntu version to use. Common values: 22.04-LTS (latest LTS), 20.04-LTS, 18.04-LTS"
  type        = string
  default     = "22.04-LTS"
}

variable "ubuntu_sku" {
  description = "Ubuntu SKU to use. Options: Standard (general purpose), Pro (with enterprise support)"
  type        = string
  default     = "22_04-lts-gen2"  # gen2 for better performance
}
