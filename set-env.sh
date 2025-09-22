#!/bin/bash

# Script to set up environment variables for the project

# Check if .dev.vars exists, if not create it from example
if [ ! -f .dev.vars ]; then
  cp .env.example .dev.vars
  echo "Created .dev.vars from .env.example"
fi

echo "Setting up environment variables..."

# Firebase Project ID
read -p "Enter your Firebase Project ID: " firebase_project_id
if [ ! -z "$firebase_project_id" ]; then
  sed -i "s/FIREBASE_PROJECT_ID=\".*\"/FIREBASE_PROJECT_ID=\"$firebase_project_id\"/" .dev.vars
  sed -i "s/FIREBASE_PROJECT_ID = \".*\"/FIREBASE_PROJECT_ID = \"$firebase_project_id\"/" wrangler.toml
fi

# Cloudflare Account ID
read -p "Enter your Cloudflare Account ID: " cloudflare_account_id
if [ ! -z "$cloudflare_account_id" ]; then
  sed -i "s/CLOUDFLARE_ACCOUNT_ID=\".*\"/CLOUDFLARE_ACCOUNT_ID=\"$cloudflare_account_id\"/" .dev.vars
  sed -i "s/CLOUDFLARE_ACCOUNT_ID = \".*\"/CLOUDFLARE_ACCOUNT_ID = \"$cloudflare_account_id\"/" wrangler.toml
fi

# Cloudflare API Token
read -p "Enter your Cloudflare API Token: " cloudflare_api_token
if [ ! -z "$cloudflare_api_token" ]; then
  sed -i "s/CLOUDFLARE_API_TOKEN=\".*\"/CLOUDFLARE_API_TOKEN=\"$cloudflare_api_token\"/" .dev.vars
  sed -i "s/CLOUDFLARE_API_TOKEN = \".*\"/CLOUDFLARE_API_TOKEN = \"$cloudflare_api_token\"/" wrangler.toml
fi

# Cloudflare Images Hash
read -p "Enter your Cloudflare Images Hash: " cloudflare_images_hash
if [ ! -z "$cloudflare_images_hash" ]; then
  sed -i "s/CLOUDFLARE_IMAGES_HASH=\".*\"/CLOUDFLARE_IMAGES_HASH=\"$cloudflare_images_hash\"/" .dev.vars
  sed -i "s/CLOUDFLARE_IMAGES_HASH = \".*\"/CLOUDFLARE_IMAGES_HASH = \"$cloudflare_images_hash\"/" wrangler.toml
fi

# Razorpay Key ID
read -p "Enter your Razorpay Key ID: " razorpay_key_id
if [ ! -z "$razorpay_key_id" ]; then
  sed -i "s/RAZORPAY_KEY_ID=\".*\"/RAZORPAY_KEY_ID=\"$razorpay_key_id\"/" .dev.vars
  sed -i "s/RAZORPAY_KEY_ID = \".*\"/RAZORPAY_KEY_ID = \"$razorpay_key_id\"/" wrangler.toml
fi

# Razorpay Key Secret
read -p "Enter your Razorpay Key Secret: " razorpay_key_secret
if [ ! -z "$razorpay_key_secret" ]; then
  sed -i "s/RAZORPAY_KEY_SECRET=\".*\"/RAZORPAY_KEY_SECRET=\"$razorpay_key_secret\"/" .dev.vars
  sed -i "s/RAZORPAY_KEY_SECRET = \".*\"/RAZORPAY_KEY_SECRET = \"$razorpay_key_secret\"/" wrangler.toml
fi

# Razorpay Webhook Secret
read -p "Enter your Razorpay Webhook Secret: " razorpay_webhook_secret
if [ ! -z "$razorpay_webhook_secret" ]; then
  sed -i "s/RAZORPAY_WEBHOOK_SECRET=\".*\"/RAZORPAY_WEBHOOK_SECRET=\"$razorpay_webhook_secret\"/" .dev.vars
  sed -i "s/RAZORPAY_WEBHOOK_SECRET = \".*\"/RAZORPAY_WEBHOOK_SECRET = \"$razorpay_webhook_secret\"/" wrangler.toml
fi

# Delhivery API Key
read -p "Enter your Delhivery API Key: " delhivery_api_key
if [ ! -z "$delhivery_api_key" ]; then
  sed -i "s/DELHIVERY_API_KEY=\".*\"/DELHIVERY_API_KEY=\"$delhivery_api_key\"/" .dev.vars
  sed -i "s/DELHIVERY_API_KEY = \".*\"/DELHIVERY_API_KEY = \"$delhivery_api_key\"/" wrangler.toml
fi

echo "Environment variables set up complete!"
echo "You can now run 'npx wrangler dev' to start the development server."