"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const holiday_controller_1 = require("../controllers/holiday.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Both Admin & Employees can view the holiday list
router.get('/', holiday_controller_1.listHolidays);
// Admin-only management endpoints
router.post('/', (0, auth_middleware_1.requireRole)(['ADMIN']), holiday_controller_1.addHoliday);
router.delete('/:id', (0, auth_middleware_1.requireRole)(['ADMIN']), holiday_controller_1.deleteHoliday);
exports.default = router;
