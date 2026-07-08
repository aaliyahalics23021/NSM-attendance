"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = exports.getTodayStatus = exports.punchOut = exports.punchIn = exports.enrollFace = void 0;
const db_1 = __importDefault(require("../services/db"));
const rules_service_1 = require("../services/rules.service");
// Helper: Get start and end of today in local date
const getTodayDateString = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};
// 1. Enroll Face Embeddings (Initial Login Setup)
const enrollFace = async (req, res) => {
    const { frontEmbedding, leftEmbedding, rightEmbedding } = req.body;
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
        return res.status(403).json({ message: 'Only employees can enroll face data' });
    }
    if (!frontEmbedding) {
        return res.status(400).json({ message: 'Front face embedding is required' });
    }
    try {
        const existing = await db_1.default.faceEmbedding.findFirst({
            where: { employeeId }
        });
        if (existing) {
            await db_1.default.faceEmbedding.update({
                where: { id: existing.id },
                data: {
                    frontEmbedding: JSON.stringify(frontEmbedding),
                    leftEmbedding: leftEmbedding ? JSON.stringify(leftEmbedding) : null,
                    rightEmbedding: rightEmbedding ? JSON.stringify(rightEmbedding) : null
                }
            });
        }
        else {
            await db_1.default.faceEmbedding.create({
                data: {
                    employeeId,
                    frontEmbedding: JSON.stringify(frontEmbedding),
                    leftEmbedding: leftEmbedding ? JSON.stringify(leftEmbedding) : null,
                    rightEmbedding: rightEmbedding ? JSON.stringify(rightEmbedding) : null
                }
            });
        }
        // Log action
        await db_1.default.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'FACE_ENROLLMENT',
                details: `Face embeddings enrolled for employee ${employeeId}`
            }
        });
        return res.json({ message: 'Face embeddings enrolled successfully' });
    }
    catch (error) {
        console.error('Face enrollment error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.enrollFace = enrollFace;
// 2. Punch In Endpoint
const punchIn = async (req, res) => {
    const employeeId = req.user?.employeeId;
    const companyId = req.user?.companyId;
    const { selfie, // base64 representation
    latitude, longitude, accuracy, address, faceEmbedding, // number[] representation of current selfie
    deviceId } = req.body;
    if (!employeeId || !companyId) {
        return res.status(403).json({ message: 'Employee context missing' });
    }
    try {
        const today = getTodayDateString();
        // Check if employee already punched in today
        const existingPunch = await db_1.default.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date: today
                }
            }
        });
        if (existingPunch && existingPunch.punchInTime) {
            return res.status(400).json({ message: 'Already punched in for today' });
        }
        // Fetch configurations
        const company = await db_1.default.company.findUnique({
            where: { id: companyId },
            include: { salaryRules: true }
        });
        if (!company) {
            return res.status(404).json({ message: 'Company settings not found' });
        }
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId },
            include: { shift: true }
        });
        if (!employee) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }
        // Default flags (assumes verified if setting is disabled)
        let verifiedGPS = true;
        let verifiedFace = true;
        let gpsRejectReason = '';
        let faceRejectReason = '';
        // A. Geofence Verification
        // Admin config check: We can assume rules are active by default
        const distance = (0, rules_service_1.calculateDistance)(latitude, longitude, company.latitude, company.longitude);
        const inRange = distance <= company.allowedRadius;
        // Log GPS check
        await db_1.default.gPSLog.create({
            data: {
                employeeId,
                latitude,
                longitude,
                accuracy: accuracy || 0,
                success: inRange,
                reason: inRange ? 'Within geofence' : `Distance ${Math.round(distance)}m exceeds radius ${company.allowedRadius}m`
            }
        });
        if (!inRange) {
            verifiedGPS = false;
            gpsRejectReason = `Geofence violation: Out of range (${Math.round(distance)}m from office).`;
            return res.status(400).json({
                message: 'Punch rejected: Outside office boundary',
                details: gpsRejectReason
            });
        }
        // B. Face Recognition
        const enrolledEmbedding = await db_1.default.faceEmbedding.findFirst({
            where: { employeeId }
        });
        if (enrolledEmbedding) {
            if (!faceEmbedding) {
                return res.status(400).json({ message: 'Biometric verification required (Selfie face embedding missing)' });
            }
            const reference = JSON.parse(enrolledEmbedding.frontEmbedding);
            const matchResult = (0, rules_service_1.compareFaceEmbeddings)(faceEmbedding, reference);
            if (!matchResult.isMatch) {
                verifiedFace = false;
                faceRejectReason = `Face match similarity is ${matchResult.similarityPercentage}%, required threshold is >90% (distance <= 0.6).`;
                // Log mismatch audit
                await db_1.default.notification.create({
                    data: {
                        userId: employee.userId, // notify employee
                        title: 'Punch In Failed',
                        message: `Face verification failed. Similarity: ${matchResult.similarityPercentage}%`,
                        type: 'ALERT'
                    }
                });
                return res.status(400).json({
                    message: 'Punch rejected: Face biometric verification failed',
                    details: faceRejectReason
                });
            }
        }
        else {
            // If face biometrics are enrolled or required, enforce it. For this code, we allow bypass if not enrolled yet.
            console.log('No enrolled face embedding found for employee, skipping verification.');
        }
        // C. Evaluate Shift Status (Grace period, Late, Half-day, Absent)
        const now = new Date();
        const { status, lateMinutes } = (0, rules_service_1.evaluatePunchInStatus)(now, employee.shift);
        // Save Attendance
        const punchRecord = await db_1.default.attendance.upsert({
            where: {
                employeeId_date: {
                    employeeId,
                    date: today
                }
            },
            update: {
                punchInTime: now,
                punchInSelfie: selfie || null,
                punchInLatitude: latitude,
                punchInLongitude: longitude,
                punchInAccuracy: accuracy || null,
                punchInAddress: address || null,
                status,
                lateMinutes,
                verifiedGPS,
                verifiedFace,
                deviceId: deviceId || null
            },
            create: {
                employeeId,
                date: today,
                punchInTime: now,
                punchInSelfie: selfie || null,
                punchInLatitude: latitude,
                punchInLongitude: longitude,
                punchInAccuracy: accuracy || null,
                punchInAddress: address || null,
                status,
                lateMinutes,
                verifiedGPS,
                verifiedFace,
                deviceId: deviceId || null
            }
        });
        // Notify employee of success
        await db_1.default.notification.create({
            data: {
                userId: employee.userId,
                title: 'Punch In Successful',
                message: `Punched in successfully as ${status} at ${now.toLocaleTimeString()}`,
                type: 'SUCCESS'
            }
        });
        return res.json({
            message: `Punch In successful: ${status}`,
            attendance: punchRecord
        });
    }
    catch (error) {
        console.error('Punch In error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.punchIn = punchIn;
// 3. Punch Out Endpoint
const punchOut = async (req, res) => {
    const employeeId = req.user?.employeeId;
    const companyId = req.user?.companyId;
    const { selfie, latitude, longitude, accuracy, address, faceEmbedding, deviceId } = req.body;
    if (!employeeId || !companyId) {
        return res.status(403).json({ message: 'Employee context missing' });
    }
    try {
        const today = getTodayDateString();
        // Fetch active punch-in for today
        const attendance = await db_1.default.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date: today
                }
            }
        });
        if (!attendance || !attendance.punchInTime) {
            return res.status(400).json({ message: 'You must punch in before punching out' });
        }
        if (attendance.punchOutTime) {
            return res.status(400).json({ message: 'Already punched out for today' });
        }
        const company = await db_1.default.company.findUnique({
            where: { id: companyId },
            include: { salaryRules: true }
        });
        if (!company) {
            return res.status(404).json({ message: 'Company settings not found' });
        }
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId },
            include: { shift: true }
        });
        if (!employee) {
            return res.status(404).json({ message: 'Employee profile not found' });
        }
        // Verify Geofence on Punch Out
        const distance = (0, rules_service_1.calculateDistance)(latitude, longitude, company.latitude, company.longitude);
        const inRange = distance <= company.allowedRadius;
        if (!inRange) {
            return res.status(400).json({
                message: 'Punch Out rejected: Outside office boundary',
                details: `Distance ${Math.round(distance)}m exceeds boundary.`
            });
        }
        // Verify Face on Punch Out if enrolled
        const enrolledEmbedding = await db_1.default.faceEmbedding.findFirst({
            where: { employeeId }
        });
        if (enrolledEmbedding && faceEmbedding) {
            const reference = JSON.parse(enrolledEmbedding.frontEmbedding);
            const matchResult = (0, rules_service_1.compareFaceEmbeddings)(faceEmbedding, reference);
            if (!matchResult.isMatch) {
                return res.status(400).json({ message: 'Punch Out rejected: Face verification failed' });
            }
        }
        const now = new Date();
        // Calculate Working Hours
        const diffMs = now.getTime() - new Date(attendance.punchInTime).getTime();
        const workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        // Calculate break hours (mock 1 hour break if worked more than 5 hours, else 0)
        const breakHours = workHours > 5.0 ? 1.0 : 0.0;
        const netWorkHours = Math.max(0, workHours - breakHours);
        // Calculate Overtime (hours worked beyond the shift overtimeAfter config)
        let overtimeHours = 0.0;
        if (netWorkHours > employee.shift.overtimeAfter) {
            overtimeHours = parseFloat((netWorkHours - employee.shift.overtimeAfter).toFixed(2));
        }
        // Calculate dynamic today's salary earned based on employee basic salary rate and shift status
        // Basic daily salary = Monthly Salary / 22 working days
        const workingDaysInMonth = 22;
        const dailyBasicRate = employee.basicSalary / workingDaysInMonth;
        const hourlyBasicRate = dailyBasicRate / 8; // 8-hour work day basic
        let salaryEarnedToday = dailyBasicRate;
        let finalStatus = attendance.status;
        // Apply rules deductions
        const rules = company.salaryRules[0];
        if (rules) {
            if (finalStatus === 'LATE') {
                const latePenalty = (attendance.lateMinutes || 0) * rules.latePenaltyRate;
                salaryEarnedToday = Math.max(0, dailyBasicRate - latePenalty);
            }
            else if (finalStatus === 'HALFDAY') {
                salaryEarnedToday = dailyBasicRate * (1 - rules.halfDayDeductionRate);
            }
            else if (finalStatus === 'ABSENT') {
                salaryEarnedToday = dailyBasicRate * (1 - rules.absentDeductionRate);
            }
            // Add overtime pay
            if (overtimeHours > 0) {
                const overtimePay = overtimeHours * (hourlyBasicRate * rules.overtimeMultiplier);
                salaryEarnedToday += overtimePay;
            }
        }
        // Update attendance record
        const updatedAttendance = await db_1.default.attendance.update({
            where: {
                employeeId_date: {
                    employeeId,
                    date: today
                }
            },
            data: {
                punchOutTime: now,
                punchOutSelfie: selfie || null,
                punchOutLatitude: latitude,
                punchOutLongitude: longitude,
                punchOutAccuracy: accuracy || null,
                punchOutAddress: address || null,
                workHours: netWorkHours,
                breakHours,
                overtimeHours,
                salaryEarnedToday: parseFloat(salaryEarnedToday.toFixed(2))
            }
        });
        // Notify employee of success
        await db_1.default.notification.create({
            data: {
                userId: employee.userId,
                title: 'Punch Out Successful',
                message: `Punched out successfully at ${now.toLocaleTimeString()}. Worked ${netWorkHours}h. Earned: ${company.currency} ${Math.round(salaryEarnedToday)}`,
                type: 'SUCCESS'
            }
        });
        return res.json({
            message: 'Punch Out successful',
            attendance: updatedAttendance
        });
    }
    catch (error) {
        console.error('Punch Out error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.punchOut = punchOut;
// 4. Get Today's Status
const getTodayStatus = async (req, res) => {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
        return res.status(403).json({ message: 'Employee ID is missing' });
    }
    try {
        const today = getTodayDateString();
        const attendance = await db_1.default.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date: today
                }
            }
        });
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId },
            include: {
                shift: true,
                user: {
                    include: {
                        company: {
                            include: {
                                salaryRules: true
                            }
                        }
                    }
                }
            }
        });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        // Calculate current monthly attendance percentage and monthly estimate
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        const monthlyRecords = await db_1.default.attendance.findMany({
            where: {
                employeeId,
                date: {
                    gte: monthStart,
                    lte: monthEnd
                }
            }
        });
        const presentDays = monthlyRecords.filter(r => ['PRESENT', 'LATE', 'HALFDAY'].includes(r.status)).length;
        const totalWorkingDays = 22; // default denominator
        const attendancePercentage = Math.round((presentDays / totalWorkingDays) * 100);
        const monthlySalaryEarned = monthlyRecords.reduce((acc, curr) => acc + curr.salaryEarnedToday, 0);
        const enrolledFace = await db_1.default.faceEmbedding.findFirst({
            where: { employeeId }
        });
        return res.json({
            attendance: attendance || null,
            company: {
                name: employee.user.company.name,
                latitude: employee.user.company.latitude,
                longitude: employee.user.company.longitude,
                allowedRadius: employee.user.company.allowedRadius,
                currency: employee.user.company.currency
            },
            shift: employee.shift,
            metrics: {
                attendancePercentage: Math.min(100, attendancePercentage),
                monthlySalaryEstimate: Math.round(monthlySalaryEarned),
                isFaceRegistered: !!enrolledFace
            }
        });
    }
    catch (error) {
        console.error('Get today status error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getTodayStatus = getTodayStatus;
// 5. Get Attendance History (Employee personal calendar history)
const getHistory = async (req, res) => {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
        return res.status(403).json({ message: 'Employee ID is missing' });
    }
    try {
        const history = await db_1.default.attendance.findMany({
            where: { employeeId },
            orderBy: { date: 'desc' },
            take: 90 // last 3 months
        });
        return res.json(history);
    }
    catch (error) {
        console.error('Get history error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
exports.getHistory = getHistory;
