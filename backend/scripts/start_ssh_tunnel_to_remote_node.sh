
kill $(lsof -ti:9229) 2>/dev/null || true && \
ssh-keygen -R hamaney-biteswipe.westus2.cloudapp.azure.com && \
ssh \
    -o StrictHostKeyChecking=no \
    -N \
    -L 9229:localhost:9229 \
    -i ~/.ssh/to_azure/CPEN321.pem \
    adminuser@hamaney-biteswipe.westus2.cloudapp.azure.com