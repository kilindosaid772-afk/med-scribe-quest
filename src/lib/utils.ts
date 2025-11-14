import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from '@/integrations/supabase/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateInvoiceNumber(): Promise<string> {
  try {
    // Use timestamp + random to ensure uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const uniqueId = `${timestamp}${random}`.slice(-6);
    
    // Query to check if this number exists
    const invoiceNumber = `INV-${uniqueId}`;
    
    const { data: existing } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('invoice_number', invoiceNumber)
      .single();
    
    // If exists, try again with different random
    if (existing) {
      const newRandom = Math.floor(Math.random() * 10000);
      return `INV-${timestamp}${newRandom}`.slice(-10);
    }
    
    return invoiceNumber;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback: use timestamp + random
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `INV-${timestamp}${random}`.slice(-10);
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