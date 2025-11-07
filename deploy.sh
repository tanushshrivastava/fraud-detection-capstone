#!/bin/bash

# Fraud Detection Deployment Script
# This script builds all components and deploys them via CDK

set -e  # Exit on any error

echo "========================================="
echo "Fraud Detection System - Full Deployment"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables from root .env file
if [ -f ".env" ]; then
    echo "Loading environment variables from root .env..."
    export $(grep -v '^#' .env | xargs)
    echo ""
else
    echo -e "${YELLOW}Warning: .env file not found in root directory${NC}"
    echo ""
fi

# Step 1: Build Backend Lambda
echo -e "${BLUE}[1/4] Building Backend Lambda...${NC}"
cd backend
./gradlew buildLambda || gradle buildLambda
cd ..
echo -e "${GREEN}✓ Backend Lambda built${NC}"
echo ""

# Step 2: Build Mobile Frontend (Expo)
echo -e "${BLUE}[2/4] Building Mobile Frontend (Expo)...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run export
cd ..
echo -e "${GREEN}✓ Mobile Frontend built${NC}"
echo ""

# Step 3: Build Web Frontend
echo -e "${BLUE}[3/4] Building Web Frontend...${NC}"
cd frontend-web
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Environment variables from root .env are already exported and will be used by npm build
npm run build
cd ..
echo -e "${GREEN}✓ Web Frontend built${NC}"
echo ""

# Step 4: Deploy via CDK
echo -e "${BLUE}[4/4] Deploying Infrastructure with CDK...${NC}"
cd cdk
cdk deploy --all "$@"
cd ..
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Check the CDK outputs above for:"
echo "  - API Gateway endpoint URL"
echo "  - CloudFront distribution URLs for frontends"
echo ""
