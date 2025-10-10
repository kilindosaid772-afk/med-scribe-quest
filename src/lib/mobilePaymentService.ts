/**
 * ZenoPay Mobile Money Tanzania Integration
 * Unified API for all Tanzanian mobile money providers (M-Pesa, Airtel Money, Tigo Pesa, Halopesa)
 */

import { supabase } from '@/integrations/supabase/client';

export interface MobilePaymentRequest {
  phoneNumber: string;
  amount: number;
  invoiceId: string;
  paymentMethod: 'M-Pesa' | 'Airtel Money' | 'Tigo Pesa' | 'Halopesa';
  description?: string;
}

export interface MobilePaymentResponse {
  success: boolean;
  message: string;
  transactionId?: string;
  orderId?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface PaymentWebhookData {
  order_id: string;
  payment_status: string;
  reference: string;
  metadata?: any;
}

// ZenoPay configuration
const ZENOPAY_CONFIG = {
  apiUrl: import.meta.env.DEV ? '' : (import.meta.env.VITE_ZENOPAY_API_URL || 'https://zenoapi.com'),
  apiKey: import.meta.env.VITE_ZENOPAY_API_KEY,
  webhookUrl: import.meta.env.VITE_APP_URL ?
    (import.meta.env.VITE_APP_URL.endsWith('/api/webhooks/zenopay') ?
      import.meta.env.VITE_APP_URL :
      `${import.meta.env.VITE_APP_URL}/api/webhooks/zenopay`) :
    undefined,
};

// Debug logging in development
if (import.meta.env.DEV) {
  console.log('🔧 ZenoPay Config Debug:', {
    apiUrl: ZENOPAY_CONFIG.apiUrl,
    apiKey: ZENOPAY_CONFIG.apiKey ? '***configured***' : 'NOT SET',
    webhookUrl: ZENOPAY_CONFIG.webhookUrl,
    devMode: import.meta.env.DEV,
    envVars: {
      VITE_ZENOPAY_API_URL: import.meta.env.VITE_ZENOPAY_API_URL,
      VITE_ZENOPAY_API_KEY: import.meta.env.VITE_ZENOPAY_API_KEY ? '***set***' : 'NOT SET',
      VITE_APP_URL: import.meta.env.VITE_APP_URL,
    }
  });
}

class ZenoPayService {
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Handle different phone number formats for Tanzania
    if (cleaned.startsWith('255')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return `255${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `255${cleaned}`;
    }

    return cleaned;
  }

  private generateOrderId(invoiceId: string): string {
    // Generate UUID-like order ID for ZenoPay
    return `${invoiceId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async initiatePayment(request: MobilePaymentRequest): Promise<MobilePaymentResponse> {
    const { phoneNumber, amount, invoiceId, paymentMethod, description } = request;

    console.log('🚀 Initiating mobile payment:', {
      phoneNumber,
      amount,
      invoiceId,
      paymentMethod,
      apiUrl: ZENOPAY_CONFIG.apiUrl,
      hasApiKey: !!ZENOPAY_CONFIG.apiKey,
      apiKeyFirstChars: ZENOPAY_CONFIG.apiKey ? ZENOPAY_CONFIG.apiKey.substring(0, 8) + '...' : 'NOT SET'
    });

    if (!ZENOPAY_CONFIG.apiKey) {
      console.warn('❌ ZenoPay API key not configured. Mobile payments will not work.');
      return {
        success: false,
        message: 'Mobile payment service not configured. Please configure VITE_ZENOPAY_API_KEY in your .env file.',
        error: 'CONFIG_ERROR'
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const orderId = this.generateOrderId(invoiceId);

      const paymentData = {
        order_id: orderId,
        buyer_name: 'Patient',
        buyer_phone: formattedPhone,
        buyer_email: 'patient@medscribe.com',
        amount: Math.round(amount),
        webhook_url: ZENOPAY_CONFIG.webhookUrl,
        metadata: {
          invoice_id: invoiceId,
          payment_method: paymentMethod,
          description: description || `Payment for invoice ${invoiceId}`
        }
      };

      // In development, use proxy to avoid CORS issues
      const baseUrl = import.meta.env.DEV ? '' : 'https://zenoapi.com';

      // Try the exact endpoint format that works in Postman
      const endpoints = [
        `${baseUrl}/api/payments/mobile_money_tanzania`,
        `${baseUrl}/payments/mobile_money_tanzania`,
        `${ZENOPAY_CONFIG.apiUrl}/payments/mobile_money_tanzania`,
        `${ZENOPAY_CONFIG.apiUrl}/api/payments/mobile_money_tanzania`
      ];

      let response;
      let endpointUsed = '';

      for (const endpoint of endpoints) {
        console.log(`📡 Trying endpoint: ${endpoint}`);

        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ZENOPAY_CONFIG.apiKey,
            'Accept': 'application/json',
            'User-Agent': 'MedScribe-Quest/1.0'
          },
          body: JSON.stringify(paymentData)
        });

        endpointUsed = endpoint;
        console.log(`📥 Response from ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        // If we get a successful response, break and use this response
        if (response.ok) {
          break;
        }

        // If we get 405 (Method Not Allowed), try with different headers
        if (response.status === 405) {
          console.log(`🔄 Trying ${endpoint} with different headers...`);

          // Try with minimal headers (like Postman might use)
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ZENOPAY_CONFIG.apiKey,
              'Accept': 'application/json'
            },
            body: JSON.stringify(paymentData)
          });

          console.log(`📥 Response with minimal headers:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });
        }

        // If we still get 405, try the next endpoint
        if (response.status === 405) {
          console.log(`❌ ${endpoint} doesn't work, trying next endpoint...`);
          continue;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Payment failed:', {
          endpoint: endpointUsed,
          status: response.status,
          error: errorText,
          responseHeaders: Object.fromEntries(response.headers.entries())
        });

