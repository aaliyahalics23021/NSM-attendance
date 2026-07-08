"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaveStatus = exports.getAdminLeaves = exports.getEmployeeLeaves = exports.applyLeave = void 0;
const db_1 = __importDefault(require("../services/db"));
// 1. Employee: Apply for Leave
const applyLeave = async (req, res) => {
    const employeeId = req.user?.employeeId;
    const companyId = req.user?.companyId;
    const { leaveType, startDate, endDate, reason } = req.body;
    if (!employeeId || !companyId) {
        return res.status(403).json({ message: 'Employee context missing' });
    }
    if (!leaveType || !startDate || !endDate || !reason) {
        return res.status(400).json({ message: 'All leave details are required' });
    }
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            return res.status(400).json({ message: 'End date cannot be before start date' });
        }
        // Check employee leave balances if applicable (Casual, Sick, Paid)
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId }
        });
        if (!employee) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }
        // Estimate leave duration in days
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // Check balances
        if (leaveType === 'CASUAL' && employee.leaveBalanceCasual < leaveDays) {
            return res.status(400).json({ message: `Insufficient Casual leave balance. Available: ${employee.leaveBalanceCasual} days.` });
        }
        if (leaveType === 'SICK' && employee.leaveBalanceSick < leaveDays) {
            return res.status(400).json({ message: `Insufficient Sick leave balance. Available: ${employee.leaveBalanceSick} days.` });
        }
        if (leaveType === 'PAID' && employee.leaveBalancePaid < leaveDays) {
            return res.status(400).json({ message: `Insufficient Paid leave balance. Available: ${employee.leaveBalancePaid} days.` });
        }
        const leaveRequest = await db_1.default.leave.create({
            data: {
                employeeId,
                leaveType,
                startDate: start,
                endDate: end,
                reason,
                status: 'PENDING',
                companyId
            }
        });
        // Notify admins of new request
        await db_1.default.notification.create({
            data: {
                userId: req.user.id, // in a real app, create for admins, but for now we create it for the audit track
                title: 'Leave Applied',
                message: `${employee.firstName} applied for ${leaveDays} day(s) of ${leaveType} leave`,
                type: 'INFO'
            }
        });
        return res.json({
            message: 'Leave application submitted successfully',
            leave: leaveRequest
        });
    }
    catch (error) {
        console.error('Apply leave error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.applyLeave = applyLeave;
// 2. Employee: Get personal leave list
const getEmployeeLeaves = async (req, res) => {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
        return res.status(403).json({ message: 'Employee ID is missing' });
    }
    try {
        const leaves = await db_1.default.leave.findMany({
            where: { employeeId },
            orderBy: { startDate: 'desc' }
        });
        return res.json(leaves);
    }
    catch (error) {
        console.error('Get employee leaves error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getEmployeeLeaves = getEmployeeLeaves;
// 3. Admin: Get all leaves for company
const getAdminLeaves = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const leaves = await db_1.default.leave.findMany({
            where: { companyId },
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
            orderBy: { createdAt: 'desc' }
        });
        return res.json(leaves);
    }
    catch (error) {
        console.error('Get admin leaves error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getAdminLeaves = getAdminLeaves;
// 4. Admin: Approve or Reject leave
const updateLeaveStatus = async (req, res) => {
    const { leaveId, status, adminNotes } = req.body;
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!leaveId || !status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Valid leave ID and status (APPROVED/REJECTED) are required' });
    }
    try {
        const leave = await db_1.default.leave.findUnique({
            where: { id: leaveId },
            include: { employee: true }
        });
        if (!leave || leave.companyId !== companyId) {
            return res.status(404).json({ message: 'Leave request not found in this company' });
        }
        if (leave.status !== 'PENDING') {
            return res.status(400).json({ message: `Leave request has already been ${leave.status}` });
        }
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // Transaction to update status, and deduct leave balance if APPROVED
        const updatedLeave = await db_1.default.$transaction(async (tx) => {
            const updated = await tx.leave.update({
                where: { id: leaveId },
                data: { status, adminNotes }
            });
            if (status === 'APPROVED') {
                let updateData = {};
                if (leave.leaveType === 'CASUAL') {
                    updateData = { leaveBalanceCasual: { decrement: leaveDays } };
                }
                else if (leave.leaveType === 'SICK') {
                    updateData = { leaveBalanceSick: { decrement: leaveDays } };
                }
                else if (leave.leaveType === 'PAID') {
                    updateData = { leaveBalancePaid: { decrement: leaveDays } };
                }
                if (Object.keys(updateData).length > 0) {
                    await tx.employee.update({
                        where: { id: leave.employeeId },
                        data: updateData
                    });
                }
                // Also automatically insert/upsert "ON_LEAVE" attendance entries for approved leave dates
                // to prevent absent calculations and salary deductions.
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const attendanceDate = new Date(d);
                    attendanceDate.setHours(0, 0, 0, 0);
                    await tx.attendance.upsert({
                        where: {
                            employeeId_date: {
                                employeeId: leave.employeeId,
                                date: attendanceDate
                            }
                        },
                        update: {
                            status: 'ON_LEAVE',
                            verifiedGPS: true,
                            verifiedFace: true,
                            salaryEarnedToday: leave.leaveType === 'UNPAID' ? 0.0 : (leave.employee.basicSalary / 22) // Full pay for paid leaves, 0 for unpaid
                        },
                        create: {
                            employeeId: leave.employeeId,
                            date: attendanceDate,
                            status: 'ON_LEAVE',
                            verifiedGPS: true,
                            verifiedFace: true,
                            salaryEarnedToday: leave.leaveType === 'UNPAID' ? 0.0 : (leave.employee.basicSalary / 22)
                        }
                    });
                }
            }
            return updated;
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'LEAVE_RESOLVE',
                details: `Leave ID ${leaveId} resolved as ${status}. Admin notes: ${adminNotes || 'None'}`
            }
        });
        // Notify employee
        await db_1.default.notification.create({
            data: {
                userId: leave.employee.userId,
                title: `Leave ${status}`,
                message: `Your leave request for ${leave.leaveType} (${leaveDays} days) has been ${status.toLowerCase()}`,
                type: status === 'APPROVED' ? 'SUCCESS' : 'ALERT'
            }
        });
        return res.json({
            message: `Leave request has been successfully ${status.toLowerCase()}`,
            leave: updatedLeave
        });
    }
    catch (error) {
        console.error('Update leave status error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.updateLeaveStatus = updateLeaveStatus;
