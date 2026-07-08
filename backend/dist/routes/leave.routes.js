"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leave_controller_1 = require("../controllers/leave.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Employee routes
router.post('/apply', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), leave_controller_1.applyLeave);
router.get('/employee-list', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), leave_controller_1.getEmployeeLeaves);
// Admin routes
router.get('/admin-list', (0, auth_middleware_1.requireRole)(['ADMIN']), leave_controller_1.getAdminLeaves);
router.post('/resolve', (0, auth_middleware_1.requireRole)(['ADMIN']), leave_controller_1.updateLeaveStatus);
exports.default = router;
