"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.resetFaceEnrollment = exports.deleteEmployee = exports.editEmployee = exports.createEmployee = exports.listEmployees = void 0;
const db_1 = __importDefault(require("../services/db"));
// 1. Admin: List All Employees (with search & filter)
const listEmployees = async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Company ID is missing' });
    }
    try {
        const employees = await db_1.default.employee.findMany({
            where: {
                user: { companyId }
            },
            include: {
                department: { select: { name: true } },
                shift: { select: { name: true, startTime: true, endTime: true } },
                user: { select: { phone: true, email: true } },
                faceEmbeddings: { select: { id: true } }
            },
            orderBy: { firstName: 'asc' }
        });
        return res.json(employees);
    }
    catch (error) {
        console.error('List employees error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.listEmployees = listEmployees;
// 2. Admin: Create New Employee User and Profile
const createEmployee = async (req, res) => {
    const companyId = req.user?.companyId;
    const { employeeId, firstName, lastName, phone, email, departmentId, shiftId, basicSalary } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    if (!employeeId || !firstName || !lastName || !phone || !departmentId || !shiftId) {
        return res.status(400).json({ message: 'All standard profile inputs are required' });
    }
    try {
        // Check if phone already registered
        const existingPhone = await db_1.default.user.findFirst({
            where: { phone, role: 'EMPLOYEE' }
        });
        if (existingPhone) {
            return res.status(400).json({ message: 'Phone number already registered to another employee' });
        }
        // Check if employeeId unique
        const existingEmpId = await db_1.default.employee.findUnique({
            where: { employeeId }
        });
        if (existingEmpId) {
            return res.status(400).json({ message: 'Employee ID already exists' });
        }
        // Create the User (Employee role has no default password, they login via phone OTP)
        const newEmployee = await db_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    phone,
                    email: email || null,
                    role: 'EMPLOYEE',
                    companyId
                }
            });
            const profile = await tx.employee.create({
                data: {
                    userId: user.id,
                    employeeId,
                    firstName,
                    lastName,
                    departmentId,
                    shiftId,
                    basicSalary: basicSalary ? parseFloat(basicSalary) : 0.0
                }
            });
            return profile;
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'EMPLOYEE_CREATE',
                details: `Created employee profile for ${firstName} ${lastName} (${employeeId})`
            }
        });
        return res.json({ message: 'Employee created successfully', employee: newEmployee });
    }
    catch (error) {
        console.error('Create employee error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.createEmployee = createEmployee;
// 3. Admin: Edit Employee Profile
const editEmployee = async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    const { firstName, lastName, phone, email, departmentId, shiftId, basicSalary, active } = req.body;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const employee = await db_1.default.employee.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!employee || employee.user.companyId !== companyId) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }
        // Check unique phone if it has changed
        if (phone && phone !== employee.user.phone) {
            const existingPhone = await db_1.default.user.findFirst({
                where: { phone, role: 'EMPLOYEE' }
            });
            if (existingPhone) {
                return res.status(400).json({ message: 'Phone number already registered' });
            }
        }
        await db_1.default.$transaction(async (tx) => {
            // Update User fields
            await tx.user.update({
                where: { id: employee.userId },
                data: {
                    phone: phone !== undefined ? phone : undefined,
                    email: email !== undefined ? email : undefined
                }
            });
            // Update Employee fields
            await tx.employee.update({
                where: { id },
                data: {
                    firstName: firstName !== undefined ? firstName : undefined,
                    lastName: lastName !== undefined ? lastName : undefined,
                    departmentId: departmentId !== undefined ? departmentId : undefined,
                    shiftId: shiftId !== undefined ? shiftId : undefined,
                    basicSalary: basicSalary !== undefined ? parseFloat(basicSalary) : undefined,
                    active: active !== undefined ? !!active : undefined
                }
            });
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'EMPLOYEE_EDIT',
                details: `Edited employee profile ID ${id}`
            }
        });
        return res.json({ message: 'Employee profile updated successfully' });
    }
    catch (error) {
        console.error('Edit employee error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.editEmployee = editEmployee;
// 4. Admin: Delete Employee Profile
const deleteEmployee = async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const employee = await db_1.default.employee.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!employee || employee.user.companyId !== companyId) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        // Delete User record cascades and deletes employee, attendance, logs, etc.
        await db_1.default.user.delete({
            where: { id: employee.userId }
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'EMPLOYEE_DELETE',
                details: `Deleted employee profile for ${employee.firstName} ${employee.lastName} (${employee.employeeId})`
            }
        });
        return res.json({ message: 'Employee profile and associated data deleted' });
    }
    catch (error) {
        console.error('Delete employee error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.deleteEmployee = deleteEmployee;
// 5. Admin: Reset Face Registration
const resetFaceEnrollment = async (req, res) => {
    const { id } = req.params; // Employee ID
    const companyId = req.user?.companyId;
    if (!companyId) {
        return res.status(403).json({ message: 'Admin context missing' });
    }
    try {
        const employee = await db_1.default.employee.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!employee || employee.user.companyId !== companyId) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }
        await db_1.default.faceEmbedding.deleteMany({
            where: { employeeId: id }
        });
        // Notify employee of face data reset
        await db_1.default.notification.create({
            data: {
                userId: employee.userId,
                title: 'Biometrics Reset',
                message: 'Your facial biometrics have been reset by your Admin. Please enroll again on your next login.',
                type: 'ALERT'
            }
        });
        // Create Audit Log
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'FACE_RESET',
                details: `Reset facial biometrics data for employee ID ${id}`
            }
        });
        return res.json({ message: 'Facial registration has been reset successfully' });
    }
    catch (error) {
        console.error('Reset face registration error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.resetFaceEnrollment = resetFaceEnrollment;
// 6. Employee: Fetch personal profile details
const getProfile = async (req, res) => {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
        return res.status(403).json({ message: 'Employee context missing' });
    }
    try {
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId },
            include: {
                department: { select: { name: true } },
                shift: true,
                user: { select: { phone: true, email: true } }
            }
        });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        return res.json(employee);
    }
    catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getProfile = getProfile;
