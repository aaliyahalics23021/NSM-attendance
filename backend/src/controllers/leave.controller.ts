import { Response } from 'express';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../types';

// 1. Employee: Apply for Leave
export const applyLeave = async (req: AuthenticatedRequest, res: Response) => {
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
    const employee = await prisma.employee.findUnique({
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

    const leaveRequest = await prisma.leave.create({
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
    await prisma.notification.create({
      data: {
        userId: req.user!.id, // in a real app, create for admins, but for now we create it for the audit track
        title: 'Leave Applied',
        message: `${employee.firstName} applied for ${leaveDays} day(s) of ${leaveType} leave`,
        type: 'INFO'
      }
    });

    return res.json({
      message: 'Leave application submitted successfully',
      leave: leaveRequest
    });
  } catch (error: any) {
    console.error('Apply leave error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// 2. Employee: Get personal leave list
export const getEmployeeLeaves = async (req: AuthenticatedRequest, res: Response) => {
  const employeeId = req.user?.employeeId;

  if (!employeeId) {
    return res.status(403).json({ message: 'Employee ID is missing' });
  }

  try {
    const leaves = await prisma.leave.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' }
    });
    return res.json(leaves);
  } catch (error: any) {
    console.error('Get employee leaves error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// 3. Admin: Get all leaves for company
export const getAdminLeaves = async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(403).json({ message: 'Company ID is missing' });
  }

  try {
    const leaves = await prisma.leave.findMany({
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
  } catch (error: any) {
    console.error('Get admin leaves error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// 4. Admin: Approve or Reject leave
export const updateLeaveStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { leaveId, status, adminNotes } = req.body;
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(403).json({ message: 'Admin context missing' });
  }

  if (!leaveId || !status || !['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Valid leave ID and status (APPROVED/REJECTED) are required' });
  }

  try {
    const leave = await prisma.leave.findUnique({
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
    const updatedLeave = await prisma.$transaction(async (tx) => {
      const updated = await tx.leave.update({
        where: { id: leaveId },
        data: { status, adminNotes }
      });

      if (status === 'APPROVED') {
        let updateData = {};
        if (leave.leaveType === 'CASUAL') {
          updateData = { leaveBalanceCasual: { decrement: leaveDays } };
        } else if (leave.leaveType === 'SICK') {
          updateData = { leaveBalanceSick: { decrement: leaveDays } };
        } else if (leave.leaveType === 'PAID') {
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
          attendanceDate.setHours(0,0,0,0);
          
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
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'LEAVE_RESOLVE',
        details: `Leave ID ${leaveId} resolved as ${status}. Admin notes: ${adminNotes || 'None'}`
      }
    });

    // Notify employee
    await prisma.notification.create({
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
  } catch (error: any) {
    console.error('Update leave status error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
