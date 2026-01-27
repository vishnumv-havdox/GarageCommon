-- Make description column nullable in work_orders table
ALTER TABLE work_orders ALTER COLUMN description DROP NOT NULL;
