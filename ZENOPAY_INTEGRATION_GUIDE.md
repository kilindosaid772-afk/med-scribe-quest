# ZenoPay Integration Guide

## 🔐 Setup Instructions

### 1. Get ZenoPay Credentials

1. Sign up at [ZenoPay](https://zenopay.com)
2. Get your API credentials:
   - API Key
   - Merchant ID
3. Choose environment (Sandbox for testing, Production for live)

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# ZenoPay Configuration
VITE_ZENOPAY_API_KEY=your_api_key_here
VITE_ZENOPAY_MERCHANT_ID=your_merchant_id_here
VITE_ZENOPAY_ENV=sandbox  # or 'production'

# Optional: Callback URLs
VITE_ZENOPAY_CALLBACK_URL=https://yourdomain.com/api/payment/callback
VITE_ZENOPAY_RETURN_URL=https://yourdomain.com/billing/payment-success
```

For production, add to `.env.production`:

```env
VITE_ZENOPAY_API_KEY=your_production_api_key
VITE_ZENOPAY_MERCHANT_ID=your_production_merchant_id
VITE_ZENOPAY_ENV=production
VITE_ZENOPAY_CALLBACK_URL=https://yourdomain.com/api/payment/callback
VITE_ZENOPAY_RETURN_URL=https://yourdomain.com/billing/payment-success
```

## 💳 Payment Flow

### Standard Payment Process

1. **Initiate Payment**
   - User selects invoice to pay
   - System creates payment request
   - ZenoPay returns payment URL
   - User redirected to ZenoPay payment page

2. **Customer Pays**
   - Customer enters payment details on ZenoPay
   - ZenoPay processes payment
   - Customer redirected back to your app

3. **Verify Payment**
   - System verifies payment with ZenoPay
   - Update invoice status
   - Record payment in database
   - Show success message

### Payment Methods Supported by ZenoPay

- Credit/Debit Cards (Visa, Mastercard, etc.)
- Mobile Money
- Bank Transfer
- Digital Wallets
- Other local payment methods

## 🔧 Implementation

### Basic Payment Example

```typescript
import { zenoPay } from '@/lib/zenopay';

// Initiate payment
const paymentResult = await zenoPay.initiatePayment({
  amount: 100.00,
  currency: 'USD',
  reference: 'INV-12345',
  description: 'Hospital Invoice Payment',
  customerEmail: 'patient@example.com',
  customerPhone: '+1234567890',
  customerName: 'John Doe',
  callbackUrl: 'https://yourdomain.com/api/payment/callback',
  returnUrl: 'https://yourdomain.com/billing/success'
});

if (paymentResult.success) {
  // Redirect user to payment page
  window.location.href = paymentResult.paymentUrl;
} else {
  // Handle error
  console.error(paymentResult.error);
}
```

### Verify Payment

```typescript
// After payment, verify the transaction
const verification = await zenoPay.verifyPayment('INV-12345');

if (verification.success && verification.status === 'success') {
  // Payment successful
  // Update invoice status
  // Record payment
  console.log('Payment verified:', verification.transactionId);
} else {
  // Payment failed or pending
  console.log('Payment status:', verification.status);
}
```

### Check Payment Status

```typescript
// Check status by transaction ID
const status = await zenoPay.getPaymentStatus('txn_123456');
console.log('Payment status:', status.status);
```

### Process Refund

```typescript
// Full refund
const refund = await zenoPay.refundPayment('txn_123456', undefined, 'Customer request');

// Partial refund
const partialRefund = await zenoPay.refundPayment('txn_123456', 50.00, 'Partial refund');

if (refund.success) {
  console.log('Refund processed:', refund.transactionId);
}
```

## 🔄 Webhook Integration (Optional)

### Setup Webhook Endpoint

Create a webhook endpoint to receive payment notifications:

```typescript
// Example webhook handler (backend)
app.post('/api/payment/callback', async (req, res) => {
  const { reference, status, transaction_id, amount } = req.body;
  
  // Verify webhook signature (if ZenoPay provides one)
  // const isValid = verifyWebhookSignature(req);
  
  if (status === 'success') {
    // Update payment in database
    await updatePaymentStatus(reference, {
      status: 'paid',
      transaction_id,
      paid_at: new Date(),
    });
  }
  
  res.status(200).json({ received: true });
});
```

### Configure Webhook in ZenoPay Dashboard

1. Go to ZenoPay Dashboard
2. Navigate to Settings → Webhooks
3. Add your webhook URL: `https://yourdomain.com/api/payment/callback`
4. Select events to receive
5. Save configuration

## 🧪 Testing

### Sandbox Mode

Use these test credentials in sandbox mode:

**Test Cards:**
- Success: `4111 1111 1111 1111`
- Decline: `4000 0000 0000 0002`
- Insufficient Funds: `4000 0000 0000 9995`

**Test Mobile Money:**
- Success: `+1234567890`
- Pending: `+1234567891`
- Failed: `+1234567892`

### Test Payment Flow

```typescript
// Test payment in sandbox
const testPayment = await zenoPay.initiatePayment({
  amount: 10.00,
  currency: 'USD',
  reference: 'TEST-' + Date.now(),
  description: 'Test Payment',
  customerEmail: 'test@example.com',
});

console.log('Test payment URL:', testPayment.paymentUrl);
```

## 📊 Payment Status Codes

| Status | Description |
|--------|-------------|
| `pending` | Payment initiated, awaiting completion |
| `success` | Payment completed successfully |
| `failed` | Payment failed |
| `cancelled` | Payment cancelled by user |
| `expired` | Payment link expired |
| `refunded` | Payment refunded |

## 🔒 Security Best Practices

### 1. Secure API Keys
- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Use different keys for sandbox and production

### 2. Verify Payments
- Always verify payment status server-side
- Don't trust client-side verification alone
- Check payment amount matches invoice
- Verify reference matches your records

### 3. Handle Webhooks Securely
- Verify webhook signatures
- Use HTTPS for webhook URLs
- Validate payload data
- Implement idempotency

### 4. Error Handling
- Log all payment errors
- Provide user-friendly error messages
- Implement retry logic for network errors
- Monitor failed payments

## 🐛 Troubleshooting

### Common Issues

**Issue: Payment initiation fails**
- Check API key and merchant ID
- Verify environment setting (sandbox/production)
- Check network connectivity
- Review ZenoPay API status

**Issue: Payment verification fails**
- Ensure reference is correct
- Check if payment was actually completed
- Verify API credentials
- Check ZenoPay transaction logs

**Issue: Webhook not received**
- Verify webhook URL is accessible
- Check webhook configuration in ZenoPay
- Ensure endpoint returns 200 status
- Check server logs for errors

**Issue: Refund fails**
- Verify transaction is eligible for refund
- Check refund amount doesn't exceed original
- Ensure sufficient time hasn't passed
- Check merchant account balance

## 📞 Support

### ZenoPay Support
- Documentation: https://zenopay.com/docs
- Support Email: support@zenopay.com
- Dashboard: https://dashboard.zenopay.com

### Integration Support
- Check implementation in `src/lib/zenopay.ts`
- Review billing dashboard integration
- Check environment variables
- Review application logs

## 🚀 Going Live

### Pre-Production Checklist

- [ ] Test all payment flows in sandbox
- [ ] Test refund process
- [ ] Verify webhook integration
- [ ] Update to production API keys
- [ ] Set environment to 'production'
- [ ] Test with small real transaction
- [ ] Monitor first few transactions
- [ ] Set up payment monitoring/alerts

### Production Configuration

```env
# Production settings
VITE_ZENOPAY_API_KEY=prod_key_xxxxx
VITE_ZENOPAY_MERCHANT_ID=merchant_xxxxx
VITE_ZENOPAY_ENV=production
VITE_ZENOPAY_CALLBACK_URL=https://yourdomain.com/api/payment/callback
VITE_ZENOPAY_RETURN_URL=https://yourdomain.com/billing/success
```

## 📈 Monitoring

### Track These Metrics
- Payment success rate
- Average payment time
- Failed payment reasons
- Refund rate
- Transaction volume
- Revenue by payment method

### Logging
All payment operations are logged:
- Payment initiations
- Verification attempts
- Status checks
- Refunds
- Errors

Check activity logs in Admin Dashboard for payment audit trail.

---

**Last Updated**: November 15, 2025  
**ZenoPay API Version**: v1  
**Integration Status**: ✅ Ready
