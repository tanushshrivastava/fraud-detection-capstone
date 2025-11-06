#!/bin/bash

# Quick deployment script for frontend-web only
# Use this when you only want to update the public web frontend

set -e

echo "========================================="
echo "Deploying Web Frontend Only"
echo "========================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Build Web Frontend
echo -e "${BLUE}Building Web Frontend...${NC}"
cd frontend-web

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

npm run build
cd ..
echo -e "${GREEN}✓ Web Frontend built${NC}"
echo ""

# Deploy only the web frontend stack
echo -e "${BLUE}Deploying Web Frontend Stack...${NC}"
cd cdk

# Get the stack suffix from .env if it exists
STACK_SUFFIX=""
if [ -f "../.env" ]; then
    STACK_SUFFIX=$(grep "^STACK_SUFFIX=" ../.env | cut -d '=' -f2)
fi

if [ -z "$STACK_SUFFIX" ]; then
    STACK_NAME="FraudWebFrontendStack"
else
    STACK_NAME="FraudWebFrontendStack-${STACK_SUFFIX}"
fi

cdk deploy "$STACK_NAME" "$@"
cd ..

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Web Frontend Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
