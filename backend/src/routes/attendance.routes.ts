import { Router } from 'express';
import { enrollFace, punchIn, punchOut, getTodayStatus, getHistory, getAdminAttendance } from '../controllers/attendance.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all attendance endpoints
router.use(authenticate);

// Employee-only operations
router.post('/enroll-face', requireRole(['EMPLOYEE']), enrollFace);
router.post('/punch-in', requireRole(['EMPLOYEE']), punchIn);
router.post('/punch-out', requireRole(['EMPLOYEE']), punchOut);
router.get('/today-status', requireRole(['EMPLOYEE']), getTodayStatus);
router.get('/history', requireRole(['EMPLOYEE']), getHistory);

// Admin-only operations
router.get('/admin-overview', requireRole(['ADMIN']), getAdminAttendance);

export default router;
