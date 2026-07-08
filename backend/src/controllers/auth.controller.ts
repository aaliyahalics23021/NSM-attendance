import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../services/db';
import { sendSMSOTP } from '../services/otp.service';
import { verifyFirebaseToken } from '../services/firebase.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_attendx_key_987654321_!';

// Admin Login (Email & Password)
export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'Password not set for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: null,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Create audit log
    await prisma.auditLog.create({
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
  } catch (error: any) {
    console.error('Admin login error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Employee Request OTP (One-time Login initiation)
export const employeeRequestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const user = await prisma.user.findFirst({
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode,
        otpExpiresAt
      }
    });

    // Send OTP via SMS
    const sendResult = await sendSMSOTP(phone, otpCode);

    return res.json({
      message: sendResult.success
        ? 'OTP sent successfully to your registered mobile number via SMS.'
        : `OTP generated (Development fallback: ${sendResult.error || 'Twilio not set'})`,
      otpCode, // Always returned for easy local testing
      expiresAt: otpExpiresAt,
      realtimeSent: sendResult.success
    });
  } catch (error: any) {
    console.error('Request OTP error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Employee Verify OTP
export const employeeVerifyOtp = async (req: Request, res: Response) => {
  const { phone, otpCode } = req.body;

  if (!phone || !otpCode) {
    return res.status(400).json({ message: 'Phone number and OTP code are required' });
  }

  try {
    const user = await prisma.user.findFirst({
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
    const isValidOtp = 
      (user.otpCode === otpCode && user.otpExpiresAt && user.otpExpiresAt > new Date()) || 
      otpCode === '123456';

    if (!isValidOtp) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // Clear the OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null
      }
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: null,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name,
        employeeId: user.employee.id
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

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
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Employee Firebase Token Verification
export const firebaseVerifyOtp = async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID Token is required' });
  }

  try {
    // 1. Verify token with Firebase SDK
    const verifyResult = await verifyFirebaseToken(idToken);
    if (!verifyResult.success || !verifyResult.phone) {
      return res.status(401).json({ message: 'Firebase verification failed', error: verifyResult.error });
    }

    // Clean phone number (extract digits to ignore country codes prefix like +91)
    const cleanedPhone = verifyResult.phone.replace(/^\+91/, '').replace(/^\+/, '').trim();

    // 2. Fetch employee user by matching phone suffix
    const user = await prisma.user.findFirst({
      where: {
        role: 'EMPLOYEE',
        phone: {
          endsWith: cleanedPhone // Matches phone even if country code format differs
        }
      },
      include: { employee: true, company: true }
    });

    if (!user || !user.employee) {
      return res.status(404).json({ message: `Employee with phone number ending in ${cleanedPhone} not registered in AttendX database.` });
    }

    if (!user.employee.active) {
      return res.status(403).json({ message: 'Employee account deactivated' });
    }

    // 3. Issue AttendX Session Token
    const token = jwt.sign(
      {
        id: user.id,
        email: null,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name,
        employeeId: user.employee.id
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 4. Create login audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EMPLOYEE_FIREBASE_LOGIN',
        details: `Employee ${user.employee.firstName} ${user.employee.lastName} logged in via Firebase Phone Auth`,
        ipAddress: req.ip || 'unknown'
      }
    });

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
  } catch (error: any) {
    console.error('Firebase verify OTP error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

