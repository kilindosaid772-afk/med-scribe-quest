import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addNotesColumn() {
  try {
    console.log('Adding notes column to prescriptions table...');

    // Add the notes column to prescriptions table
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;'
    });

    if (error) {
      console.error('Error adding notes column:', error);
      return;
    }

    console.log('Notes column added successfully!');

    // Create index for the notes column
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_prescriptions_notes ON public.prescriptions(notes) WHERE notes IS NOT NULL;'
    });

    if (indexError) {
      console.error('Error creating index:', indexError);
    } else {
      console.log('Index created successfully!');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addNotesColumn();
