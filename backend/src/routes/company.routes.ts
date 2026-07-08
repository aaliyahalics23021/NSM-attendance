import { Router } from 'express';
import {
  getDashboardStats,
  getSettings,
  updateSettings,
  getAuditLogs,
  getNotifications,
  listShifts,
  createShift,
  listDepartments,
  createDepartment
} from '../controllers/company.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Universal notifications endpoint
router.get('/notifications', getNotifications);

// Shifts endpoints (Accessible to employees for info, admins for adjustments)
router.get('/shifts', listShifts);
router.post('/shifts', requireRole(['ADMIN']), createShift);

// Departments endpoints
router.get('/departments', listDepartments);
router.post('/departments', requireRole(['ADMIN']), createDepartment);

// Admin-only dashboard controls
router.get('/stats', requireRole(['ADMIN']), getDashboardStats);
router.get('/settings', requireRole(['ADMIN']), getSettings);
router.put('/settings', requireRole(['ADMIN']), updateSettings);
router.get('/audit-logs', requireRole(['ADMIN']), getAuditLogs);

export default router;
