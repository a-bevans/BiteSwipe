#!/usr/bin/env python3

import sys
import os
import pathlib

def update_ssh_config(host_name, ip_address, key_path):
    """Update ~/.ssh/config with the new host configuration."""
    ssh_config_path = pathlib.Path.home() / '.ssh' / 'config'
    
    # Create config file if it doesn't exist
    if not ssh_config_path.exists():
        ssh_config_path.parent.mkdir(parents=True, exist_ok=True)
        ssh_config_path.touch()

    # Read existing config
    with open(ssh_config_path, 'r') as f:
        lines = f.readlines()

    # Remove existing host configuration if present
    new_lines = []
    skip = False
    for line in lines:
        if line.strip().startswith('Host ' + host_name):
            skip = True
            continue
        if skip and line.strip().startswith('Host '):
            skip = False
        if not skip:
            new_lines.append(line)

    # Add new host configuration
    new_lines.extend([
        f'\nHost {host_name}\n',
        f'    HostName {ip_address}\n',
        f'    User adminuser\n',
        f'    IdentityFile {key_path}\n',
        f'    StrictHostKeyChecking no\n'
    ])

    # Write updated config
    with open(ssh_config_path, 'w') as f:
        f.writelines(new_lines)

def main():
    if len(sys.argv) != 4:
        print("Usage: update_ssh_config.py <host_name> <ip_address> <key_path>")
        sys.exit(1)

    host_name = sys.argv[1]
    ip_address = sys.argv[2]
    key_path = sys.argv[3]

    update_ssh_config(host_name, ip_address, key_path)

if __name__ == "__main__":
    main()