        // Handle specific error cases
        if (response.status === 404) {
          throw new Error(`API endpoint not found (${endpointUsed}). Check if the endpoint exists and API key is valid.`);
        } else if (response.status === 401) {
          throw new Error(`Invalid API key. Please check your ZenoPay API key format and permissions.`);
        } else if (response.status === 405) {
          if (endpointUsed.includes('zenoapi.com/api/payments/mobile_money_tanzania')) {
            throw new Error(`405 Method Not Allowed on the working Postman endpoint. This suggests an authentication or request format issue.`);
          } else {
            throw new Error(`Method not allowed on ${endpointUsed}. The endpoint might not accept POST requests.`);
          }
        } else {
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
      }

      const responseData = await response.json();
      console.log('✅ Payment successful:', responseData);

      if (responseData) {
        return {
          success: true,
          message: `${paymentMethod} payment request sent successfully via ZenoPay`,
          transactionId: responseData.reference || orderId,
          orderId: orderId,
          status: 'pending'
        };
      } else {
        return {
          success: false,
          message: 'Failed to initiate payment through ZenoPay',
          error: 'ZENOPAY_ERROR'
        };
      }
    } catch (error: any) {
      console.error('💥 ZenoPay payment error:', error.message);

      return {
        success: false,
        message: error.message || 'Failed to initiate payment through ZenoPay',
        error: 'ZENOPAY_ERROR'
      };
    }
  }

  async checkPaymentStatus(orderId: string): Promise<MobilePaymentResponse> {
    if (!ZENOPAY_CONFIG.apiKey) {
      console.warn('ZenoPay API key not configured. Cannot check payment status.');
      return {
        success: false,
        message: 'Mobile payment service not configured. Please configure VITE_ZENOPAY_API_KEY in your .env file.',
        error: 'CONFIG_ERROR'
      };
    }

    try {
      const response = await fetch(
        `${ZENOPAY_CONFIG.apiUrl}/api/payments/order-status?order_id=${orderId}`,
        {
          headers: {
            'x-api-key': ZENOPAY_CONFIG.apiKey
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData && responseData.data && responseData.data.length > 0) {
        const paymentData = responseData.data[0];
        const newStatus = paymentData.payment_status === 'COMPLETED' ? 'completed' : 'pending';

        // Update payment status in database
        await this.updatePaymentStatus(orderId, newStatus);

        return {
          success: true,
          message: 'Payment status retrieved successfully',
          transactionId: paymentData.transid,
          orderId: paymentData.order_id,
          status: newStatus
        };
      } else {
        return {
          success: false,
          message: 'Payment not found',
          status: 'pending'
        };
      }
    } catch (error: any) {
      console.error('ZenoPay status check error:', error.message);

      return {
        success: false,
        message: error.message || 'Failed to check payment status',
        error: 'ZENOPAY_STATUS_ERROR'
      };
    }
  }

  private async updatePaymentStatus(orderId: string, status: string): Promise<void> {
    try {
      // Find payment by reference_number (which should contain the orderId for mobile payments)
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('reference_number', orderId);

      if (payments && payments.length > 0) {
        const payment = payments[0];

        // Update payment status
        await supabase
          .from('payments')
          .update({ status })
          .eq('id', payment.id);

        // If payment is completed, update invoice
        if (status === 'completed') {
          await this.updateInvoiceAfterPayment(payment.invoice_id, payment.amount);
        }
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  }

  private async updateInvoiceAfterPayment(invoiceId: string, amount: number): Promise<void> {
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('paid_amount, total_amount, patient_id')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const newPaidAmount = Number(invoice.paid_amount) + amount;
        const totalAmount = Number(invoice.total_amount);
        const newStatus = newPaidAmount >= totalAmount ? 'Paid' : newPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

        await supabase
          .from('invoices')
          .update({ paid_amount: newPaidAmount, status: newStatus })
          .eq('id', invoiceId);

        // If fully paid, complete the workflow
        if (newStatus === 'Paid') {
          const { data: visits } = await supabase
            .from('patient_visits')
            .select('*')
            .eq('patient_id', invoice.patient_id)
            .eq('current_stage', 'billing')
            .eq('overall_status', 'Active')
            .order('created_at', { ascending: false })
            .limit(1);

          if (visits && visits.length > 0) {
            await supabase
              .from('patient_visits')
              .update({
                billing_status: 'Paid',
                billing_completed_at: new Date().toISOString(),
                current_stage: 'completed',
                overall_status: 'Completed'
              })
              .eq('id', visits[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error updating invoice after payment:', error);
    }
  }

  async handlePaymentWebhook(webhookData: PaymentWebhookData): Promise<boolean> {
    try {
      console.log('ZenoPay webhook received:', webhookData);

      // Here you would typically:
      // 1. Verify the webhook is from ZenoPay (check x-api-key header)
      // 2. Update payment status in database
      // 3. Update invoice status
      // 4. Send confirmation notifications

      // For now, we'll simulate the webhook processing
      return true;
    } catch (error) {
      console.error('ZenoPay webhook processing error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mobilePaymentService = new ZenoPayService();
