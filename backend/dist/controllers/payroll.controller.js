"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSalaryRules = exports.getSalaryRules = exports.updatePayrollStatus = exports.getPayroll = exports.generatePayroll = void 0;
const db_1 = __importDefault(require("../services/db"));
// 1. Admin: Generate Monthly Payroll for All Employees
const generatePayroll = async (req, res) => {
    const companyId = req.user?.companyId;
    const { month, year } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!month || !year || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Valid month (1-12) and year are required' });
    }
    try {
        // 1. Fetch Company Settings and Salary Rules
        const company = await db_1.default.company.findUnique({
            where: { id: companyId },
            include: { salaryRules: true }
        });
        if (!company || company.salaryRules.length === 0) {
            return res.status(404).json({ message: 'Salary rules for company not configured' });
        }
        const rules = company.salaryRules[0];
        // 2. Fetch all active employees in the company
        const employees = await db_1.default.employee.findMany({
            where: {
                user: { companyId },
                active: true
            }
        });
        const generatedPayrollRecords = [];
        // 3. Process each employee
        for (const employee of employees) {
            // Calculate date boundary for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            // Fetch all attendance records of the employee for the target month
            const attendanceRecords = await db_1.default.attendance.findMany({
                where: {
                    employeeId: employee.id,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });
            // Count statuses
            let presentCount = 0;
            let lateCount = 0;
            let halfDayCount = 0;
            let absentCount = 0;
            let holidayCount = 0;
            let leaveCount = 0;
            let totalOvertimeHours = 0.0;
            let totalLateMinutes = 0;
            let attendanceSalaryEarned = 0.0; // from daily updates
            attendanceRecords.forEach((record) => {
                totalOvertimeHours += record.overtimeHours;
                totalLateMinutes += record.lateMinutes;
                attendanceSalaryEarned += record.salaryEarnedToday;
                switch (record.status) {
                    case 'PRESENT':
                        presentCount++;
                        break;
                    case 'LATE':
                        lateCount++;
                        break;
                    case 'HALFDAY':
                        halfDayCount++;
                        break;
                    case 'ABSENT':
                        absentCount++;
                        break;
                    case 'HOLIDAY':
                        holidayCount++;
                        break;
                    case 'ON_LEAVE':
                        leaveCount++;
                        break;
                }
            });
            // Core Math variables
            const totalWorkingDays = 22; // default standard
            const dailyRate = employee.basicSalary / totalWorkingDays;
            const hourlyRate = dailyRate / 8; // assuming 8 hours shift
            // A. Additions
            const overtimePay = totalOvertimeHours * (hourlyRate * rules.overtimeMultiplier);
            const allowances = rules.bonusAmount; // general bonus
            // B. Deductions
            const latePenaltyDeduction = totalLateMinutes * rules.latePenaltyRate;
            const halfDayDeduction = halfDayCount * (dailyRate * rules.halfDayDeductionRate);
            // Determine absent days: Any days in the month that have no attendance record 
            // are counted as absent if they are weekdays, but let's keep it simple: 
            // count explicit ABSENT records + estimate days that should have been logged but weren't
            const explicitAbsentDeduction = absentCount * (dailyRate * rules.absentDeductionRate);
            // C. Social Benefits / Taxes
            const grossSalary = employee.basicSalary + overtimePay + allowances;
            const pfDeduction = grossSalary * rules.pfRate;
            const esiDeduction = grossSalary * rules.esiRate;
            const taxDeduction = grossSalary * rules.taxRate;
            const tdsDeduction = grossSalary * rules.tdsRate;
            // Unpaid leaves
            // Look up unpaid leaves specifically
            const unpaidLeaves = await db_1.default.leave.findMany({
                where: {
                    employeeId: employee.id,
                    leaveType: 'UNPAID',
                    status: 'APPROVED',
                    startDate: { gte: startDate },
                    endDate: { lte: endDate }
                }
            });
            let unpaidDays = 0;
            unpaidLeaves.forEach(l => {
                const diff = Math.abs(new Date(l.endDate).getTime() - new Date(l.startDate).getTime());
                unpaidDays += Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
            });
            const unpaidLeaveDeduction = unpaidDays * dailyRate;
            const totalDeductions = latePenaltyDeduction +
                halfDayDeduction +
                explicitAbsentDeduction +
                unpaidLeaveDeduction +
                pfDeduction +
                esiDeduction +
                taxDeduction +
                tdsDeduction;
            const netSalary = Math.max(0, grossSalary - totalDeductions);
            // Save to Database
            const payrollItem = await db_1.default.payroll.upsert({
                where: {
                    employeeId_month_year: {
                        employeeId: employee.id,
                        month,
                        year
                    }
                },
                update: {
                    basicSalary: employee.basicSalary,
                    overtimePay: parseFloat(overtimePay.toFixed(2)),
                    allowances: parseFloat(allowances.toFixed(2)),
                    latePenaltyDeduction: parseFloat(latePenaltyDeduction.toFixed(2)),
                    halfDayDeduction: parseFloat(halfDayDeduction.toFixed(2)),
                    absentDeduction: parseFloat(explicitAbsentDeduction.toFixed(2)),
                    unpaidLeaveDeduction: parseFloat(unpaidLeaveDeduction.toFixed(2)),
                    taxDeduction: parseFloat(taxDeduction.toFixed(2)),
                    pfDeduction: parseFloat(pfDeduction.toFixed(2)),
                    esiDeduction: parseFloat(esiDeduction.toFixed(2)),
                    netSalary: parseFloat(netSalary.toFixed(2)),
                    status: 'DRAFT'
                },
                create: {
                    employeeId: employee.id,
                    month,
                    year,
                    basicSalary: employee.basicSalary,
                    overtimePay: parseFloat(overtimePay.toFixed(2)),
                    allowances: parseFloat(allowances.toFixed(2)),
                    latePenaltyDeduction: parseFloat(latePenaltyDeduction.toFixed(2)),
                    halfDayDeduction: parseFloat(halfDayDeduction.toFixed(2)),
                    absentDeduction: parseFloat(explicitAbsentDeduction.toFixed(2)),
                    unpaidLeaveDeduction: parseFloat(unpaidLeaveDeduction.toFixed(2)),
                    taxDeduction: parseFloat(taxDeduction.toFixed(2)),
                    pfDeduction: parseFloat(pfDeduction.toFixed(2)),
                    esiDeduction: parseFloat(esiDeduction.toFixed(2)),
                    netSalary: parseFloat(netSalary.toFixed(2)),
                    status: 'DRAFT'
                }
            });
            generatedPayrollRecords.push({
                employeeName: `${employee.firstName} ${employee.lastName}`,
                employeeId: employee.employeeId,
                netSalary: payrollItem.netSalary
            });
        }
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'PAYROLL_GENERATE',
                details: `Generated payroll for Month: ${month}, Year: ${year}. Total slips: ${generatedPayrollRecords.length}`
            }
        });
        return res.json({
            message: 'Payroll generated successfully in DRAFT status',
            month,
            year,
            slipsCount: generatedPayrollRecords.length,
            records: generatedPayrollRecords
        });
    }
    catch (error) {
        console.error('Generate payroll error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.generatePayroll = generatePayroll;
// 2. Both Admin & Employee: Get Payroll Slips
const getPayroll = async (req, res) => {
    const companyId = req.user?.companyId;
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    try {
        if (role === 'EMPLOYEE') {
            if (!employeeId)
                return res.status(403).json({ message: 'Employee missing context' });
            const slips = await db_1.default.payroll.findMany({
                where: { employeeId },
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            });
            return res.json(slips);
        }
        else {
            // Admin gets all slips for the company
            const slips = await db_1.default.payroll.findMany({
                where: {
                    employee: {
                        user: { companyId }
                    }
                },
                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            department: { select: { name: true } }
                        }
                    }
                },
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            });
            return res.json(slips);
        }
    }
    catch (error) {
        console.error('Get payroll error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getPayroll = getPayroll;
// 3. Admin: Update Payroll status (Approve / Mark PAID)
const updatePayrollStatus = async (req, res) => {
    const { id, status } = req.body;
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!id || !status || !['DRAFT', 'APPROVED', 'PAID'].includes(status)) {
        return res.status(400).json({ message: 'Valid payroll ID and status are required' });
    }
    try {
        const slip = await db_1.default.payroll.findFirst({
            where: {
                id,
                employee: {
                    user: { companyId }
                }
            },
            include: { employee: true }
        });
        if (!slip) {
            return res.status(404).json({ message: 'Payroll slip not found' });
        }
        const updated = await db_1.default.payroll.update({
            where: { id },
            data: { status }
        });
        // Notify employee of payment
        await db_1.default.notification.create({
            data: {
                userId: slip.employee.userId,
                title: `Payslip ${status}`,
                message: `Your payroll for ${slip.month}/${slip.year} is now ${status.toLowerCase()}`,
                type: 'SUCCESS'
            }
        });
        return res.json({ message: `Payroll status updated to ${status}`, payroll: updated });
    }
    catch (error) {
        console.error('Update payroll status error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.updatePayrollStatus = updatePayrollStatus;
// 4. Admin: Get Salary Rules
const getSalaryRules = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const rules = await db_1.default.salaryRule.findUnique({
            where: { companyId }
        });
        return res.json(rules);
    }
    catch (error) {
        console.error('Get salary rules error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getSalaryRules = getSalaryRules;
// 5. Admin: Update Salary Rules
const updateSalaryRules = async (req, res) => {
    const companyId = req.user?.companyId;
    const updates = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const updated = await db_1.default.salaryRule.update({
            where: { companyId },
            data: {
                latePenaltyRate: updates.latePenaltyRate !== undefined ? parseFloat(updates.latePenaltyRate) : undefined,
                halfDayDeductionRate: updates.halfDayDeductionRate !== undefined ? parseFloat(updates.halfDayDeductionRate) : undefined,
                absentDeductionRate: updates.absentDeductionRate !== undefined ? parseFloat(updates.absentDeductionRate) : undefined,
                hourlyRate: updates.hourlyRate !== undefined ? parseFloat(updates.hourlyRate) : undefined,
                overtimeMultiplier: updates.overtimeMultiplier !== undefined ? parseFloat(updates.overtimeMultiplier) : undefined,
                pfRate: updates.pfRate !== undefined ? parseFloat(updates.pfRate) : undefined,
                esiRate: updates.esiRate !== undefined ? parseFloat(updates.esiRate) : undefined,
                taxRate: updates.taxRate !== undefined ? parseFloat(updates.taxRate) : undefined,
                tdsRate: updates.tdsRate !== undefined ? parseFloat(updates.tdsRate) : undefined,
                bonusAmount: updates.bonusAmount !== undefined ? parseFloat(updates.bonusAmount) : undefined
            }
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'SALARY_RULES_UPDATE',
                details: `Updated salary rules configuration for company: ${companyId}`
            }
        });
        return res.json({ message: 'Salary rules updated successfully', rules: updated });
    }
    catch (error) {
        console.error('Update salary rules error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.updateSalaryRules = updateSalaryRules;
