export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          department_id: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          reason: string
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          department_id?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          reason: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          department_id?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      insurance_claims: {
        Row: {
          approval_date: string | null
          approved_amount: number | null
          claim_amount: number
          claim_number: string
          created_at: string
          id: string
          insurance_company_id: string
          invoice_id: string
          notes: string | null
          patient_id: string
          rejection_reason: string | null
          status: string | null
          submission_date: string
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          approved_amount?: number | null
          claim_amount: number
          claim_number: string
          created_at?: string
          id?: string
          insurance_company_id: string
          invoice_id: string
          notes?: string | null
          patient_id: string
          rejection_reason?: string | null
          status?: string | null
          submission_date?: string
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          approved_amount?: number | null
          claim_amount?: number
          claim_number?: string
          created_at?: string
          id?: string
          insurance_company_id?: string
          invoice_id?: string
          notes?: string | null
          patient_id?: string
          rejection_reason?: string | null
          status?: string | null
          submission_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          address: string | null
          contact_person: string | null
          coverage_percentage: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          coverage_percentage?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          coverage_percentage?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: string | null
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type?: string | null
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: string | null
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          discount: number | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number | null
          patient_id: string
          status: string | null
          tax: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number | null
          patient_id: string
          status?: string | null
          tax?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number | null
          patient_id?: string
          status?: string | null
          tax?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          abnormal_flag: boolean | null
          created_at: string
          id: string
          lab_test_id: string
          notes: string | null
          reference_range: string | null
          result_date: string
          result_value: string
          technician_id: string | null
          unit: string | null
        }
        Insert: {
          abnormal_flag?: boolean | null
          created_at?: string
          id?: string
          lab_test_id: string
          notes?: string | null
          reference_range?: string | null
          result_date?: string
          result_value: string
          technician_id?: string | null
          unit?: string | null
        }
        Update: {
          abnormal_flag?: boolean | null
          created_at?: string
          id?: string
          lab_test_id?: string
          notes?: string | null
          reference_range?: string | null
          result_date?: string
          result_value?: string
          technician_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          completed_date: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          ordered_by_doctor_id: string | null
          ordered_date: string
          patient_id: string
          priority: string | null
          status: string | null
          test_name: string
          test_type: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          ordered_by_doctor_id?: string | null
          ordered_date?: string
          patient_id: string
          priority?: string | null
          status?: string | null
          test_name: string
          test_type: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          ordered_by_doctor_id?: string | null
          ordered_date?: string
          patient_id?: string
          priority?: string | null
          status?: string | null
          test_name?: string
          test_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage_form: string
          expiry_date: string | null
          generic_name: string | null
          id: string
          manufacturer: string | null
          name: string
          quantity_in_stock: number
          reorder_level: number | null
          strength: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage_form: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          manufacturer?: string | null
          name: string
          quantity_in_stock?: number
          reorder_level?: number | null
          strength: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage_form?: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          manufacturer?: string | null
          name?: string
          quantity_in_stock?: number
          reorder_level?: number | null
          strength?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      patient_visits: {
        Row: {
          appointment_id: string | null
          billing_completed_at: string | null
          billing_notes: string | null
          billing_status: string | null
          created_at: string
          current_stage: string | null
          doctor_completed_at: string | null
          doctor_diagnosis: string | null
          doctor_notes: string | null
          doctor_status: string | null
          id: string
          lab_completed_at: string | null
          lab_notes: string | null
          lab_status: string | null
          nurse_completed_at: string | null
          nurse_notes: string | null
          nurse_status: string | null
          nurse_vitals: Json | null
          overall_status: string | null
          patient_id: string
          pharmacy_completed_at: string | null
          pharmacy_notes: string | null
          pharmacy_status: string | null
          reception_completed_at: string | null
          reception_notes: string | null
          reception_status: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          appointment_id?: string | null
          billing_completed_at?: string | null
          billing_notes?: string | null
          billing_status?: string | null
          created_at?: string
          current_stage?: string | null
          doctor_completed_at?: string | null
          doctor_diagnosis?: string | null
          doctor_notes?: string | null
          doctor_status?: string | null
          id?: string
          lab_completed_at?: string | null
          lab_notes?: string | null
          lab_status?: string | null
          nurse_completed_at?: string | null
          nurse_notes?: string | null
          nurse_status?: string | null
          nurse_vitals?: Json | null
          overall_status?: string | null
          patient_id: string
          pharmacy_completed_at?: string | null
          pharmacy_notes?: string | null
          pharmacy_status?: string | null
          reception_completed_at?: string | null
          reception_notes?: string | null
          reception_status?: string | null
          updated_at?: string
          visit_date?: string
        }
        Update: {
          appointment_id?: string | null
          billing_completed_at?: string | null
          billing_notes?: string | null
          billing_status?: string | null
          created_at?: string
          current_stage?: string | null
          doctor_completed_at?: string | null
          doctor_diagnosis?: string | null
          doctor_notes?: string | null
          doctor_status?: string | null
          id?: string
          lab_completed_at?: string | null
          lab_notes?: string | null
          lab_status?: string | null
          nurse_completed_at?: string | null
          nurse_notes?: string | null
          nurse_status?: string | null
          nurse_vitals?: Json | null
          overall_status?: string | null
          patient_id?: string
          pharmacy_completed_at?: string | null
          pharmacy_notes?: string | null
          pharmacy_status?: string | null
          reception_completed_at?: string | null
          reception_notes?: string | null
          reception_status?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          blood_group: string | null
          created_at: string
          current_medications: string | null
          date_of_birth: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          id: string
          insurance_company_id: string | null
          insurance_coverage_percentage: number | null
          insurance_policy_number: string | null
          medical_history: string | null
          phone: string
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          blood_group?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          id?: string
          insurance_company_id?: string | null
          insurance_coverage_percentage?: number | null
          insurance_policy_number?: string | null
          medical_history?: string | null
          phone: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          blood_group?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          insurance_company_id?: string | null
          insurance_coverage_percentage?: number | null
          insurance_policy_number?: string | null
          medical_history?: string | null
          phone?: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference_number: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          dispensed_by: string | null
          dispensed_date: string | null
          doctor_id: string
          dosage: string
          duration: string
          frequency: string
          id: string
          instructions: string | null
          medication_id: string | null
          medication_name: string
          patient_id: string
          prescribed_date: string
          quantity: number
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispensed_by?: string | null
          dispensed_date?: string | null
          doctor_id: string
          dosage: string
          duration: string
          frequency: string
          id?: string
          instructions?: string | null
          medication_id?: string | null
          medication_name: string
          patient_id: string
          prescribed_date?: string
          quantity: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispensed_by?: string | null
          dispensed_date?: string | null
          doctor_id?: string
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          instructions?: string | null
          medication_id?: string | null
          medication_name?: string
          patient_id?: string
          prescribed_date?: string
          quantity?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "doctor"
        | "nurse"
        | "receptionist"
        | "lab_tech"
        | "pharmacist"
        | "billing"
        | "patient"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "doctor",
        "nurse",
        "receptionist",
        "lab_tech",
        "pharmacist",
        "billing",
        "patient",
      ],
    },
  },
} as const
