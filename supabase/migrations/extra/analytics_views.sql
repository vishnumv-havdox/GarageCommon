-- Revenue Breakdown by Vehicle Category
CREATE OR REPLACE VIEW revenue_by_vehicle_category AS
SELECT 
    vc.name as category_name,
    COUNT(wos.id) as service_count,
    SUM(wos.billing_price) as total_revenue,
    AVG(wos.billing_price) as avg_price
FROM work_order_services wos
JOIN work_orders wo ON wos.work_order_id = wo.id
JOIN vehicles v ON wo.vehicle_id = v.id
JOIN vehicle_models vm ON v.model_id = vm.id
JOIN vehicle_types vt ON vm.vehicle_type_id = vt.id
JOIN vehicle_categories vc ON vt.category_id = vc.id
GROUP BY vc.name;

-- Pricing Deviation Analysis
CREATE OR REPLACE VIEW pricing_deviation_analysis AS
SELECT 
    st.name as service_name,
    COUNT(*) as total_count,
    SUM(CASE WHEN billing_price != calculated_price THEN 1 ELSE 0 END) as override_count,
    AVG(billing_price - calculated_price) as avg_deviation,
    SUM(billing_price - calculated_price) as total_deviation_revenue
FROM work_order_services wos
JOIN service_types st ON wos.service_name_id = st.id -- Assuming we have service_name_id or joining by name
GROUP BY st.name;
