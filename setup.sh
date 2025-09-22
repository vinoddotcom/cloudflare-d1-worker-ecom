#!/bin/bash

# Script to set up and configure Cloudflare D1 database

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null
then
    echo "Wrangler CLI is not installed. Installing..."
    npm install -g wrangler
fi

# Login to Cloudflare if needed
echo "Ensuring you are logged in to Cloudflare..."
wrangler whoami || wrangler login

# Create development database
echo "Creating development database..."
DEV_DB_OUTPUT=$(wrangler d1 create blissmaa-dev-db 2>&1)
DEV_DB_ID=$(echo "$DEV_DB_OUTPUT" | grep -oP '(?<=id = ")[^"]*')

if [ -z "$DEV_DB_ID" ]
then
    echo "Failed to create development database or extract database ID."
    echo "Output was: $DEV_DB_OUTPUT"
    echo "You may need to create the database manually and update wrangler.toml"
else
    echo "Development database created with ID: $DEV_DB_ID"
    
    # Update wrangler.toml with the database ID
    sed -i "s/database_id = \"4d3692c0-1dce-4310-bfda-bda7917a89ab\"/database_id = \"$DEV_DB_ID\"/" wrangler.toml
    echo "Updated wrangler.toml with development database ID"
fi

# Create production database
echo "Creating production database..."
PROD_DB_OUTPUT=$(wrangler d1 create blissmaa-prod-db 2>&1)
PROD_DB_ID=$(echo "$PROD_DB_OUTPUT" | grep -oP '(?<=id = ")[^"]*')

if [ -z "$PROD_DB_ID" ]
then
    echo "Failed to create production database or extract database ID."
    echo "Output was: $PROD_DB_OUTPUT"
    echo "You may need to create the database manually and update wrangler.toml"
else
    echo "Production database created with ID: $PROD_DB_ID"
    
    # Update wrangler.toml with the database ID
    sed -i "s/database_id = \"499e52b9-dd7d-4c37-ad40-9f54638c98c1\"/database_id = \"$PROD_DB_ID\"/" wrangler.toml
    echo "Updated wrangler.toml with production database ID"
fi

# Create R2 buckets
echo "Creating development R2 bucket..."
wrangler r2 bucket create blissmaa-dev-images

echo "Creating production R2 bucket..."
wrangler r2 bucket create blissmaa-prod-images

echo "Setting up the database schema..."
# Apply initial migration
wrangler d1 execute blissmaa-dev-db --file=./src/data/schema.sql

echo "Setup complete! Please update your .dev.vars file with the necessary credentials."