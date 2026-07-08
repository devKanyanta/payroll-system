-- ============================================
-- Fix PPE eligibility: due-date-based rules
-- V13: Revert ELIGIBLE records to NOT_ELIGIBLE
--      when the due date has not yet passed
-- ============================================

-- Under the new rule, an employee is only ELIGIBLE
-- once their due date has passed. Existing records
-- that were approved before the rule change but have
-- future due dates are now inconsistent — change them
-- to NOT_ELIGIBLE.
UPDATE ppe_requests
SET status = 'NOT_ELIGIBLE',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'ELIGIBLE'
  AND due_date >= CURRENT_DATE;
