/**
 * ZenoPay Payment Gateway Integration
 * Documentation: https://zenopay.com/docs
 */

interface ZenoPayConfig {
  apiKey: string;
  merchantId: string;
  environment: 'sandbox' | 'production';
}

interface PaymentRequest {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  callbackUrl?: string;
  returnUrl?: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  reference?: string;
  message?: string;
  error?: string;
}

interface PaymentVerification {
  success: boolean;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  transactionId: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  message?: string;
}

class ZenoPayService {
  private config: ZenoPayConfig;
  private baseUrl: string;

  constructor(config: ZenoPayConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.zenopay.com/v1'
      : 'https://sandbox-api.zenopay.com/v1';
  }

  /**
   * Initialize a payment transaction
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency || 'USD',
          reference: request.reference,
          description: request.description,
          customer: {
            email: request.customerEmail,
            phone: request.customerPhone,
            name: request.customerName,
          },
          callback_url: request.callbackUrl,
          return_url: request.returnUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Payment initiation failed',
        };
      }

      return {
        success: true,
        transactionId: data.transaction_id,
        paymentUrl: data.payment_url,
        reference: data.reference,
        message: 'Payment initiated successfully',
      };
    } catch (error) {
      console.error('ZenoPay initiation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(reference: string): Promise<PaymentVerification> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          transactionId: '',
          reference,
          amount: 0,
          currency: 'USD',
          message: data.message || 'Verification failed',
        };
      }

      return {
        success: data.status === 'success',
        status: data.status,
        transactionId: data.transaction_id,
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        paidAt: data.paid_at,
        message: data.message,
      };
    } catch (error) {
      console.error('ZenoPay verification error:', error);
      return {
        success: false,
        status: 'failed',
        transactionId: '',
        reference,
        amount: 0,
        currency: 'USD',
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<PaymentVerification> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/status/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get payment status');
      }

      return {
        success: data.status === 'success',
        status: data.status,
        transactionId: data.transaction_id,
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        paidAt: data.paid_at,
        message: data.message,
      };
    } catch (error) {
      console.error('ZenoPay status check error:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          amount: amount, // Optional: partial refund
          reason: reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Refund failed',
        };
      }

      return {
        success: true,
        transactionId: data.refund_id,
        reference: data.reference,
        message: 'Refund processed successfully',
      };
    } catch (error) {
      console.error('ZenoPay refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

// Initialize ZenoPay service
const zenoPayConfig: ZenoPayConfig = {
  apiKey: import.meta.env.VITE_ZENOPAY_API_KEY || '',
  merchantId: import.meta.env.VITE_ZENOPAY_MERCHANT_ID || '',
  environment: import.meta.env.VITE_ZENOPAY_ENV === 'production' ? 'production' : 'sandbox',
};

export const zenoPay = new ZenoPayService(zenoPayConfig);

// Export types
export type { PaymentRequest, PaymentResponse, PaymentVerification, ZenoPayConfig };
