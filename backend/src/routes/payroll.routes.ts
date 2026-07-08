import { Router } from 'express';
import { generatePayroll, getPayroll, updatePayrollStatus, getSalaryRules, updateSalaryRules } from '../controllers/payroll.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// List payroll slips (Employee personal slips, Admin gets company broad list)
router.get('/', getPayroll);

// Admin-only operations
router.post('/generate', requireRole(['ADMIN']), generatePayroll);
router.post('/update-status', requireRole(['ADMIN']), updatePayrollStatus);
router.get('/rules', requireRole(['ADMIN']), getSalaryRules);
router.put('/rules', requireRole(['ADMIN']), updateSalaryRules);

export default router;
