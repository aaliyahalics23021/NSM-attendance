"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employee_controller_1 = require("../controllers/employee.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Employee-only route
router.get('/profile', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), employee_controller_1.getProfile);
// Admin-only management routes
router.get('/', (0, auth_middleware_1.requireRole)(['ADMIN']), employee_controller_1.listEmployees);
router.post('/', (0, auth_middleware_1.requireRole)(['ADMIN']), employee_controller_1.createEmployee);
router.put('/:id', (0, auth_middleware_1.requireRole)(['ADMIN']), employee_controller_1.editEmployee);
router.delete('/:id', (0, auth_middleware_1.requireRole)(['ADMIN']), employee_controller_1.deleteEmployee);
router.post('/:id/reset-face', (0, auth_middleware_1.requireRole)(['ADMIN']), employee_controller_1.resetFaceEnrollment);
exports.default = router;
