"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("../controllers/attendance.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Apply authentication to all attendance endpoints
router.use(auth_middleware_1.authenticate);
// Employee-only operations
router.post('/enroll-face', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), attendance_controller_1.enrollFace);
router.post('/punch-in', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), attendance_controller_1.punchIn);
router.post('/punch-out', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), attendance_controller_1.punchOut);
router.get('/today-status', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), attendance_controller_1.getTodayStatus);
router.get('/history', (0, auth_middleware_1.requireRole)(['EMPLOYEE']), attendance_controller_1.getHistory);
exports.default = router;
