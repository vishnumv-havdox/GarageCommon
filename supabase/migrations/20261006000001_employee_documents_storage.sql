-- Configure storage policies for employee-documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated uploads to employee-documents'
    ) THEN
        CREATE POLICY "Allow authenticated uploads to employee-documents"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'employee-documents');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated read from employee-documents'
    ) THEN
        CREATE POLICY "Allow authenticated read from employee-documents"
        ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = 'employee-documents');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated delete from employee-documents'
    ) THEN
        CREATE POLICY "Allow authenticated delete from employee-documents"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'employee-documents');
    END IF;
END $$;
