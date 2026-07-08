"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDepartment = exports.listDepartments = exports.createShift = exports.listShifts = exports.getNotifications = exports.getAuditLogs = exports.updateSettings = exports.getSettings = exports.getDashboardStats = void 0;
const db_1 = __importDefault(require("../services/db"));
// 1. Admin: Fetch Dashboard Statistics & Graphs
const getDashboardStats = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // A. Fetch all active employees
        const activeEmployeesCount = await db_1.default.employee.count({
            where: {
                user: { companyId },
                active: true
            }
        });
        // B. Fetch today's attendance records
        const todayAttendance = await db_1.default.attendance.findMany({
            where: {
                employee: {
                    user: { companyId }
                },
                date: today
            }
        });
        const presentCount = todayAttendance.filter((a) => ['PRESENT', 'LATE', 'HALFDAY'].includes(a.status)).length;
        const lateCount = todayAttendance.filter((a) => a.status === 'LATE').length;
        const halfDayCount = todayAttendance.filter((a) => a.status === 'HALFDAY').length;
        const onLeaveCount = todayAttendance.filter((a) => a.status === 'ON_LEAVE').length;
        const holidayCount = todayAttendance.filter((a) => a.status === 'HOLIDAY').length;
        // Explicit absent is absentCount + anyone who hasn't punched at all (and isn't on holiday/leave)
        const punchedIds = todayAttendance.map((a) => a.employeeId);
        const absentCount = activeEmployeesCount - presentCount - onLeaveCount - holidayCount;
        // C. Overtime hours today
        const overtimeHoursToday = todayAttendance.reduce((sum, a) => sum + a.overtimeHours, 0);
        // D. Fetch total payroll (latest month aggregate)
        const payrollAgg = await db_1.default.payroll.aggregate({
            where: {
                employee: {
                    user: { companyId }
                }
            },
            _sum: {
                netSalary: true
            }
        });
        // E. Attendance Trend (Last 7 days percentage)
        const trendDays = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            trendDays.push(d);
        }
        const trendRecords = await db_1.default.attendance.findMany({
            where: {
                employee: {
                    user: { companyId }
                },
                date: {
                    in: trendDays
                }
            }
        });
        const trendData = trendDays.map((day) => {
            const dayRecs = trendRecords.filter((r) => r.date.getTime() === day.getTime());
            const dayPresents = dayRecs.filter((r) => ['PRESENT', 'LATE', 'HALFDAY'].includes(r.status)).length;
            const pct = activeEmployeesCount > 0 ? Math.round((dayPresents / activeEmployeesCount) * 100) : 0;
            return {
                date: day.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
                presentRate: pct
            };
        });
        // F. Department Wise Attendance
        const departments = await db_1.default.department.findMany({
            where: { companyId },
            include: {
                employees: {
                    where: { active: true },
                    select: { id: true }
                }
            }
        });
        const deptAttendance = departments.map((dept) => {
            const empIds = dept.employees.map((e) => e.id);
            const deptPresents = todayAttendance.filter((a) => empIds.includes(a.employeeId) && ['PRESENT', 'LATE', 'HALFDAY'].includes(a.status)).length;
            return {
                departmentName: dept.name,
                total: dept.employees.length,
                present: deptPresents
            };
        });
        return res.json({
            cards: {
                totalEmployees: activeEmployeesCount,
                presentToday: presentCount,
                absentToday: Math.max(0, absentCount),
                lateToday: lateCount,
                halfDayToday: halfDayCount,
                onLeaveToday: onLeaveCount,
                holidaysToday: holidayCount,
                overtimeHoursToday: parseFloat(overtimeHoursToday.toFixed(1)),
                totalPayrollExpenses: Math.round(payrollAgg._sum.netSalary || 0)
            },
            graphs: {
                attendanceTrend: trendData,
                departmentWise: deptAttendance
            }
        });
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getDashboardStats = getDashboardStats;
// 2. Admin: Get Company Settings
const getSettings = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const settings = await db_1.default.company.findUnique({
            where: { id: companyId }
        });
        return res.json(settings);
    }
    catch (error) {
        console.error('Get settings error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getSettings = getSettings;
// 3. Admin: Update Company Settings (configurable Radius, Coordinates, Name, Timezones)
const updateSettings = async (req, res) => {
    const companyId = req.user?.companyId;
    const { name, address, latitude, longitude, allowedRadius, timezone, currency } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const updated = await db_1.default.company.update({
            where: { id: companyId },
            data: {
                name: name || undefined,
                address: address || undefined,
                latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
                longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
                allowedRadius: allowedRadius !== undefined ? parseFloat(allowedRadius) : undefined,
                timezone: timezone || undefined,
                currency: currency || undefined
            }
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'COMPANY_SETTINGS_UPDATE',
                details: `Updated general settings for company '${updated.name}'`
            }
        });
        return res.json({ message: 'Company settings updated successfully', settings: updated });
    }
    catch (error) {
        console.error('Update settings error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.updateSettings = updateSettings;
// 4. Admin: Get System Audit Logs
const getAuditLogs = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const logs = await db_1.default.auditLog.findMany({
            where: {
                user: { companyId }
            },
            include: {
                user: { select: { email: true, phone: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 100 // last 100 logs
        });
        return res.json(logs);
    }
    catch (error) {
        console.error('Get audit logs error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getAuditLogs = getAuditLogs;
// 5. Both Admin & Employee: Fetch Notifications list
const getNotifications = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(403).json({ message: 'User ID is missing' });
    }
    try {
        const notifications = await db_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return res.json(notifications);
    }
    catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getNotifications = getNotifications;
// 6. Admin & Employee: Get Shifts list
const listShifts = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const shifts = await db_1.default.shift.findMany({
            where: { companyId }
        });
        return res.json(shifts);
    }
    catch (error) {
        console.error('List shifts error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.listShifts = listShifts;
// 7. Admin: Create Shift rule
const createShift = async (req, res) => {
    const companyId = req.user?.companyId;
    const { name, startTime, endTime, gracePeriod, lateAfter, halfDayAfter, absentAfter, overtimeAfter } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!name || !startTime || !endTime) {
        return res.status(400).json({ message: 'Name, Start Time and End Time are required' });
    }
    try {
        const shift = await db_1.default.shift.create({
            data: {
                name,
                startTime,
                endTime,
                gracePeriod: gracePeriod !== undefined ? parseInt(gracePeriod) : 15,
                lateAfter: lateAfter !== undefined ? parseInt(lateAfter) : 30,
                halfDayAfter: halfDayAfter !== undefined ? parseInt(halfDayAfter) : 120,
                absentAfter: absentAfter !== undefined ? parseInt(absentAfter) : 240,
                overtimeAfter: overtimeAfter !== undefined ? parseFloat(overtimeAfter) : 9.0,
                companyId
            }
        });
        return res.json({ message: 'Shift configuration created successfully', shift });
    }
    catch (error) {
        console.error('Create shift error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.createShift = createShift;
// 8. Admin & Employee: Get Departments list
const listDepartments = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const departments = await db_1.default.department.findMany({
            where: { companyId }
        });
        return res.json(departments);
    }
    catch (error) {
        console.error('List departments error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.listDepartments = listDepartments;
// 9. Admin: Create Department
const createDepartment = async (req, res) => {
    const companyId = req.user?.companyId;
    const { name } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!name) {
        return res.status(400).json({ message: 'Department name is required' });
    }
    try {
        const department = await db_1.default.department.create({
            data: {
                name,
                companyId
            }
        });
        return res.json({ message: 'Department created successfully', department });
    }
    catch (error) {
        console.error('Create department error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.createDepartment = createDepartment;
