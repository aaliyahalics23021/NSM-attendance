"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
// /api/auth/admin/login
router.post('/admin/login', auth_controller_1.adminLogin);
// /api/auth/employee/otp-request
router.post('/employee/otp-request', auth_controller_1.employeeRequestOtp);
// /api/auth/employee/otp-verify
router.post('/employee/otp-verify', auth_controller_1.employeeVerifyOtp);
exports.default = router;
