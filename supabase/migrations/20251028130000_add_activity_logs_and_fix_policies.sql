-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS: allow any authenticated user to insert logs (client-side logging)
DO $$ BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.activity_logs;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

CREATE POLICY "Authenticated can insert logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS: only admins can view logs
DO $$ BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Admins can view logs" ON public.activity_logs;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

CREATE POLICY "Admins can view logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Fix policies for medical_services to use public.has_role
DO $$ BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Medical staff can view services" ON public.medical_services;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN
    DROP POLICY IF EXISTS "Admins can manage services" ON public.medical_services;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

DO $$ BEGIN
  BEGIN
    CREATE POLICY "Medical staff can view services"
    ON public.medical_services FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'doctor'::public.app_role) OR
      public.has_role(auth.uid(), 'nurse'::public.app_role) OR
      public.has_role(auth.uid(), 'billing'::public.app_role)
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Admins can manage services"
    ON public.medical_services FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Fix policies for patient_services to use public.has_role
DO $$ BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Medical staff can view patient services" ON public.patient_services;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN
    DROP POLICY IF EXISTS "Patients can view their own services" ON public.patient_services;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN
    DROP POLICY IF EXISTS "Medical staff can manage patient services" ON public.patient_services;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

DO $$ BEGIN
  BEGIN
    CREATE POLICY "Medical staff can view patient services"
    ON public.patient_services FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'doctor'::public.app_role) OR
      public.has_role(auth.uid(), 'nurse'::public.app_role) OR
      public.has_role(auth.uid(), 'billing'::public.app_role)
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Patients can view their own services"
    ON public.patient_services FOR SELECT
    TO authenticated
    USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Medical staff can manage patient services"
    ON public.patient_services FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'doctor'::public.app_role) OR
      public.has_role(auth.uid(), 'nurse'::public.app_role) OR
      public.has_role(auth.uid(), 'billing'::public.app_role)
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'doctor'::public.app_role) OR
      public.has_role(auth.uid(), 'nurse'::public.app_role) OR
      public.has_role(auth.uid(), 'billing'::public.app_role)
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


