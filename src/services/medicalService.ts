import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/utils';

export interface MedicalService {
  id?: string;
  service_code: string;
  service_name: string;
  service_type: string;
  description?: string;
  base_price: number;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Create a new medical service
export const createMedicalService = async (service: Omit<MedicalService, 'id' | 'created_at' | 'updated_at'>, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('medical_services')
      .insert([service])
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity({
      user_id: userId,
      action: 'create',
      table_name: 'medical_services',
      record_id: data.id,
      details: `Created medical service: ${service.service_name}`
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error creating medical service:', error);
    return { data: null, error };
  }
};

// Get all medical services
export const getMedicalServices = async () => {
  try {
    const { data, error } = await supabase
      .from('medical_services')
      .select('*')
      .order('service_name', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching medical services:', error);
    return { data: null, error };
  }
};

// Get a single medical service by ID
export const getMedicalServiceById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('medical_services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching medical service:', error);
    return { data: null, error };
  }
};

// Update a medical service
export const updateMedicalService = async (id: string, updates: Partial<MedicalService>, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('medical_services')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity({
      user_id: userId,
      action: 'update',
      table_name: 'medical_services',
      record_id: id,
      details: `Updated medical service: ${updates.service_name || 'ID: ' + id}`
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error updating medical service:', error);
    return { data: null, error };
  }
};

// Delete a medical service
export const deleteMedicalService = async (id: string, userId: string) => {
  try {
    // First get the service name for logging
    const { data: service } = await getMedicalServiceById(id);
    
    const { error } = await supabase
      .from('medical_services')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log activity
    if (service) {
      await logActivity({
        user_id: userId,
        action: 'delete',
        table_name: 'medical_services',
        record_id: id,
        details: `Deleted medical service: ${service.service_name}`
      });
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting medical service:', error);
    return { error };
  }
};

// Toggle service active status
export const toggleServiceStatus = async (id: string, currentStatus: boolean, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('medical_services')
      .update({ 
        is_active: !currentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity({
      user_id: userId,
      action: 'update',
      table_name: 'medical_services',
      record_id: id,
      details: `${currentStatus ? 'Deactivated' : 'Activated'} medical service: ${data.service_name}`
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error toggling service status:', error);
    return { data: null, error };
  }
};
