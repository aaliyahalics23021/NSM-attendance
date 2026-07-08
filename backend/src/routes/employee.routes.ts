import { Router } from 'express';
import { listEmployees, createEmployee, editEmployee, deleteEmployee, resetFaceEnrollment, getProfile } from '../controllers/employee.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Employee-only route
router.get('/profile', requireRole(['EMPLOYEE']), getProfile);

// Admin-only management routes
router.get('/', requireRole(['ADMIN']), listEmployees);
router.post('/', requireRole(['ADMIN']), createEmployee);
router.put('/:id', requireRole(['ADMIN']), editEmployee);
router.delete('/:id', requireRole(['ADMIN']), deleteEmployee);
router.post('/:id/reset-face', requireRole(['ADMIN']), resetFaceEnrollment);

export default router;
