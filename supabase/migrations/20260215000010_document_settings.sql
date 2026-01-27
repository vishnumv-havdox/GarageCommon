-- =============================================================================
-- Migration: Document Configuration & Settings
-- Description: Adds tables for company profile and document configuration (Work Slip, Invoice)
-- =============================================================================

DO $$
BEGIN

    -- 1. Create Company Profiles Table
    CREATE TABLE IF NOT EXISTS public.company_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name text NOT NULL,
        address text,
        phone text,
        email text,
        website text,
        tax_id text, -- e.g., GSTIN
        logo_url text,
        bank_details jsonb, -- { bank_name, account_no, ifsc, branch }
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );

    -- 2. Create Document Settings Table
    CREATE TABLE IF NOT EXISTS public.document_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_type text NOT NULL UNIQUE CHECK (doc_type IN ('work_slip', 'invoice')),
        
        -- Numbering Format
        prefix text DEFAULT '',
        current_number integer DEFAULT 1,
        min_digits integer DEFAULT 4, -- e.g. 0001
        
        -- Customization Toggles
        show_rates boolean DEFAULT true,
        show_taxes boolean DEFAULT true,
        show_discounts boolean DEFAULT false,
        show_fc_details boolean DEFAULT true,
        show_service_history boolean DEFAULT false,
        
        -- Content
        title text, -- e.g. "Permit / Work Slip"
        terms_and_conditions text,
        footer_text text,
        
        updated_at timestamptz DEFAULT now()
    );

    -- 3. Enable RLS
    ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.document_settings ENABLE ROW LEVEL SECURITY;

    -- 4. Create Policies
    -- Company Profiles: Admin/Manager can manage, Staff can view (for generating docs)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Admins manage profiles') THEN
        CREATE POLICY "Admins manage profiles" ON public.company_profiles
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Staff view profiles') THEN
        CREATE POLICY "Staff view profiles" ON public.company_profiles
            FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff'))
            );
    END IF;

    -- Document Settings: Same as profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_settings' AND policyname = 'Admins manage settings') THEN
        CREATE POLICY "Admins manage settings" ON public.document_settings
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_settings' AND policyname = 'Staff view settings') THEN
        CREATE POLICY "Staff view settings" ON public.document_settings
            FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('staff'))
            );
    END IF;

    -- 5. Seed Initial Data
    INSERT INTO public.document_settings (doc_type, title, prefix, terms_and_conditions)
    VALUES 
    (
        'work_slip', 
        'WORK ORDER / ESTIMATE', 
        'WS-', 
        '1. Goods once sold will not be taken back.\n2. Service warranty valid for 30 days.\n3. Payment due immediately upon completion.'
    ),
    (
        'invoice', 
        'TAX INVOICE', 
        'INV-', 
        '1. Interest @ 18% p.a. will be charged if bill is not paid on due date.\n2. Subject to local jurisdiction.'
    )
    ON CONFLICT (doc_type) DO NOTHING;

    -- Insert placeholder company profile if empty
    IF NOT EXISTS (SELECT 1 FROM public.company_profiles) THEN
        INSERT INTO public.company_profiles (company_name, address, phone, email)
        VALUES ('Amma Auto Service', '123 Main St, Auto Nagar', '9876543210', 'service@ammaauto.com');
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
