#!/usr/bin/env python3
"""
BiteSwipe Backend Architecture Diagram Generator
This script generates a comprehensive architectural diagram of the BiteSwipe backend
deployment system including GitHub Actions, environment variables, Azure infrastructure,
and Docker containerization.
"""

from diagrams import Diagram, Cluster, Edge, Node as DiagramNode
from diagrams.azure.compute import VM
from diagrams.azure.network import VirtualNetworks, PublicIpAddresses, NetworkSecurityGroupsClassic
from diagrams.azure.storage import StorageAccounts
from diagrams.onprem.container import Docker
from diagrams.onprem.database import MongoDB
from diagrams.onprem.network import Nginx
from diagrams.onprem.ci import GithubActions
from diagrams.onprem import Node
from diagrams.programming.language import NodeJS
from diagrams.generic.storage import Storage
from diagrams.generic.os import Ubuntu, Android
from diagrams.generic.network import Firewall
from diagrams.programming.language import Javascript
from diagrams.azure.security import KeyVaults
from diagrams.azure.general import Subscriptions
from diagrams.aws.general import General
from diagrams.onprem.client import Client, User

# Create a custom node class for app_network
class NetworkNode(DiagramNode):
    """Custom node to represent a network"""
    def __init__(self, label):
        super().__init__(label=label, shape="box", style="dashed", color="#2980B9")

# Set the output file path and diagram configuration
OUTPUT_PATH = "biteswipe_architecture"

# Configure diagram settings for better spacing
from diagrams import Node
Node.default_node_attrs = {
    "fontsize": "12",
    "width": "1.5",
    "height": "1.5",
    "margin": "0.4"
}

