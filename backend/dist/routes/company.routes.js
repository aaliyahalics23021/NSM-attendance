"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const company_controller_1 = require("../controllers/company.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Universal notifications endpoint
router.get('/notifications', company_controller_1.getNotifications);
// Shifts endpoints (Accessible to employees for info, admins for adjustments)
router.get('/shifts', company_controller_1.listShifts);
router.post('/shifts', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.createShift);
// Departments endpoints
router.get('/departments', company_controller_1.listDepartments);
router.post('/departments', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.createDepartment);
// Admin-only dashboard controls
router.get('/stats', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.getDashboardStats);
router.get('/settings', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.getSettings);
router.put('/settings', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.updateSettings);
router.get('/audit-logs', (0, auth_middleware_1.requireRole)(['ADMIN']), company_controller_1.getAuditLogs);
exports.default = router;
