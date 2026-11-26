
# SAVAGE MD V2

A multi-customer WhatsApp bot platform by Lupin Tech.

## Overview

SAVAGE MD V2 is a customer-based WhatsApp automation platform with:

- Customer accounts and authentication.
- Unique usernames.
- Single-use, username-bound access keys.
- Manual payment verification.
- 30-day subscriptions.
- Customer-specific WhatsApp pairing.
- Customer-specific designated promotion numbers.
- Private customer dashboard.
- Private owner administration panel.
- PostgreSQL database.
- Encrypted persistent session storage.

## Project Rules

- V1.115 remains independent and untouched.
- V2 has no free trials.
- Monthly subscription price: ₦3,000.
- Payments are manually verified by the owner.
- Each customer has exactly one username and one access key.
- Access keys are single-use and username-bound.
- Subscriptions last 30 days after redemption.
- Renewal before expiry adds 30 days to the existing expiry.
- Expired subscriptions require a verified renewal.
- Each customer configures their own pairing and promotion numbers.
- Customer data and WhatsApp sessions must remain isolated.

## Technology

- Node.js
- Express
- PostgreSQL
- Baileys
- HTML
- CSS
- JavaScript
- Render

## Requirements

- Node.js 20 or later, below 23.
- PostgreSQL database.
- Secure session encryption key.
- Owner authentication secrets.
- Encrypted persistent storage for WhatsApp credentials.

## Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd savage-md-v2
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Configure the required environment variables.

Initialize the database:

```bash
npm run db:init
```

Check the environment:

```bash
npm run check:env
```

Start the application:

```bash
npm start
```

## Environment Variables

| Variable | Purpose |
|---|---|
| NODE_ENV | Application environment |
| PORT | Server port |
| DATABASE_URL | PostgreSQL connection |
| COMMAND_PREFIX | Bot command prefix |
| LOG_LEVEL | Logging level |
| SESSION_ENCRYPTION_KEY | Session encryption |
| OWNER_ADMIN_SECRET | Owner authentication |
| ADMIN_SESSION_SECRET | Admin session signing |
| PAIRING_CODE_WAIT_MS | Pairing wait duration |
| PAIRING_TIMEOUT_MS | Pairing timeout |

Never commit your real `.env` file.

## Customer Account Flow

1. Customer contacts the owner.
2. Owner verifies payment manually.
3. Owner reserves one unique username.
4. Owner issues one access key.
5. Customer redeems the key.
6. Subscription starts for 30 days.
7. Customer configures their WhatsApp numbers.
8. Customer starts pairing through the dashboard.

## Payment

Monthly subscription:

**₦3,000 / 30 days**

Payment verification is performed manually by the owner.

Customer-submitted payment references are not proof of payment.

## Session Storage

Render Free does not provide persistent local disk storage.

WhatsApp credentials must therefore use encrypted external persistent storage.

Do not rely on the local filesystem for permanent session storage.

## Security

- Keep secrets out of source code.
- Never log access keys or WhatsApp credentials.
- Protect owner administration routes.
- Use secure customer authentication.
- Enforce customer isolation on the server.
- Validate all pairing requests.
- Enforce session limits.
- Use database transactions for sensitive account operations.

## Testing

Run tests:

```bash
npm test
```

Run syntax checks:

```bash
npm run check
```

Run validation:

```bash
npm run validate
```

## Deployment

Deploy V2 as a separate Render service.

Configure PostgreSQL and all required secrets in Render.

Do not modify the existing V1.115 deployment.

## Project Owner

**Lupin Tech**

SAVAGE MD V2
