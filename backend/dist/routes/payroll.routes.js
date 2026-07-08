"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payroll_controller_1 = require("../controllers/payroll.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// List payroll slips (Employee personal slips, Admin gets company broad list)
router.get('/', payroll_controller_1.getPayroll);
// Admin-only operations
router.post('/generate', (0, auth_middleware_1.requireRole)(['ADMIN']), payroll_controller_1.generatePayroll);
router.post('/update-status', (0, auth_middleware_1.requireRole)(['ADMIN']), payroll_controller_1.updatePayrollStatus);
router.get('/rules', (0, auth_middleware_1.requireRole)(['ADMIN']), payroll_controller_1.getSalaryRules);
router.put('/rules', (0, auth_middleware_1.requireRole)(['ADMIN']), payroll_controller_1.updateSalaryRules);
exports.default = router;
