import { Router } from 'express';
import { addHoliday, listHolidays, deleteHoliday } from '../controllers/holiday.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Both Admin & Employees can view the holiday list
router.get('/', listHolidays);

// Admin-only management endpoints
router.post('/', requireRole(['ADMIN']), addHoliday);
router.delete('/:id', requireRole(['ADMIN']), deleteHoliday);

export default router;
