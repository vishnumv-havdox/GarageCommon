-- Add HSN/SAC code columns to service_types and task_templates
ALTER TABLE IF EXISTS service_types 
ADD COLUMN IF NOT EXISTS hsn_code text,
ADD COLUMN IF NOT EXISTS sac_code text;

ALTER TABLE IF EXISTS task_templates 
ADD COLUMN IF NOT EXISTS hsn_code text,
ADD COLUMN IF NOT EXISTS sac_code text;

-- Comment on columns
COMMENT ON COLUMN service_types.hsn_code IS 'Harmonized System of Nomenclature code for goods';
COMMENT ON COLUMN service_types.sac_code IS 'Service Accounting Code for services';
COMMENT ON COLUMN task_templates.hsn_code IS 'HSN code override for specific tasks';
