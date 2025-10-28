import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from '@/integrations/supabase/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateInvoiceNumber(): Promise<string> {
  try {
    // Query the database to find the highest existing invoice number
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('invoice_number', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching invoice numbers:', error);
      throw new Error('Failed to generate invoice number');
    }

    let nextNumber = 1;

    if (invoices && invoices.length > 0) {
      const lastInvoiceNumber = invoices[0].invoice_number;

      // Extract the number part from INV-XXX format
      const match = lastInvoiceNumber.match(/^INV-(\d{3})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format as 3-digit number with leading zeros
    return `INV-${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback: generate based on timestamp if database query fails
    const timestamp = Date.now().toString().slice(-3);
    return `INV-${timestamp.padStart(3, '0')}`;
  }
}

export async function logActivity(action: string, details?: Record<string, any>) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    const payload: any = {
      action,
      details: details ? JSON.stringify(details) : null,
      user_id: userId,
      created_at: new Date().toISOString()
    };
    await supabase.from('activity_logs').insert(payload);
  } catch (error) {
    console.warn('Failed to log activity', action, error);
  }
}