import { Router } from 'express';
import { adminLogin, employeeRequestOtp, employeeVerifyOtp, firebaseVerifyOtp } from '../controllers/auth.controller';

const router = Router();

// /api/auth/admin/login
router.post('/admin/login', adminLogin);

// /api/auth/employee/otp-request
router.post('/employee/otp-request', employeeRequestOtp);

// /api/auth/employee/otp-verify
router.post('/employee/otp-verify', employeeVerifyOtp);

// /api/auth/employee/firebase-verify
router.post('/employee/firebase-verify', firebaseVerifyOtp);

export default router;
