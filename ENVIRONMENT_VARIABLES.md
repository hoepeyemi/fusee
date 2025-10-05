# Environment Variables Configuration

This document describes the environment variables used to configure the Fusee multisig backend system.

## Required Environment Variables

### Database Configuration
```bash
DATABASE_URL="file:./dev.db"
```

### Server Configuration
```bash
PORT=3002
```

### Solana Configuration
```bash
# Solana RPC endpoint
RPC_URL="https://api.devnet.solana.com"
# Alternative: SOLANA_RPC_URL

# Solana network (devnet, mainnet-beta, testnet)
SOLANA_NETWORK="devnet"
```

## Lulo.fi API Configuration

### Boosted Yield Investment API
```bash
# Lulo.fi API key for boosted yield investments
LULO_API_KEY="your-lulo-api-key-here"

# Optional: Priority fee in lamports (default: 50000)
LULO_PRIORITY_FEE="50000"
```

**Important Notes:**
- `LULO_API_KEY` is required for boosted yield investment functionality
- You can get your API key from your Lulo.fi project overview
- The API key is used to generate transactions and instructions for yield investments
- Priority fee can be adjusted based on network conditions

## Multisig Configuration

### Default Multisig Members
These are the default members that will be used for all multisig creation operations. You can configure 2-3 members:

```bash
# Member 1 - Full admin permissions (propose, vote, execute)
MULTISIG_MEMBER_1_PRIVATE_KEY="5zJzZD9pkyyCX4u4SGeMhz4Ji6rakKWisNhzjRaNS1owM1cJZLhtZuHKE8PHnsnWQQGUZWjtvTeNwAwxkkY6UrEn"

# Member 2 - Full admin permissions (propose, vote, execute)
MULTISIG_MEMBER_2_PRIVATE_KEY="42bg24YDM4qCP9Q9Kwzs91tPfAxT5U4nbtdGpe5GAYdZRTFV5vYsmZ9o2DRFdBgdLk5Q1piWtt9CoqGJaRgYk2Qj"

# Member 3 - Full admin permissions (propose, vote, execute) - OPTIONAL
MULTISIG_MEMBER_3_PRIVATE_KEY="your-member3-private-key-here"
```

**Important Notes:**
- These must be valid base58-encoded Solana private keys
- **All members get full admin permissions** (propose, vote, execute)
- **Approval Model**: All members must approve transactions (threshold = member count)
- **Execution Model**: Any one member can execute approved transactions
- **Minimum 2 members required, maximum 3 members**
- Member 3 is optional - if not provided, only 2 members will be used
- These keys are used for all multisig creation operations
- **Never commit real private keys to version control!**

### Multisig Default Settings
```bash
# Default threshold (0 = use member count, all must approve)
MULTISIG_DEFAULT_THRESHOLD=0

# Default time lock (seconds to wait before execution)
MULTISIG_DEFAULT_TIME_LOCK=5

# Member count limits (2-3 members)
MULTISIG_MIN_MEMBERS=2
MULTISIG_MAX_MEMBERS=3
```

**Threshold Behavior:**
- **0**: Use member count (all members must approve) - **RECOMMENDED**
- **1-N**: Custom threshold (N members must approve)
- **All members can execute** approved transactions regardless of threshold

**Time Lock Behavior:**
- **0**: No delay (immediate execution after approval)
- **1-N**: N seconds delay before execution is allowed
- **5 seconds**: Recommended for security (prevents immediate execution)
- **Time lock starts** when transaction is approved by all required members

## Multisig Workflow

### Approval Process
1. **Propose**: Any member can propose a transaction
2. **Approve**: All members must approve the transaction (threshold = member count)
3. **Time Lock**: Wait 5 seconds before execution is allowed
4. **Execute**: Any one member can execute the approved transaction (after time lock)

