"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteHoliday = exports.listHolidays = exports.addHoliday = void 0;
const db_1 = __importDefault(require("../services/db"));
// 1. Admin: Add Holiday
const addHoliday = async (req, res) => {
    const companyId = req.user?.companyId;
    const { name, date, type, recurring, description, departmentId } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!name || !date || !type) {
        return res.status(400).json({ message: 'Name, date and holiday type are required' });
    }
    try {
        const holidayDate = new Date(date);
        holidayDate.setHours(0, 0, 0, 0);
        const holiday = await db_1.default.$transaction(async (tx) => {
            // Create the holiday entry
            const newHoliday = await tx.holiday.create({
                data: {
                    name,
                    date: holidayDate,
                    type,
                    recurring: !!recurring,
                    description,
                    companyId,
                    departmentId: departmentId || null
                }
            });
            // Query employees who are subject to this holiday
            const employees = await tx.employee.findMany({
                where: {
                    user: { companyId },
                    active: true,
                    ...(departmentId ? { departmentId } : {}) // filter by department if specified
                }
            });
            // Upsert a HOLIDAY status attendance record for all affected employees
            // This prevents absent calculation and applies full daily pay rate automatically
            for (const employee of employees) {
                const dailyPayRate = employee.basicSalary / 22; // 22 working days average
                await tx.attendance.upsert({
                    where: {
                        employeeId_date: {
                            employeeId: employee.id,
                            date: holidayDate
                        }
                    },
                    update: {
                        status: 'HOLIDAY',
                        salaryEarnedToday: dailyPayRate,
                        verifiedGPS: true,
                        verifiedFace: true
                    },
                    create: {
                        employeeId: employee.id,
                        date: holidayDate,
                        status: 'HOLIDAY',
                        salaryEarnedToday: dailyPayRate,
                        verifiedGPS: true,
                        verifiedFace: true
                    }
                });
            }
            return newHoliday;
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'HOLIDAY_ADD',
                details: `Holiday '${name}' added for date ${holidayDate.toDateString()}`
            }
        });
        return res.json({
            message: 'Holiday added successfully and employee calendars updated',
            holiday
        });
    }
    catch (error) {
        console.error('Add holiday error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.addHoliday = addHoliday;
// 2. Both Admin & Employee: Get Holiday List
const listHolidays = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company context missing' });
    }
    try {
        const holidays = await db_1.default.holiday.findMany({
            where: { companyId },
            include: {
                department: { select: { name: true } }
            },
            orderBy: { date: 'asc' }
        });
        return res.json(holidays);
    }
    catch (error) {
        console.error('List holidays error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.listHolidays = listHolidays;
// 3. Admin: Delete Holiday
const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const holiday = await db_1.default.holiday.findUnique({
            where: { id }
        });
        if (!holiday || holiday.companyId !== companyId) {
            return res.status(404).json({ message: 'Holiday not found' });
        }
        await db_1.default.$transaction(async (tx) => {
            // Delete the holiday
            await tx.holiday.delete({ where: { id } });
            // Revert the attendance records for that day (delete them so that they fallback to ABSENT or can be re-punched)
            await tx.attendance.deleteMany({
                where: {
                    date: holiday.date,
                    status: 'HOLIDAY',
                    employee: {
                        user: { companyId }
                    }
                }
            });
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'HOLIDAY_DELETE',
                details: `Deleted holiday '${holiday.name}' for date ${holiday.date.toDateString()}`
            }
        });
        return res.json({ message: 'Holiday deleted and employee calendar records updated' });
    }
    catch (error) {
        console.error('Delete holiday error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.deleteHoliday = deleteHoliday;
