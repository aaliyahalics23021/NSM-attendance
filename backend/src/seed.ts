import bcrypt from 'bcryptjs';
import prisma from './services/db';

async function main() {
  console.log('🌱 Seeding AttendX database...');

  // 1. Upsert Company (by name, not hardcoded ID)
  let company = await prisma.company.findFirst({ where: { name: 'Apex Corp' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Apex Corp',
        logo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aba9?w=100&fit=crop',
        address: '123 Tech Park, Phase 1, Bangalore, India',
        latitude: 12.9715987,
        longitude: 77.5945627,
        allowedRadius: 500.0, // 500 meters (relaxed for testing)
        timezone: 'Asia/Kolkata',
        currency: 'INR'
      }
    });
  }
  console.log('✅ Company:', company.name, '(id:', company.id + ')');

  // 2. Admin Password
  const adminPasswordHash = await bcrypt.hash('password123', 10);

  // 3. Upsert Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@apex.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@apex.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      companyId: company.id
    }
  });
  console.log('✅ Admin user:', adminUser.email);

  // 4. Upsert Departments (idempotent)
  const deptNames = ['Engineering', 'HR & Admin', 'Sales & Marketing', 'Finance'];
  const departments: Record<string, string> = {};
  for (const deptName of deptNames) {
    let dept = await prisma.department.findFirst({ where: { name: deptName, companyId: company.id } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name: deptName, companyId: company.id } });
    }
    departments[deptName] = dept.id;
    console.log('✅ Department:', deptName);
  }

  // 5. Upsert Shifts (idempotent)
  const shiftDefs = [
    { name: 'General Shift', startTime: '09:00', endTime: '18:00', gracePeriod: 15, lateAfter: 30, halfDayAfter: 120, absentAfter: 240, overtimeAfter: 9.0 },
    { name: 'Morning Shift', startTime: '07:00', endTime: '15:00', gracePeriod: 10, lateAfter: 20, halfDayAfter: 90,  absentAfter: 180, overtimeAfter: 8.0 },
    { name: 'Night Shift',   startTime: '21:00', endTime: '06:00', gracePeriod: 15, lateAfter: 30, halfDayAfter: 120, absentAfter: 240, overtimeAfter: 9.0 },
  ];
  const shifts: Record<string, string> = {};
  for (const s of shiftDefs) {
    let shift = await prisma.shift.findFirst({ where: { name: s.name, companyId: company.id } });
    if (!shift) {
      shift = await prisma.shift.create({
        data: { ...s, minWorkHours: 8.0, maxWorkHours: 12.0, autoPunchOutTime: '22:00', companyId: company.id }
      });
    }
    shifts[s.name] = shift.id;
    console.log('✅ Shift:', s.name);
  }

  // 6. Upsert Salary Rules
  await prisma.salaryRule.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      latePenaltyRate: 10.0,
      halfDayDeductionRate: 0.5,
      absentDeductionRate: 1.0,
      hourlyRate: 250.0,
      overtimeMultiplier: 1.5,
      pfRate: 0.12,
      esiRate: 0.0075,
      taxRate: 0.05,
      tdsRate: 0.02,
      bonusAmount: 2000.0
    }
  });
  console.log('✅ Salary Rules configured');

  // 7. Demo Employees
  const employeeDefs = [
    { phone: '9876543210', employeeId: 'EMP-1001', firstName: 'John',    lastName: 'Doe',    dept: 'Engineering',       shift: 'General Shift', salary: 65000, email: 'john.doe@apex.internal' },
    { phone: '9876543211', employeeId: 'EMP-1002', firstName: 'Priya',   lastName: 'Sharma', dept: 'HR & Admin',         shift: 'General Shift', salary: 48000, email: 'priya.sharma@apex.internal' },
    { phone: '9876543212', employeeId: 'EMP-1003', firstName: 'Rahul',   lastName: 'Verma',  dept: 'Engineering',       shift: 'General Shift', salary: 72000, email: 'rahul.verma@apex.internal' },
    { phone: '9876543213', employeeId: 'EMP-1004', firstName: 'Ananya',  lastName: 'Singh',  dept: 'Sales & Marketing',  shift: 'Morning Shift', salary: 55000, email: 'ananya.singh@apex.internal' },
    { phone: '9876543214', employeeId: 'EMP-1005', firstName: 'Karthik', lastName: 'Nair',   dept: 'Finance',            shift: 'General Shift', salary: 58000, email: 'karthik.nair@apex.internal' },
  ];

  for (const empDef of employeeDefs) {
    // Upsert user — check by phone first, then by email, then by employeeId
    let user = await prisma.user.findFirst({ where: { phone: empDef.phone } });
    if (!user) {
      user = await prisma.user.findFirst({ where: { email: empDef.email } });
    }
    if (!user) {
      // Check if an employee profile with this ID already has a linked user
      const existingEmp = await prisma.employee.findFirst({ where: { employeeId: empDef.employeeId }, include: { user: true } });
      if (existingEmp) {
        user = existingEmp.user;
        // Update with email if missing
        if (!user.email) {
          user = await prisma.user.update({ where: { id: user.id }, data: { email: empDef.email } });
        }
      } else {
        user = await prisma.user.create({
          data: { phone: empDef.phone, email: empDef.email, role: 'EMPLOYEE', companyId: company.id }
        });
      }
    }

    // Upsert employee profile
    let employee = await prisma.employee.findFirst({ where: { employeeId: empDef.employeeId } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          userId: user.id,
          employeeId: empDef.employeeId,
          firstName: empDef.firstName,
          lastName: empDef.lastName,
          departmentId: departments[empDef.dept],
          shiftId: shifts[empDef.shift],
          basicSalary: empDef.salary,
          leaveBalanceCasual: 10,
          leaveBalanceSick: 8,
          leaveBalancePaid: 12,
          active: true,
          joinedDate: new Date('2026-01-01')
        }
      });
    }
    console.log(`✅ Employee: ${empDef.firstName} ${empDef.lastName} (${empDef.employeeId})`);

    // 8. Seed attendance for this month (last 15 weekdays)
    const today = new Date();
    const daysToSeed = 15;
    let daysAdded = 0;
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // start from yesterday

    while (daysAdded < daysToSeed) {
      const dow = checkDate.getDay();
      // Skip weekends
      if (dow !== 0 && dow !== 6) {
        const dayStart = new Date(checkDate);
        dayStart.setHours(0, 0, 0, 0);

        // Check if record exists
        const existing = await prisma.attendance.findFirst({
          where: { employeeId: employee.id, date: dayStart }
        });

        if (!existing) {
          // Randomize: 80% present, 10% late, 5% half-day, 5% absent
          const rand = Math.random();
          let status = 'PRESENT';
          let lateMinutes = 0;
          let punchInHour = 9;
          let punchInMin = Math.floor(Math.random() * 10); // 09:00-09:10

          if (rand > 0.95) {
            status = 'ABSENT';
          } else if (rand > 0.90) {
            status = 'HALFDAY';
            lateMinutes = 130;
            punchInHour = 11;
            punchInMin = 10;
          } else if (rand > 0.80) {
            status = 'LATE';
            lateMinutes = 35 + Math.floor(Math.random() * 30);
            punchInHour = 9;
            punchInMin = 45 + Math.floor(Math.random() * 30);
            if (punchInMin >= 60) { punchInHour++; punchInMin -= 60; }
          }

          if (status !== 'ABSENT') {
            const punchIn = new Date(dayStart);
            punchIn.setHours(punchInHour, punchInMin, 0, 0);

            const workHours = status === 'HALFDAY' ? 4.5 : 8.0 + Math.random() * 1.5;
            const punchOut = new Date(punchIn.getTime() + workHours * 3600 * 1000);
            const breakHours = workHours > 5 ? 1.0 : 0;
            const netWork = Math.max(0, workHours - breakHours);
            const overtimeHours = netWork > 9 ? netWork - 9 : 0;

            const dailyRate = empDef.salary / 22;
            let salaryEarned = dailyRate;
            if (status === 'HALFDAY') salaryEarned = dailyRate * 0.5;
            else if (status === 'LATE') salaryEarned = Math.max(0, dailyRate - lateMinutes * 10);
            if (overtimeHours > 0) salaryEarned += overtimeHours * (dailyRate / 8) * 1.5;

            await prisma.attendance.create({
              data: {
                employeeId: employee.id,
                date: dayStart,
                punchInTime: punchIn,
                punchOutTime: punchOut,
                punchInLatitude: company.latitude,
                punchInLongitude: company.longitude,
                punchOutLatitude: company.latitude,
                punchOutLongitude: company.longitude,
                punchInAccuracy: 8.0,
                punchOutAccuracy: 8.0,
                punchInAddress: company.address || '123 Tech Park, Bangalore',
                punchOutAddress: company.address || '123 Tech Park, Bangalore',
                status,
                lateMinutes,
                workHours: parseFloat(netWork.toFixed(2)),
                breakHours,
                overtimeHours: parseFloat(overtimeHours.toFixed(2)),
                salaryEarnedToday: parseFloat(salaryEarned.toFixed(2)),
                verifiedGPS: true,
                verifiedFace: true,
                deviceId: 'SEED_DEVICE'
              }
            });
          } else {
            // Absent — create a record with ABSENT status
            await prisma.attendance.create({
              data: {
                employeeId: employee.id,
                date: dayStart,
                status: 'ABSENT',
                salaryEarnedToday: 0,
                verifiedGPS: false,
                verifiedFace: false
              }
            });
          }
        }
        daysAdded++;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    console.log(`   📅 Seeded attendance history for ${empDef.firstName}`);
  }

  // 9. Add some holidays
  const holidayDefs = [
    { name: 'Independence Day', date: new Date('2026-08-15'), type: 'NATIONAL' },
    { name: 'Gandhi Jayanti',   date: new Date('2026-10-02'), type: 'NATIONAL' },
    { name: 'Diwali',           date: new Date('2026-10-20'), type: 'FESTIVAL' },
    { name: 'Christmas',        date: new Date('2026-12-25'), type: 'FESTIVAL' },
  ];
  for (const h of holidayDefs) {
    const existing = await prisma.holiday.findFirst({ where: { name: h.name, companyId: company.id } });
    if (!existing) {
      await prisma.holiday.create({
        data: { ...h, companyId: company.id, recurring: true, description: `${h.name} — Public Holiday` }
      });
    }
  }
  console.log('✅ Holidays seeded');

  console.log('');
  console.log('🎉 Database seeding completed!');
  console.log('');
  console.log('🔑 Admin Login:    email: admin@apex.com  |  password: password123');
  console.log('👤 Employee Login: phone: 9876543210      |  OTP will be shown in response');
  console.log('📍 Office Location: Bangalore MG Road (lat: 12.9716, lon: 77.5946)');
  console.log('📏 Geofence Radius: 500m (relaxed for testing)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
