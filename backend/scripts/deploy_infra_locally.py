#!/usr/bin/env python3
import os
import subprocess
import argparse

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Start BiteSwipe services')
    parser.add_argument('-q', '--quiet', action='store_true', help='Run in quiet mode (hide container logs)')
    args = parser.parse_args()

    # Change to the backend directory containing docker-compose.yml
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)  # Parent of scripts directory is backend
    os.chdir(backend_dir)
    
    print("\n🧹 Cleaning up any existing containers...")
    subprocess.run(['docker-compose', 'down'], check=True)
    
    print("\n🚀 Starting BiteSwipe services with docker-compose...")
    print("\nService URLs (will be available after startup):")
    print("📱 Backend API: http://localhost:3000")
    print("💾 MongoDB: mongodb://localhost:27017")
    print("\nTo view logs: docker-compose logs -f")
    print("To stop services: docker-compose down\n")
    
    # Start the services
    if args.quiet:
        # Run in detached mode and only show errors
        subprocess.run(['docker-compose', 'up', '-d'], check=True)
        print("Services started in quiet mode. Use 'docker-compose logs -f' to view logs if needed.")
    else:
        # Run in foreground mode with logs
        subprocess.run(['docker-compose', 'up'], check=True)

if __name__ == "__main__":
    main()