# Create the diagram with increased spacing and improved colors
with Diagram("BiteSwipe Backend Architecture", show=False, filename=OUTPUT_PATH, outformat=["png", "pdf"], 
           graph_attr={"splines": "ortho", "nodesep": "1.0", "ranksep": "1.2", "pad": "1.5", "bgcolor": "white", "concentrate": "true"},
           node_attr={"fontsize": "13", "fontcolor": "#333333"},
           edge_attr={"color": "#666666", "penwidth": "1.2"}):
    # Create Mobile Frontend App icon at the top level, outside all clusters
    mobile_frontend = User("BiteSwipe Mobile App\n(Android/iOS)")
    
    # GitHub Actions and Repository Secrets
    with Cluster("GitHub Repository", graph_attr={"bgcolor": "#E6F3FF", "pencolor": "#2980B9", "penwidth": "2.0", "margin": "25", "pad": "1.8", "nodesep": "0.9", "ranksep": "0.9"}):
        # Create a horizontal layout for the GitHub components
        with Cluster("", graph_attr={"rank": "same", "style": "invis"}):
            # Add a node for the main branch
            main_branch = General("main branch")
            
            # Create a cluster for GitHub Actions and the .env file it generates
            with Cluster("GitHub Actions Runner", graph_attr={"style": "dashed", "bgcolor": "#E8F8F5", "pencolor": "#27AE60", "penwidth": "1.5"}):
                github_actions = GithubActions("GitHub Actions")
                env_file = Storage(".env / production.env")
                
                # Show that GitHub Actions generates .env using secrets
                github_actions >> Edge(label="generates", color="#D35400", fontcolor="#D35400", penwidth="1.5") >> env_file
        
        # Place secrets below the other elements
        repo_secrets = KeyVaults("GitHub Repository Secrets")
        
        # Show that a push to main triggers GitHub Actions
        main_branch >> Edge(label="push triggers", color="#2980B9", fontcolor="#2980B9", penwidth="1.5") >> github_actions
    
    # Terraform Infrastructure
    with Cluster("Terraform Infrastructure", graph_attr={"bgcolor": "#E6FFE6", "pencolor": "#27AE60", "penwidth": "2.0"}):
        terraform = General("Terraform")
        
        with Cluster("Azure Resources"):
            # Azure Resource Group
            with Cluster("Resource Group (owner_tag-biteswipe-resources)", graph_attr={"margin": "40", "pad": "2.0", "nodesep": "1.0", "ranksep": "1.0", "bgcolor": "#F0F0F0", "pencolor": "#3498DB", "penwidth": "2.0"}):
                # Azure Infrastructure Services
                with Cluster("Azure Infrastructure Services", graph_attr={"style": "dashed", "margin": "20", "bgcolor": "#E6E6FF", "pencolor": "#8E44AD", "penwidth": "2.0"}):
                    azure_services = General("Supporting Services\n(Network, Security, etc.)")
                    
                    # Azure Storage as a cluster
                    with Cluster("Azure Storage", graph_attr={"bgcolor": "#E0EAFF", "pencolor": "#3498DB", "penwidth": "1.5"}):
                        firebase_creds = Storage("Firebase Credentials\n(JSON)")
                
                # Virtual Machine with Docker Compose inside
                with Cluster("Azure VM (Linux)", graph_attr={"bgcolor": "#FFF0E6", "pencolor": "#E67E22", "penwidth": "2.0"}):
                    # VM icon at the top level
                    azure_vm_icon = VM("")
                    
                    # Docker Compose Setup inside VM
                    with Cluster("Docker Compose Environment", graph_attr={"style": "solid", "bgcolor": "#FFE6E6", "pencolor": "#E74C3C", "penwidth": "1.5"}):
                        # Docker Compose positioned outside the network but controlling it
                        docker_compose = Docker("docker-compose.yml")
                        
                        # Data Volume (outside the network but inside Docker Compose)
                        mongo_volume = Storage("mongo_data Volume")
                        
                        # Docker Network as a cluster containing all containers
                        with Cluster("app_network", graph_attr={"style": "dashed", "bgcolor": "#E6FFFF", "pencolor": "#2980B9", "penwidth": "2.0", "label": "app_network"}):
                            # MongoDB Container
                            mongo_container = MongoDB("MongoDB Database")
                            
                            # BiteSwipe Backend API Container
                            app_container = NodeJS("BiteSwipe Backend API")
                            
                            # Nginx Container with external port
                            nginx_container = Nginx("Nginx Web Server\n(External Port: 443/HTTPS)")
                            
                            # Connect MongoDB to its volume
                            mongo_container >> Edge(label="stores data in", color="#2980B9", fontcolor="#2980B9", penwidth="1.5") >> mongo_volume
                            
                            # Connect containers to each other
                            app_container >> Edge(label="connects to", color="#2980B9", fontcolor="#2980B9", penwidth="1.5") >> mongo_container
                            nginx_container >> Edge(label="proxies to", color="#2980B9", fontcolor="#2980B9", penwidth="1.5") >> app_container
                            

                        
                        # Connect Docker Compose to all containers with clearer labels and adjusted positioning
                        # Use different edge styles to help with positioning
                        docker_compose >> Edge(label="orchestrates", color="#666666", fontcolor="#666666", penwidth="1.0", style="dashed", minlen="2") >> mongo_container
                        docker_compose - Edge(label="orchestrates", color="#666666", fontcolor="#666666", penwidth="1.0", style="dashed", minlen="1") >> app_container
                        docker_compose >> Edge(label="orchestrates", color="#666666", fontcolor="#666666", penwidth="1.0", style="dashed", minlen="2") >> nginx_container
                        

                
                # Connect services to VM
                azure_services >> Edge(label="supports", color="#9B59B6", fontcolor="#9B59B6", penwidth="1.5") >> azure_vm_icon
    
    # Deployment Flow
    repo_secrets >> Edge(label="provides secrets", color="#8E44AD", fontcolor="#8E44AD", penwidth="1.5") >> github_actions
    github_actions >> Edge(label="triggers", color="#27AE60", fontcolor="#27AE60", penwidth="1.5") >> terraform
    
    # GitHub Actions downloads Firebase credentials
    firebase_creds >> Edge(label="downloaded by", color="#E67E22", fontcolor="#E67E22", penwidth="1.5") >> github_actions
    
    # Firebase credentials are passed to the app container
    github_actions >> Edge(label="passes credentials to", color="#E67E22", fontcolor="#E67E22", penwidth="1.5", style="dashed") >> app_container
    
    terraform >> Edge(label="provisions", color="#27AE60", fontcolor="#27AE60", penwidth="1.5") >> azure_vm_icon
    env_file >> Edge(label="configures", color="#D35400", fontcolor="#D35400", penwidth="1.5") >> terraform
    terraform - Edge(color="#3498DB", label="passes .env", fontcolor="#3498DB", penwidth="2.0") >> azure_vm_icon
    
    # Connect Mobile Frontend to Nginx from outside all clusters
    mobile_frontend >> Edge(label="HTTPS API requests via\nport 443", color="#E74C3C", fontcolor="#E74C3C", penwidth="1.5") >> nginx_container
