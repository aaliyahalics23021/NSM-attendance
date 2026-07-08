"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("./services/db"));
async function main() {
    console.log('Seeding database...');
    // 1. Create Company
    const company = await db_1.default.company.upsert({
        where: { id: 'default-company-id' },
        update: {},
        create: {
            id: 'default-company-id',
            name: 'Apex Corp',
            logo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aba9?w=100&fit=crop',
            address: '123 Tech Park, Phase 1, Bangalore, India',
            latitude: 12.9715987, // Bangalore MG Road Center coordinate
            longitude: 77.5945627,
            allowedRadius: 150.0, // 150 meters
            timezone: 'Asia/Kolkata',
            currency: 'INR'
        }
    });
    console.log('Company created:', company.name);
    // 2. Create Admin Password Hash
    const adminPasswordHash = await bcryptjs_1.default.hash('password123', 10);
    // 3. Create Admin User
    const adminUser = await db_1.default.user.upsert({
        where: { email: 'admin@apex.com' },
        update: { passwordHash: adminPasswordHash },
        create: {
            email: 'admin@apex.com',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            companyId: company.id
        }
    });
    console.log('Admin User created:', adminUser.email);
    // 4. Create Department
    const department = await db_1.default.department.create({
        data: {
            name: 'Engineering',
            companyId: company.id
        }
    });
    console.log('Department created:', department.name);
    // 5. Create Shift
    const shift = await db_1.default.shift.create({
        data: {
            name: 'General Shift',
            startTime: '09:00',
            endTime: '18:00',
            gracePeriod: 15,
            lateAfter: 30,
            halfDayAfter: 120,
            absentAfter: 240,
            minWorkHours: 8.0,
            maxWorkHours: 12.0,
            overtimeAfter: 9.0,
            autoPunchOutTime: '22:00',
            companyId: company.id
        }
    });
    console.log('Shift created:', shift.name);
    // 6. Create Salary Rules
    const salaryRules = await db_1.default.salaryRule.upsert({
        where: { companyId: company.id },
        update: {},
        create: {
            companyId: company.id,
            latePenaltyRate: 10.0, // 10 INR deduction per minute late
            halfDayDeductionRate: 0.5, // Deduct 50% daily salary for half day
            absentDeductionRate: 1.0, // Deduct 100% daily salary for absence
            hourlyRate: 250.0, // 250 INR per hour basic salary
            overtimeMultiplier: 1.5, // 1.5x hourly rate for overtime
            pfRate: 0.12, // 12% PF contribution
            esiRate: 0.0075, // 0.75% ESI contribution
            taxRate: 0.05, // 5% TDS / income tax basic
            tdsRate: 0.02, // 2% TDS
            bonusAmount: 2000.0 // Default attendance/monthly bonus
        }
    });
    console.log('Salary Rules created for company:', company.id);
    // 7. Create Employee User
    const employeeUser = await db_1.default.user.upsert({
        where: { phone: '9876543210' },
        update: {},
        create: {
            phone: '9876543210',
            role: 'EMPLOYEE',
            companyId: company.id
        }
    });
    // 8. Create Employee Profile
    const employee = await db_1.default.employee.upsert({
        where: { userId: employeeUser.id },
        update: {},
        create: {
            userId: employeeUser.id,
            employeeId: 'EMP-1001',
            firstName: 'John',
            lastName: 'Doe',
            departmentId: department.id,
            shiftId: shift.id,
            basicSalary: 45000.0, // 45,000 INR per month basic
            leaveBalanceCasual: 10,
            leaveBalanceSick: 8,
            leaveBalancePaid: 12,
            active: true,
            joinedDate: new Date('2026-01-01')
        }
    });
    console.log('Employee Profile created:', `${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    console.log('Database seeding completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await db_1.default.$disconnect();
});
