output "server_public_ip" {
  value = azurerm_public_ip.public_ip.ip_address
  description = "The public IP address of the VM"
}

output "server_private_ip" {
  value = azurerm_network_interface.nic.private_ip_address
  description = "The private IP address of the VM"
}

output "server_dns_name" {
  value = azurerm_public_ip.public_ip.fqdn
  description = "The fully qualified domain name of the server"
}

output "server_name" {
  value = azurerm_linux_virtual_machine.vm.name
  description = "The name of the virtual machine"
}

output "app_url" {
  value = "https://${azurerm_public_ip.public_ip.fqdn}:3000"
  description = "The URL to access the application"
}

output "app_ip_url" {
  value = "https://${azurerm_public_ip.public_ip.ip_address}:3000"
  description = "The IP-based URL to access the application"
}

output "mongodb_url" {
  value = "mongodb://${azurerm_public_ip.public_ip.fqdn}:27017"
  description = "The MongoDB connection URL"
}

output "ssh_command" {
  value       = "ssh -o StrictHostKeyChecking=no -i ~/.ssh/to_azure/CPEN321.pem adminuser@${azurerm_public_ip.public_ip.ip_address}"
  description = "SSH command to connect to the VM"
}
