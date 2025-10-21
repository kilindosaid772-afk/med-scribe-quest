-- Sample data for testing billing dashboard payment functionality
-- Updated with proper UUID format for database IDs
-- Run these INSERT statements in your Supabase SQL editor or database

-- 1. First, insert sample patients
INSERT INTO patients (id, full_name, phone, insurance_company_id, insurance_policy_number, status, date_of_birth, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'John Doe', '+255712345678', NULL, NULL, 'Active', '1985-03-15', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'Jane Smith', '+255718765432', NULL, NULL, 'Active', '1990-07-22', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'Michael Johnson', '+255714567890', NULL, NULL, 'Active', '1978-11-08', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'Sarah Wilson', '+255719876543', NULL, NULL, 'Active', '1992-01-30', NOW(), NOW());

-- 2. Insert sample insurance companies
INSERT INTO insurance_companies (id, name, status, created_at, updated_at) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'AAR Insurance', 'Active', NOW(), NOW()),
('660e8400-e29b-41d4-a716-446655440002', 'Jubilee Insurance', 'Active', NOW(), NOW());

-- 3. Insert sample invoices with different statuses and amounts
INSERT INTO invoices (id, invoice_number, patient_id, total_amount, tax, paid_amount, status, due_date, invoice_date, notes, created_at, updated_at) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'INV-001', '550e8400-e29b-41d4-a716-446655440001', 150000.00, 15000.00, 0.00, 'Unpaid', '2024-11-15', '2024-10-15', 'Consultation and lab tests', NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440002', 'INV-002', '550e8400-e29b-41d4-a716-446655440002', 250000.00, 25000.00, 100000.00, 'Partially Paid', '2024-11-20', '2024-10-20', 'Surgery and medication', NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440003', 'INV-003', '550e8400-e29b-41d4-a716-446655440003', 80000.00, 8000.00, 88000.00, 'Paid', '2024-11-10', '2024-10-10', 'Routine checkup', NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440004', 'INV-004', '550e8400-e29b-41d4-a716-446655440004', 120000.00, 12000.00, 60000.00, 'Partially Paid', '2024-11-25', '2024-10-25', 'Emergency treatment', NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440005', 'INV-005', '550e8400-e29b-41d4-a716-446655440001', 95000.00, 9500.00, 0.00, 'Unpaid', '2024-12-01', '2024-11-01', 'Follow-up consultation', NOW(), NOW());

-- 4. Insert sample payments for testing
INSERT INTO payments (id, invoice_id, amount, payment_method, reference_number, status, notes, created_at) VALUES
('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440002', 50000.00, 'Cash', 'TXN123456789', 'completed', 'Partial payment via cash', NOW()),
('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 50000.00, 'Bank Transfer', 'TXN987654321', 'completed', 'Second partial payment', NOW()),
('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003', 88000.00, 'Cash', 'CASH001', 'completed', 'Full payment in cash', NOW()),
('880e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440004', 60000.00, 'Card', 'CARD567890', 'completed', 'Partial payment by card', NOW());

-- 5. Insert sample insurance claims
INSERT INTO insurance_claims (id, claim_number, patient_id, insurance_company_id, invoice_id, claim_amount, approved_amount, status, submission_date, notes, created_at, updated_at) VALUES
('990e8400-e29b-41d4-a716-446655440001', 'CLM-001', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 165000.00, 0.00, 'Pending', '2024-10-16', 'Initial claim submission', NOW(), NOW()),
('990e8400-e29b-41d4-a716-446655440002', 'CLM-002', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 275000.00, 200000.00, 'Approved', '2024-10-21', 'Approved with partial coverage', NOW(), NOW()),
('990e8400-e29b-41d4-a716-446655440003', 'CLM-003', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440004', 132000.00, 132000.00, 'Approved', '2024-10-26', 'Full coverage approved', NOW(), NOW());

-- 6. Insert sample patient visits (for workflow completion testing)
INSERT INTO patient_visits (id, patient_id, visit_date, current_stage, overall_status, billing_status, created_at, updated_at) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '2024-10-15', 'completed', 'Completed', NULL, NOW(), NOW()),
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '2024-10-20', 'completed', 'Completed', 'Paid', NOW(), NOW()),
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '2024-10-10', 'completed', 'Completed', 'Paid', NOW(), NOW()),
('aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', '2024-10-25', 'completed', 'Completed', NULL, NOW(), NOW()),
('aa0e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', '2024-11-01', 'billing', 'Active', NULL, NOW(), NOW());

-- 7. Insert sample invoice items for detailed invoice view
INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, created_at) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'General Consultation', 1, 50000.00, 50000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Blood Tests', 1, 30000.00, 30000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440001', 'X-Ray', 1, 70000.00, 70000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440002', 'Surgery', 1, 200000.00, 200000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440002', 'Medication', 5, 10000.00, 50000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440003', 'Routine Checkup', 1, 50000.00, 50000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440003', 'Vaccination', 2, 15000.00, 30000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440004', 'Emergency Treatment', 1, 80000.00, 80000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440004', 'Pain Medication', 3, 10000.00, 30000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440010', '770e8400-e29b-41d4-a716-446655440005', 'Follow-up Consultation', 1, 60000.00, 60000.00, NOW()),
('bb0e8400-e29b-41d4-a716-446655440011', '770e8400-e29b-41d4-a716-446655440005', 'Specialist Referral', 1, 30000.00, 30000.00, NOW());

-- Expected Results:
-- - Total Unpaid Invoices: 2 (inv-1 and inv-5)
-- - Total Partially Paid: 2 (inv-2 and inv-4)
-- - Total Paid: 1 (inv-3)
-- - Total Revenue: 228000.00 (from all completed payments)
-- - Pending Claims: 1 (claim-1)
