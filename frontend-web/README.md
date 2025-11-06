# Fraud Detection Web Frontend

A public-facing web interface for testing credit card transaction fraud detection. This application allows anyone to submit transaction data and receive real-time fraud risk assessments without requiring login or authentication.

## Features

- **No Authentication Required** - Public access for testing fraud detection
- **Simple Transaction Form** - Easy-to-use interface with primary transaction fields
- **Advanced Fields** - Optional detailed fields for comprehensive testing
- **Quick Presets** - Load test data or start with a blank form
- **Real-time Results** - Instant fraud probability scores with visual risk indicators
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## Prerequisites

- Node.js 18+ and npm
- A deployed fraud detection backend API
- A test account created in the backend (see Setup section)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your API URL:

```env
REACT_APP_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_ACCOUNT_ID=your-public-account-id
```

### 3. Create a Public Test Account

Before using the web frontend, you need to create a test account in your backend that will be used for all public transactions. You can do this by calling the `/accounts` endpoint:

```bash
curl -X POST https://your-api-url/prod/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "username": "public-demo",
    "email": "demo@example.com",
    "address": "123 Main St, City, State 12345",
    "password": "demo-password-not-used",
    "phoneNumber": "",
    "fraudThreshold": 0.7
  }'
```

Save the returned `accountId` and add it to your `.env` file as `REACT_APP_ACCOUNT_ID`.

**Important:** This account will be used by all visitors to the website. Do not use a real account with sensitive information.

### 4. Start Development Server

```bash
npm start
```

The application will open at `http://localhost:3000`.

## Building for Production

Build the optimized production bundle:

```bash
npm run build
```

The build output will be in the `build/` directory, ready to deploy to:
- AWS S3 + CloudFront
- Netlify
- Vercel
- Any static hosting service

## Usage

### Quick Testing

1. Click **"Load Test Data"** to populate the form with sample transaction data
2. Click **"Submit Transaction"** to get fraud risk assessment
3. View the fraud score and risk level in the results panel

### Custom Transaction

1. Click **"Start Blank"** to clear the form
2. Fill in the required primary fields:
   - Merchant Name
   - Amount ($)
   - City
   - State
3. Click **"Show Advanced Fields"** to add detailed information (optional)
4. Submit to get your fraud risk score

### Understanding Results

The fraud detection model returns a score from 0.0 to 1.0:

- **Low Risk (0.0 - 0.3)** - Transaction appears legitimate
- **Medium Risk (0.4 - 0.7)** - Some suspicious patterns detected
- **High Risk (0.8 - 1.0)** - Strong indicators of fraud

## How It Works

This frontend application:

1. Collects transaction data from the user
2. Sends it to your backend API with a hardcoded `accountId`
3. The backend forwards the transaction to the SageMaker fraud detection model
4. Returns the fraud probability score and prediction details
5. Optionally triggers SMS alerts if the score exceeds the account's fraud threshold

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Full URL to your backend API (e.g., `https://xxx.execute-api.us-east-1.amazonaws.com/prod`) |
| `REACT_APP_ACCOUNT_ID` | No | Account ID to use for all transactions (defaults to `public-demo-account`) |

### Customization

You can customize the application by editing:

- `src/App.css` - Styling and theme colors
- `src/TransactionForm.js` - Form fields and validation
- `src/App.js` - Page layout and content

## Deployment

### AWS S3 + CloudFront

```bash
npm run build
aws s3 sync build/ s3://your-bucket-name/
```

### Netlify

```bash
npm run build
# Upload build/ directory via Netlify UI or CLI
```

### Vercel

```bash
npm run build
vercel --prod
```

## Security Considerations

Since this is a public-facing application with no authentication:

- **Use a dedicated test account** - Don't use real customer accounts
- **Set appropriate backend limits** - Rate limiting and request validation
- **Monitor usage** - Track API calls and costs
- **Disable SMS for the public account** - Avoid unwanted notifications
- **Consider adding CAPTCHA** - Prevent automated abuse
- **Review fraud threshold** - Set the public account's threshold high (e.g., 0.9) to minimize SMS alerts

## Troubleshooting

### "API URL not configured" error

Make sure you've created a `.env` file with `REACT_APP_API_URL` set correctly.

### CORS errors

Ensure your backend API Gateway has CORS enabled for your frontend domain:
- Allow Origin: `*` or your specific domain
- Allow Headers: `Content-Type, Authorization`
- Allow Methods: `POST, OPTIONS`

### "Account does not exist" error

You need to create the test account in your backend first (see Setup step 3).

### Fraud score not appearing

Check the browser console for errors and verify the API response format matches what the frontend expects (`fraudScore` or `prediction.fraud_probability`).

## Project Structure

```
frontend-web/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── App.js              # Main app component
│   ├── App.css             # Global styles
│   ├── TransactionForm.js  # Transaction submission form
│   └── index.js            # React entry point
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## Contributing

This project is part of a fraud detection capstone. For improvements:

1. Test your changes locally
2. Ensure the build succeeds (`npm run build`)
3. Update documentation if needed
4. Submit changes for review

## License

Part of the Fraud Detection Capstone Project.
