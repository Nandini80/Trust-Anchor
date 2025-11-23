# Fixing Registration Errors

This document explains the two errors you're seeing and how to fix them.

## Error 1: Blockchain Admin Permission Error

**Error Message:**
```
Blockchain registration failed: Returned error: VM Exception while processing transaction: revert Only Admin has permission to do that action!
```

### Problem
The `ADMIN_ADDRESS` in your `.env` file is not registered as an admin in the smart contract. The contract requires admin permissions to add customers.

### Solution

You have two options:

#### Option 1: Use the Contract Owner Address (Easiest)

1. Find the contract owner address (the address that deployed the contract):
   - Check Ganache - it's usually the first account (index 0)
   - Or check the migration output when you ran `truffle migrate`

2. Update your `.env` file:
   ```env
   ADMIN_ADDRESS=<contract_owner_address>
   ADMIN_KEY=<contract_owner_private_key>
   ```

#### Option 2: Add Your Address as Admin

If you want to use a different address, you need to add it as an admin first:

1. Make sure you have the contract owner's address and private key
2. Add these to your `.env` file:
   ```env
   OWNER_ADDRESS=<contract_owner_address>
   OWNER_KEY=<contract_owner_private_key>
   ADMIN_ADDRESS_TO_ADD=<address_you_want_to_add_as_admin>
   ```
3. Run the helper script:
   ```bash
   cd blockchain/scripts
   node addAdmin.js
   ```
4. Now you can use `ADMIN_ADDRESS_TO_ADD` as your `ADMIN_ADDRESS` in the main `.env` file

### Finding the Contract Owner

The contract owner is automatically set when you deploy the contract. To find it:

1. Check Ganache - the first account (usually at index 0) is typically used for deployment
2. Or check the migration transaction in Ganache
3. The improved error message will also show you the contract owner address

---

## Error 2: Email Authentication Error

**Error Message:**
```
Invalid login: 535-5.7.8 Username and Password not accepted
Error code: EAUTH
```

### Problem
Your Gmail OAuth2 credentials are either:
- Missing from the `.env` file
- Invalid or expired
- Not properly configured

### Solution

#### Step 1: Get Gmail OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000` (or your redirect URI)
   - Save the Client ID and Client Secret

#### Step 2: Generate Refresh Token

You need to generate a refresh token. You can use a tool like [this one](https://developers.google.com/oauthplayground/) or follow these steps:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In the left panel, find "Gmail API v1" and select:
   - `https://mail.google.com/`
6. Click "Authorize APIs"
7. After authorization, click "Exchange authorization code for tokens"
8. Copy the "Refresh token"

#### Step 3: Update Your .env File

Add these variables to your `.env` file:

```env
OAUTH_CLIENT=your_client_id_here
CLIENT_SECRET=your_client_secret_here
REFRESH_TOKEN=your_refresh_token_here
REDIRECT_URI=http://localhost:3000
```

#### Step 4: Restart Your Server

After updating the `.env` file, restart your Node.js server.

### Note
The email error won't prevent registration from succeeding - it's handled gracefully. Users will still be registered, but they won't receive the email with their credentials.

---

## Quick Checklist

- [ ] Ganache is running on `http://localhost:7545`
- [ ] Contract is deployed (network ID matches - check Ganache)
- [ ] `ADMIN_ADDRESS` in `.env` matches the contract owner OR has been added as admin
- [ ] `ADMIN_KEY` in `.env` is the private key for `ADMIN_ADDRESS`
- [ ] Gmail OAuth2 credentials are set in `.env` (optional, but recommended)

---

## Testing

After fixing the issues:

1. Restart your server
2. Try registering a new user
3. Check the console logs - you should see:
   - ✅ "Blockchain receipt: ..." (if blockchain works)
   - ✅ "Registration email sent successfully to: ..." (if email works)
   - ⚠️ Error messages will be more descriptive now

---

## Need Help?

- Check the improved error messages in the console - they now provide more specific guidance
- The blockchain error will show you the contract owner address
- The email error will indicate if credentials are missing or invalid

