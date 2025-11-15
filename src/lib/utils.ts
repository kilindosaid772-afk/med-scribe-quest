import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from '@/integrations/supabase/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateInvoiceNumber(): Promise<string> {
  const maxAttempts = 5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Generate unique invoice number with timestamp and random
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${timestamp}-${random}`;
      
      // Check if this number already exists
      const { data: existing, error: checkError } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine
        console.error('Error checking invoice number:', checkError);
        continue;
      }
      
      // If doesn't exist, use this number
      if (!existing) {
        return invoiceNumber;
      }
      
      // If exists, wait a tiny bit and try again
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.error('Error in invoice number generation attempt', attempt, error);
    }
  }
  
  // Final fallback with microseconds
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 100000);
  return `INV-${timestamp}-${random}`;
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