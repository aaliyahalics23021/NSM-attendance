"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeVerifyOtp = exports.employeeRequestOtp = exports.adminLogin = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../services/db"));
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_attendx_key_987654321_!';
// Admin Login (Email & Password)
const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const user = await db_1.default.user.findUnique({
            where: { email },
            include: { company: true }
        });
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }
        if (!user.passwordHash) {
            return res.status(401).json({ message: 'Password not set for this account' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            phone: null,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company.name
        }, JWT_SECRET, { expiresIn: '30d' });
        // Create audit log
        await db_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: 'ADMIN_LOGIN',
                details: `Admin ${user.email} logged in successfully`,
                ipAddress: req.ip || 'unknown'
            }
        });
        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
                companyName: user.company.name
            }
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.adminLogin = adminLogin;
// Employee Request OTP (One-time Login initiation)
const employeeRequestOtp = async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required' });
    }
    try {
        const user = await db_1.default.user.findFirst({
            where: { phone, role: 'EMPLOYEE' },
            include: { employee: true }
        });
        if (!user || !user.employee) {
            return res.status(404).json({ message: 'Employee with this phone number not found' });
        }
        if (!user.employee.active) {
            return res.status(403).json({ message: 'This employee account is deactivated' });
        }
        // Generate a 6 digit mock OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
        await db_1.default.user.update({
            where: { id: user.id },
            data: {
                otpCode,
                otpExpiresAt
            }
        });
        // In a real application, you would send this OTP via SMS (Twilio, Firebase etc.)
        // For development, we return it in the response so the user can easily log in.
        return res.json({
            message: 'OTP sent successfully (Development Mode)',
            otpCode, // Returned for testing purposes
            expiresAt: otpExpiresAt
        });
    }
    catch (error) {
        console.error('Request OTP error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.employeeRequestOtp = employeeRequestOtp;
// Employee Verify OTP
const employeeVerifyOtp = async (req, res) => {
    const { phone, otpCode } = req.body;
    if (!phone || !otpCode) {
        return res.status(400).json({ message: 'Phone number and OTP code are required' });
    }
    try {
        const user = await db_1.default.user.findFirst({
            where: { phone, role: 'EMPLOYEE' },
            include: { employee: true, company: true }
        });
        if (!user || !user.employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (!user.employee.active) {
            return res.status(403).json({ message: 'Employee account deactivated' });
        }
        // Support a master OTP '123456' for easier developer testing
        const isValidOtp = (user.otpCode === otpCode && user.otpExpiresAt && user.otpExpiresAt > new Date()) ||
            otpCode === '123456';
        if (!isValidOtp) {
            return res.status(401).json({ message: 'Invalid or expired OTP' });
        }
        // Clear the OTP
        await db_1.default.user.update({
            where: { id: user.id },
            data: {
                otpCode: null,
                otpExpiresAt: null
            }
        });
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: null,
            phone: user.phone,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company.name,
            employeeId: user.employee.id
        }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({
            token,
            user: {
                id: user.id,
                phone: user.phone,
                role: user.role,
                companyId: user.companyId,
                companyName: user.company.name,
                employeeId: user.employee.id,
                employeeName: `${user.employee.firstName} ${user.employee.lastName}`
            }
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.employeeVerifyOtp = employeeVerifyOtp;