### Example Scenarios
- **2 Members**: Both must approve, either can execute
- **3 Members**: All three must approve, any one can execute
- **Custom Threshold**: Set specific number of approvals required

## Security Configuration
```bash
# CSRF protection secret
CSRF_SECRET="your-csrf-secret-key-here"

# Session management secret
SESSION_SECRET="your-session-secret-key-here"
```

## Example .env File

Create a `.env` file in the project root with the following content:

```bash
# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3002

# Solana Configuration
RPC_URL="https://api.devnet.solana.com"
SOLANA_NETWORK="devnet"

# Multisig Configuration
MULTISIG_MEMBER_1_PRIVATE_KEY="5zJzZD9pkyyCX4u4SGeMhz4Ji6rakKWisNhzjRaNS1owM1cJZLhtZuHKE8PHnsnWQQGUZWjtvTeNwAwxkkY6UrEn"
MULTISIG_MEMBER_2_PRIVATE_KEY="42bg24YDM4qCP9Q9Kwzs91tPfAxT5U4nbtdGpe5GAYdZRTFV5vYsmZ9o2DRFdBgdLk5Q1piWtt9CoqGJaRgYk2Qj"
MULTISIG_MEMBER_3_PRIVATE_KEY="your-member3-private-key-here"

# Multisig Default Settings
MULTISIG_DEFAULT_THRESHOLD=0
MULTISIG_DEFAULT_TIME_LOCK=5
MULTISIG_MIN_MEMBERS=2
MULTISIG_MAX_MEMBERS=3

# Security
CSRF_SECRET="your-csrf-secret-key-here"
SESSION_SECRET="your-session-secret-key-here"
```

## How to Change Default Members

1. **Generate new keypairs** (if needed):
   ```bash
   # Using Solana CLI
   solana-keygen new --outfile member1.json
   solana-keygen new --outfile member2.json
   solana-keygen new --outfile member3.json  # Optional third member
   
   # Get the private keys
   cat member1.json | jq -r '.secretKey' | base58
   cat member2.json | jq -r '.secretKey' | base58
   cat member3.json | jq -r '.secretKey' | base58  # Optional
   ```

2. **Update environment variables**:
   ```bash
   # Required members (minimum 2)
   MULTISIG_MEMBER_1_PRIVATE_KEY="your-new-member1-private-key"
   MULTISIG_MEMBER_2_PRIVATE_KEY="your-new-member2-private-key"
   
   # Optional third member (maximum 3)
   MULTISIG_MEMBER_3_PRIVATE_KEY="your-new-member3-private-key"
   
   # Optional: Adjust member limits
   MULTISIG_MIN_MEMBERS=2
   MULTISIG_MAX_MEMBERS=3
   ```

3. **Restart the application**:
   ```bash
   yarn start
   ```

## Validation

The system automatically validates:
- Private keys are valid base58 format
- Private keys can be converted to valid Solana keypairs
- Threshold is a positive integer
- Time lock is a non-negative integer
- RPC URL is accessible

If validation fails, the system will:
- Log detailed error messages
- Fall back to hardcoded default values
- Continue operation with warnings

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate keys regularly** in production
4. **Use different keys** for different environments (dev/staging/prod)
5. **Monitor key usage** and access patterns
6. **Backup keys securely** using hardware wallets or secure key management

## Troubleshooting

### Common Issues

1. **"Invalid private keys in configuration"**
   - Check that private keys are valid base58 format
   - Ensure keys are properly encoded
   - Verify keys can be converted to Solana keypairs

2. **"MULTISIG_MEMBER_1_PRIVATE_KEY environment variable is required"**
   - Ensure `.env` file exists in project root
   - Check that environment variables are properly set
   - Restart the application after changing environment variables

3. **"Failed to load multisig config from environment"**
   - Check `.env` file syntax
   - Ensure all required variables are set
   - Verify no extra spaces or quotes in values

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=multisig:*
```

This will show detailed information about configuration loading and validation.
