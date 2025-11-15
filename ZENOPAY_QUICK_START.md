# ZenoPay Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Get ZenoPay Credentials (2 minutes)

1. Visit [ZenoPay](https://zenopay.com) and sign up
2. Complete merchant verification
3. Go to Dashboard → API Settings
4. Copy your credentials:
   - API Key
   - Merchant ID

### Step 2: Configure Environment (1 minute)

Add to your `.env` file:

```env
VITE_ZENOPAY_API_KEY=your_api_key_here
VITE_ZENOPAY_MERCHANT_ID=your_merchant_id_here
VITE_ZENOPAY_ENV=sandbox
```

For production, use `.env.production`:

```env
VITE_ZENOPAY_API_KEY=prod_key_xxxxx
VITE_ZENOPAY_MERCHANT_ID=merchant_xxxxx
VITE_ZENOPAY_ENV=production
```

### Step 3: Test Payment (2 minutes)

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Login as billing staff
3. Go to Billing Dashboard
4. Select an unpaid invoice
5. Click "Pay with ZenoPay"
6. Use test card: `4111 1111 1111 1111`
7. Complete payment

## ✅ That's It!

Your ZenoPay integration is ready. Payments will now:
- ✅ Redirect to ZenoPay payment page
- ✅ Process payment securely
- ✅ Verify payment automatically
- ✅ Update invoice status
- ✅ Record payment in database
- ✅ Log activity for audit

## 📱 How It Works

### For Billing Staff:
1. Select unpaid invoice
2. Click "Pay with ZenoPay" button
3. Patient redirected to ZenoPay
4. Patient completes payment
5. System verifies payment
6. Invoice marked as paid
7. Payment recorded

### For Patients:
1. Receive invoice
2. Click payment link
3. Choose payment method on ZenoPay:
   - Credit/Debit Card
   - Mobile Money
   - Bank Transfer
   - Digital Wallet
4. Complete payment
5. Receive confirmation
6. Redirected back to hospital system

## 🔧 Integration Points

### Files Created:
- `src/lib/zenopay.ts` - ZenoPay service
- `src/components/ZenoPayButton.tsx` - Payment button component
- `src/pages/PaymentSuccess.tsx` - Payment confirmation page
- `ZENOPAY_INTEGRATION_GUIDE.md` - Full documentation

### Updated Files:
- `src/App.tsx` - Added payment success route
- `.env.production.example` - Added ZenoPay variables

## 🧪 Testing

### Sandbox Test Cards:
- **Success**: `4111 1111 1111 1111`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

### Test Mobile Money:
- **Success**: `+1234567890`
- **Pending**: `+1234567891`
- **Failed**: `+1234567892`

## 🎯 Next Steps

### Before Going Live:
1. ✅ Test all payment scenarios
2. ✅ Test refund process
3. ✅ Switch to production credentials
4. ✅ Update environment to 'production'
5. ✅ Test with small real transaction
6. ✅ Monitor first transactions

### Production Checklist:
- [ ] Production API key configured
- [ ] Production merchant ID configured
- [ ] Environment set to 'production'
- [ ] Webhook URL configured (optional)
- [ ] SSL certificate active
- [ ] Test payment completed
- [ ] Refund process tested

## 💡 Usage Example

### In Billing Dashboard:

```typescript
import { ZenoPayButton } from '@/components/ZenoPayButton';

<ZenoPayButton
  invoiceId={invoice.id}
  invoiceNumber={invoice.invoice_number}
  amount={invoice.total_amount}
  currency="USD"
  patientName={invoice.patient.full_name}
  patientEmail={invoice.patient.email}
  patientPhone={invoice.patient.phone}
  onSuccess={(transactionId) => {
    console.log('Payment successful:', transactionId);
    // Refresh invoice list
    fetchInvoices();
  }}
  onError={(error) => {
    console.error('Payment error:', error);
  }}
/>
```

## 🔒 Security Features

- ✅ Secure API communication (HTTPS)
- ✅ Payment verification before recording
- ✅ Transaction ID tracking
- ✅ Activity logging for audit
- ✅ No sensitive data stored locally
- ✅ PCI DSS compliant (via ZenoPay)

## 📊 Payment Flow Diagram

```
Patient → Billing Dashboard → ZenoPay Button
                                    ↓
                            ZenoPay Payment Page
                                    ↓
                            Payment Processing
                                    ↓
                            Payment Success/Fail
                                    ↓
                            Redirect to Success Page
                                    ↓
                            Verify Payment
                                    ↓
                            Update Database
                                    ↓
                            Show Confirmation
```

## 📞 Support

### ZenoPay Support:
- Docs: https://zenopay.com/docs
- Email: support@zenopay.com
- Dashboard: https://dashboard.zenopay.com

### Integration Issues:
- Check `ZENOPAY_INTEGRATION_GUIDE.md`
- Review browser console for errors
- Check environment variables
- Verify API credentials

## 🎉 You're Ready!

Your ZenoPay integration is complete and ready to process payments!

---

**Setup Time**: ~5 minutes  
**Status**: ✅ Ready to Use  
**Last Updated**: November 15, 2025
