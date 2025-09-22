# Cloudflare D1 Worker E-commerce API

This project is an enterprise-level e-commerce API built with Cloudflare Workers and D1 database.

## Environment Variables Setup

This project requires several environment variables to function correctly. There are two ways to configure them:

### Method 1: Using `.dev.vars` for Local Development

1. Create a `.dev.vars` file in the project root if it doesn't exist
2. Add the following environment variables:

```
ENVIRONMENT="development"
FIREBASE_PROJECT_ID="your-firebase-project-id"
DELHIVERY_API_KEY="your-delhivery-api-key"
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"
CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
CLOUDFLARE_IMAGES_HASH="your-cloudflare-images-hash"
```

### Method 2: Using Wrangler Secret Management

You can also use Wrangler's secret management feature to set environment variables:

```bash
# For development environment
wrangler secret put FIREBASE_PROJECT_ID --env dev
wrangler secret put DELHIVERY_API_KEY --env dev
wrangler secret put RAZORPAY_KEY_ID --env dev
wrangler secret put RAZORPAY_KEY_SECRET --env dev
wrangler secret put RAZORPAY_WEBHOOK_SECRET --env dev
wrangler secret put CLOUDFLARE_ACCOUNT_ID --env dev
wrangler secret put CLOUDFLARE_API_TOKEN --env dev
wrangler secret put CLOUDFLARE_IMAGES_HASH --env dev

# For production environment
wrangler secret put FIREBASE_PROJECT_ID --env production
# ... repeat for other variables
```

## Getting Credentials

### Cloudflare Credentials

1. **Cloudflare Account ID**: 
   - Log in to your Cloudflare dashboard
   - Your Account ID is visible in the URL bar: `https://dash.cloudflare.com/{account-id}`

2. **Cloudflare API Token**:
   - Go to "My Profile" > "API Tokens"
   - Create a new token with the permissions: "Account:Images:Edit", "Account:Workers:Edit", "Account:D1:Edit"

3. **Cloudflare Images Hash**:
   - Go to "Images" in your Cloudflare dashboard
   - Create an image delivery URL
   - The hash is the alphanumeric string in the delivery URL: `https://imagedelivery.net/{hash}/image.jpg`

### D1 Database and R2 Bucket

These resources are defined in your wrangler.toml file. To create them:

```bash
# Create D1 database
wrangler d1 create blissmaa-dev-db
wrangler d1 create blissmaa-prod-db

# Create R2 bucket
wrangler r2 bucket create blissmaa-dev-images
wrangler r2 bucket create blissmaa-prod-images
```

After creation, update your wrangler.toml with the database IDs provided.

### Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. The Project ID is what you need for FIREBASE_PROJECT_ID

### Razorpay Integration

1. Sign up for a [Razorpay account](https://razorpay.com/)
2. Get your API keys from the Dashboard > Settings > API Keys
3. For webhook secret, go to Settings > Webhooks > Create Webhook

### Delhivery Integration

1. Sign up for a [Delhivery account](https://www.delhivery.com/)
2. Contact their support to get API access
3. Once approved, you'll receive an API key

## Running the Application

```bash
# Install dependencies
npm install

# Run locally with Wrangler
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy --env production
```