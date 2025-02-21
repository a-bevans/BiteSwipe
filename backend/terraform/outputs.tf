output "server_public_ip" {
  value = azurerm_public_ip.public_ip.ip_address
  description = "The public IP address of the VM"
}

output "server_private_ip" {
  value = azurerm_network_interface.nic.private_ip_address
  description = "The private IP address of the VM"
}
