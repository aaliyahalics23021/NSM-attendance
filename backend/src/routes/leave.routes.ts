import { Router } from 'express';
import { applyLeave, getEmployeeLeaves, getAdminLeaves, updateLeaveStatus } from '../controllers/leave.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Employee routes
router.post('/apply', requireRole(['EMPLOYEE']), applyLeave);
router.get('/employee-list', requireRole(['EMPLOYEE']), getEmployeeLeaves);

// Admin routes
router.get('/admin-list', requireRole(['ADMIN']), getAdminLeaves);
router.post('/resolve', requireRole(['ADMIN']), updateLeaveStatus);

export default router;
