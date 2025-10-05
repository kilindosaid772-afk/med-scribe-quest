-- Lab Tests Module
CREATE TABLE public.lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  ordered_by_doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent', 'STAT')),
  ordered_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_test_id UUID REFERENCES public.lab_tests(id) ON DELETE CASCADE NOT NULL,
  result_value TEXT NOT NULL,
  reference_range TEXT,
  unit TEXT,
  abnormal_flag BOOLEAN DEFAULT false,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Pharmacy Module
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  dosage_form TEXT NOT NULL,
  strength TEXT NOT NULL,
  quantity_in_stock INTEGER DEFAULT 0 NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  manufacturer TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  instructions TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Dispensed', 'Cancelled')),
  prescribed_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  dispensed_date TIMESTAMPTZ,
  dispensed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Billing Module
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Cancelled')),
  due_date DATE,
  invoice_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  item_type TEXT CHECK (item_type IN ('Consultation', 'Lab Test', 'Medication', 'Procedure', 'Other')),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'Card', 'Insurance', 'Bank Transfer', 'Other')),
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all new tables
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Lab Tests
CREATE POLICY "Medical staff can view all lab tests"
  ON public.lab_tests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'lab_tech')
  );

CREATE POLICY "Patients can view their own lab tests"
  ON public.lab_tests FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can order lab tests"
  ON public.lab_tests FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lab techs and admins can update lab tests"
  ON public.lab_tests FOR UPDATE
  USING (public.has_role(auth.uid(), 'lab_tech') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Lab Results
CREATE POLICY "Medical staff can view all lab results"
  ON public.lab_results FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'lab_tech')
  );

CREATE POLICY "Patients can view their own lab results"
  ON public.lab_results FOR SELECT
  USING (lab_test_id IN (
    SELECT id FROM public.lab_tests WHERE patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Lab techs can create results"
  ON public.lab_results FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'lab_tech') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Medications
CREATE POLICY "Medical staff can view medications"
  ON public.medications FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

CREATE POLICY "Pharmacists and admins can manage medications"
  ON public.medications FOR ALL
  USING (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Prescriptions
CREATE POLICY "Medical staff can view all prescriptions"
  ON public.prescriptions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist')
  );

CREATE POLICY "Patients can view their own prescriptions"
  ON public.prescriptions FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can create prescriptions"
  ON public.prescriptions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pharmacists can update prescriptions"
  ON public.prescriptions FOR UPDATE
  USING (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Invoices
CREATE POLICY "Billing staff can view all invoices"
  ON public.invoices FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Patients can view their own invoices"
  ON public.invoices FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Billing staff can manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Invoice Items
CREATE POLICY "Billing staff can view all invoice items"
  ON public.invoice_items FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Patients can view their own invoice items"
  ON public.invoice_items FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.invoices WHERE patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Billing staff can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Payments
CREATE POLICY "Billing staff can view all payments"
  ON public.payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Patients can view their own payments"
  ON public.payments FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.invoices WHERE patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Billing staff can manage payments"
  ON public.payments FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_lab_tests_patient_id ON public.lab_tests(patient_id);
CREATE INDEX idx_lab_tests_status ON public.lab_tests(status);
CREATE INDEX idx_lab_results_lab_test_id ON public.lab_results(lab_test_id);
CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_status ON public.prescriptions(status);
CREATE INDEX idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);

-- Insert sample medications
INSERT INTO public.medications (name, generic_name, dosage_form, strength, quantity_in_stock, unit_price) VALUES
  ('Paracetamol', 'Acetaminophen', 'Tablet', '500mg', 1000, 0.50),
  ('Amoxicillin', 'Amoxicillin', 'Capsule', '500mg', 500, 2.50),
  ('Ibuprofen', 'Ibuprofen', 'Tablet', '200mg', 800, 0.75),
  ('Metformin', 'Metformin', 'Tablet', '500mg', 600, 1.25),
  ('Lisinopril', 'Lisinopril', 'Tablet', '10mg', 400, 1.50);