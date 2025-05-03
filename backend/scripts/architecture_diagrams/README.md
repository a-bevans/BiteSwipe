# BiteSwipe Architecture Diagram Generator

This tool generates a comprehensive architectural diagram of the BiteSwipe backend deployment system, including:

- GitHub Actions workflows
- Environment variables and repository secrets
- Terraform infrastructure
- Azure VM and network components
- Docker Compose setup with containers

## Prerequisites

To run this diagram generator, you need:

1. Python 3.6 or higher
2. Graphviz (required by the diagrams library)

## Installation

Install Graphviz:
- macOS: `brew install graphviz`
- Ubuntu/Debian: `apt-get install graphviz`
- Windows: Download from [Graphviz website](https://graphviz.org/download/)

Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the diagram generator:
```bash
python generate_diagram.py
```

This will create:
- `biteswipe_architecture.png` - PNG version of the architecture diagram
- `biteswipe_architecture.pdf` - PDF version of the architecture diagram

## Diagram Components

The diagram visualizes:

1. **GitHub Repository**
   - GitHub Actions workflows
   - Repository secrets

2. **Terraform Infrastructure**
   - Azure resource group
   - Virtual network, subnet, public IP
   - Network security group
   - Azure VM (Standard_B2s)

3. **Environment Variables**
   - All configuration in .env file

4. **Docker Compose Environment**
   - MongoDB container
   - Node.js app container
   - Nginx container
   - Docker volumes and network

5. **Deployment Flow**
   - Connections between all components
