import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Calendar, User, FileText, Send, LogOut, CheckCircle2, 
  Users, ShieldAlert, Moon, Sun, 
  Plus, Edit, Trash2, Shield, Settings, AlertCircle, RefreshCcw,
  Check, X, FileSpreadsheet, KeyRound, Bell, CheckSquare, Loader2
} from 'lucide-react';
import { FaceScanner } from './components/FaceScanner';
import { auth as firebaseAuth, isFirebaseConfigured } from './firebase.config';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

interface UserState {
  token: string;
  id: string;
  role: 'ADMIN' | 'EMPLOYEE';
  companyId: string;
  companyName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  employeeName?: string;
}

export default function App() {
  const [user, setUser] = useState<UserState | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Navigation states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'leave' | 'profile'>('dashboard');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'attendance' | 'employees' | 'leaves' | 'holidays' | 'payroll' | 'settings' | 'logs'>('dashboard');

  // Toast Notification system
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: 'success' | 'error' | 'info' }>>([]);
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Confirm Modal system
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; message: string; onConfirm: () => void } | null>(null);
  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmModal({ open: true, message, onConfirm });
  }, []);

  // Global loading state for async actions
  const [isLoading, setIsLoading] = useState(false);
  
  // Auth Form states
  const [authRole, setAuthRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');
  const [email, setEmail] = useState('admin@apex.com');
  const [password, setPassword] = useState('password123');
  const [phone, setPhone] = useState('9876543210');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [receivedOtp, setReceivedOtp] = useState(''); // helper to show SMS code
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Location Simulation option for testing Geofencing
  const [simulateLocation, setSimulateLocation] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [liveLocationError, setLiveLocationError] = useState<string | null>(null);
  const [isFetchingLiveLocation, setIsFetchingLiveLocation] = useState(false);

  // Biometrics trigger
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerAction, setScannerAction] = useState<'enroll' | 'verify'>('verify');
  const [pendingPunchType, setPendingPunchType] = useState<'in' | 'out' | null>(null);

  // Common Dynamic states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Employee details states
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [employeeLeaves, setEmployeeLeaves] = useState<any[]>([]);
  const [employeeProfile, setEmployeeProfile] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState({ casual: 10, sick: 8, paid: 12 });

  // Employee Leave Form
  const [applyLeaveType, setApplyLeaveType] = useState('CASUAL');
  const [applyLeaveStart, setApplyLeaveStart] = useState('');
  const [applyLeaveEnd, setApplyLeaveEnd] = useState('');
  const [applyLeaveReason, setApplyLeaveReason] = useState('');

  // Admin states
  const [adminStats, setAdminStats] = useState<any>(null);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [adminLeaves, setAdminLeaves] = useState<any[]>([]);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [payrollList, setPayrollList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [salaryRules, setSalaryRules] = useState<any>(null);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Admin Attendance tab state
  const [adminAttendance, setAdminAttendance] = useState<any>(null);
  const [attendanceFilter, setAttendanceFilter] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('ALL');

  // Admin Form triggers / modals
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [empFormId, setEmpFormId] = useState('');
  const [empFormFirst, setEmpFormFirst] = useState('');
  const [empFormLast, setEmpFormLast] = useState('');
  const [empFormPhone, setEmpFormPhone] = useState('');
  const [empFormEmail, setEmpFormEmail] = useState('');
  const [empFormDept, setEmpFormDept] = useState('');
  const [empFormShift, setEmpFormShift] = useState('');
  const [empFormSalary, setEmpFormSalary] = useState('45000');

  // Admin Holiday Form
  const [holidayFormOpen, setHolidayFormOpen] = useState(false);
  const [holidayFormName, setHolidayFormName] = useState('');
  const [holidayFormDate, setHolidayFormDate] = useState('');
  const [holidayFormType, setHolidayFormType] = useState('FESTIVAL');
  const [holidayFormDesc, setHolidayFormDesc] = useState('');

  // Admin Settings forms
  const [payrollMonth, setPayrollMonth] = useState('7');
  const [payrollYear, setPayrollYear] = useState('2026');

  // Ticking Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Set Theme Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.remove('light-mode');
    } else {
      root.classList.add('light-mode');
    }
  }, [theme]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor real-time coordinates when simulation is disabled
  useEffect(() => {
    if (!simulateLocation) {
      setIsFetchingLiveLocation(true);
      setLiveLocationError(null);
      if (!navigator.geolocation) {
        setLiveLocationError('Geolocation not supported by this browser.');
        setIsFetchingLiveLocation(false);
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
          setLiveLocationError(null);
          setIsFetchingLiveLocation(false);
        },
        (err) => {
          console.error('Error fetching live location:', err);
          let errorMsg = 'Failed to retrieve location.';
          if (err.code === 1) { // PERMISSION_DENIED
            errorMsg = 'Location permission denied. Please allow GPS access.';
          } else if (err.code === 2) { // POSITION_UNAVAILABLE
            errorMsg = 'GPS signal unavailable.';
          } else if (err.code === 3) { // TIMEOUT
            errorMsg = 'GPS search timed out.';
          }
          setLiveLocationError(errorMsg);
          setIsFetchingLiveLocation(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLiveLocation(null);
      setLiveLocationError(null);
    }
  }, [simulateLocation]);

  // Retrieve user session on load - validate it has a proper MongoDB ObjectId companyId
  useEffect(() => {
    const stored = localStorage.getItem('attendx_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate companyId is a valid 24-char hex MongoDB ObjectId
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(parsed?.companyId || '');
        if (!isValidObjectId) {
          // Stale session from pre-MongoDB era - force fresh login
          localStorage.removeItem('attendx_session');
        } else {
          setUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem('attendx_session');
      }
    }
  }, []);

  // Load employee portal data
  useEffect(() => {
    if (!user || user.role !== 'EMPLOYEE') return;

    const fetchEmployeeData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${user.token}` };
        
        // Today Status & Company Metrics
        const statusRes = await fetch(`${API_BASE}/attendance/today-status`, { headers });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setTodayStatus(statusData);
          if (statusData.metrics) {
            setLeaveBalance({
              casual: statusData.metrics.leaveBalanceCasual ?? 10,
              sick: statusData.metrics.leaveBalanceSick ?? 8,
              paid: statusData.metrics.leaveBalancePaid ?? 12
            });
          }
        }

        // Attendance History
        const histRes = await fetch(`${API_BASE}/attendance/history`, { headers });
        if (histRes.ok) {
          const histData = await histRes.json();
          setAttendanceHistory(histData);
        }

        // Leaves History
        const leaveRes = await fetch(`${API_BASE}/leave/employee-list`, { headers });
        if (leaveRes.ok) {
          const leaveData = await leaveRes.json();
          setEmployeeLeaves(leaveData);
        }

        // Profile Details
        const profRes = await fetch(`${API_BASE}/employee/profile`, { headers });
        if (profRes.ok) {
          const profData = await profRes.json();
          setEmployeeProfile(profData);
        }

        // Notifications
        const notRes = await fetch(`${API_BASE}/company/notifications`, { headers });
        if (notRes.ok) {
          const notData = await notRes.json();
          setNotifications(notData);
        }
      } catch (e) {
        console.error('Error fetching employee portal stats:', e);
      }
    };

    fetchEmployeeData();
  }, [user, refreshTrigger]);

  // Load admin portal data
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;

    const fetchAdminData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${user.token}` };

        // Stats summary
        const statsRes = await fetch(`${API_BASE}/company/stats`, { headers });
        if (statsRes.ok) setAdminStats(await statsRes.json());

        // Employees List
        const empRes = await fetch(`${API_BASE}/employee`, { headers });
        if (empRes.ok) setEmployeesList(await empRes.json());

        // Leaves
        const leaveRes = await fetch(`${API_BASE}/leave/admin-list`, { headers });
        if (leaveRes.ok) setAdminLeaves(await leaveRes.json());

        // Holidays
        const holRes = await fetch(`${API_BASE}/holiday`, { headers });
        if (holRes.ok) setHolidaysList(await holRes.json());

        // Payroll
        const payRes = await fetch(`${API_BASE}/payroll`, { headers });
        if (payRes.ok) setPayrollList(await payRes.json());

        // Settings
        const settingsRes = await fetch(`${API_BASE}/company/settings`, { headers });
        if (settingsRes.ok) setCompanySettings(await settingsRes.json());

        // Salary Rules
        const rulesRes = await fetch(`${API_BASE}/payroll/rules`, { headers });
        if (rulesRes.ok) setSalaryRules(await rulesRes.json());

        // Shifts & Depts
        const shiftsRes = await fetch(`${API_BASE}/company/shifts`, { headers });
        if (shiftsRes.ok) setShiftsList(await shiftsRes.json());

        const deptsRes = await fetch(`${API_BASE}/company/departments`, { headers });
        if (deptsRes.ok) setDepartmentsList(await deptsRes.json());

        // Audit Logs
        const logsRes = await fetch(`${API_BASE}/company/audit-logs`, { headers });
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      } catch (e) {
        console.error('Error fetching admin portal stats:', e);
      }
    };

    fetchAdminData();
  }, [user, refreshTrigger, adminTab]);

  // Real-time automatic data sync (polls backend every 10 seconds for live dashboard updates)
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 10000); // 10 seconds auto-refresh rate
    return () => clearInterval(interval);
  }, [user]);

  // Load admin attendance data
  useEffect(() => {
    if (!user || user.role !== 'ADMIN' || adminTab !== 'attendance') return;
    const fetchAttendance = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${user.token}` };
        const url = `${API_BASE}/attendance/admin-overview?date=${attendanceFilter}&status=${attendanceStatusFilter}`;
        const res = await fetch(url, { headers });
        if (res.ok) setAdminAttendance(await res.json());
      } catch (e) { console.error('Attendance fetch error', e); }
    };
    fetchAttendance();
  }, [user, adminTab, attendanceFilter, attendanceStatusFilter, refreshTrigger]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await fetch(`${API_BASE}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || 'Login failed');
        return;
      }

      const sessionState: UserState = {
        token: data.token,
        id: data.user.id,
        role: data.user.role,
        companyId: data.user.companyId,
        companyName: data.user.companyName,
        email: data.user.email || undefined
      };
      setUser(sessionState);
      localStorage.setItem('attendx_session', JSON.stringify(sessionState));
      setAuthSuccess('Login successful!');
    } catch (e) {
      setAuthError('Connection error to backend API.');
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsLoading(true);

    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.length === 10 ? `+91${formattedPhone}` : `+${formattedPhone}`;
    }

    try {
      if (isFirebaseConfigured && firebaseAuth) {
        // Firebase Flow
        let recaptchaContainer = document.getElementById('recaptcha-container');
        if (!recaptchaContainer) {
          recaptchaContainer = document.createElement('div');
          recaptchaContainer.id = 'recaptcha-container';
          document.body.appendChild(recaptchaContainer);
        }

        const appVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {}
        });

        const confirmation = await signInWithPhoneNumber(firebaseAuth, formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
        setOtpSent(true);
        setAuthSuccess('OTP sent successfully to your phone via Firebase!');
      } else {
        // Fallback Developer Flow
        const res = await fetch(`${API_BASE}/auth/employee/otp-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });

        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.message || 'OTP request failed');
          return;
        }

        setOtpSent(true);
        setReceivedOtp(data.otpCode); // displays simulated SMS code
        setAuthSuccess(data.message || 'OTP sent successfully!');
      }
    } catch (err: any) {
      console.error('OTP send error:', err);
      setAuthError(err.message || 'Error occurred while requesting OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsLoading(true);

    try {
      let data;
      if (isFirebaseConfigured && confirmationResult) {
        // Firebase Flow
        const userCredential = await confirmationResult.confirm(otpCode);
        const idToken = await userCredential.user.getIdToken();

        // Establish database session on backend
        const res = await fetch(`${API_BASE}/auth/employee/firebase-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });

        data = await res.json();
        if (!res.ok) {
          setAuthError(data.message || 'Verification failed on backend API');
          return;
        }
      } else {
        // Fallback Developer Flow
        const res = await fetch(`${API_BASE}/auth/employee/otp-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otpCode })
        });

        data = await res.json();
        if (!res.ok) {
          setAuthError(data.message || 'Verification failed');
          return;
        }
      }

      const sessionState: UserState = {
        token: data.token,
        id: data.user.id,
        role: data.user.role,
        companyId: data.user.companyId,
        companyName: data.user.companyName,
        phone: data.user.phone || undefined,
        employeeId: data.user.employeeId,
        employeeName: data.user.employeeName
      };
      setUser(sessionState);
      localStorage.setItem('attendx_session', JSON.stringify(sessionState));
      setAuthSuccess('Verification successful!');
    } catch (err: any) {
      console.error('OTP verify error:', err);
      setAuthError(err.message || 'Error occurred while verifying OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('attendx_session');
    setUser(null);
    setOtpSent(false);
    setReceivedOtp('');
    setOtpCode('');
  };

  // Get GPS Location Coordinates
  const getCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (simulateLocation) {
        // Return default Bangalore Office MG Road Office coordinates
        resolve({
          latitude: 12.9715987,
          longitude: 77.5945627,
          accuracy: 10.0
        });
      } else {
        if (liveLocation) {
          resolve(liveLocation);
        } else if (liveLocationError) {
          reject(new Error(liveLocationError));
        } else {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by device.'));
          } else {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy
                });
              },
              (err) => reject(err),
              { enableHighAccuracy: false, timeout: 10000 }
            );
          }
        }
      }
    });
  };

  // Punch Action
  const handlePunchTrigger = (type: 'in' | 'out') => {
    setPendingPunchType(type);
    if (todayStatus && !todayStatus.metrics.isFaceRegistered) {
      // Must enroll face on first login
      setScannerAction('enroll');
      setScannerOpen(true);
    } else {
      setScannerAction('verify');
      setScannerOpen(true);
    }
  };

  const handleScanComplete = async (embeddings: {
    frontEmbedding: number[];
    leftEmbedding?: number[];
    rightEmbedding?: number[];
    selfieDataUrl?: string;
  }) => {
    setScannerOpen(false);
    setIsLoading(true);
    
    try {
      const headers = { 
        'Authorization': `Bearer ${user?.token}`,
        'Content-Type': 'application/json'
      };

      if (scannerAction === 'enroll') {
        const enrollRes = await fetch(`${API_BASE}/attendance/enroll-face`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            frontEmbedding: embeddings.frontEmbedding,
            leftEmbedding: embeddings.leftEmbedding,
            rightEmbedding: embeddings.rightEmbedding
          })
        });

        if (!enrollRes.ok) {
          const errData = await enrollRes.json();
          showToast(`Enrollment failed: ${errData.message}`, 'error');
          return;
        }
        showToast('Face enrolled successfully! Proceeding to punch...', 'success');
      }

      // Retrieve GPS Location
      const location = await getCoordinates();

      // Call Punch API with real selfie capture
      const endpoint = pendingPunchType === 'in' ? 'punch-in' : 'punch-out';
      const punchRes = await fetch(`${API_BASE}/attendance/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          selfie: embeddings.selfieDataUrl || null,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          address: simulateLocation ? '123 Tech Park, Bangalore, India (Simulated)' : 'Real Device Coordinates',
          faceEmbedding: embeddings.frontEmbedding,
          deviceId: 'WEB_BROWSER'
        })
      });

      const punchData = await punchRes.json();
      if (!punchRes.ok) {
        showToast(`Punch Rejected: ${punchData.message}${punchData.details ? ' — ' + punchData.details : ''}`, 'error');
        return;
      }

      showToast(`✅ ${punchData.message}`, 'success');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      showToast(`Error during punch: ${err.message}`, 'error');
    } finally {
      setPendingPunchType(null);
      setIsLoading(false);
    }
  };

  // Submit Leave Form
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyLeaveStart || !applyLeaveEnd || !applyLeaveReason) {
      showToast('Please fill out all leave dates and reason', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leave/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leaveType: applyLeaveType,
          startDate: applyLeaveStart,
          endDate: applyLeaveEnd,
          reason: applyLeaveReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to submit leave', 'error');
        return;
      }

      showToast('Leave application submitted successfully!', 'success');
      setApplyLeaveStart('');
      setApplyLeaveEnd('');
      setApplyLeaveReason('');
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {
      showToast('Error applying leave — check connection', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin Actions: Resolve Leave
  const handleResolveLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leave/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leaveId, status, adminNotes: 'Resolved by Admin' })
      });

      if (res.ok) {
        showToast(`Leave request ${status.toLowerCase()} successfully`, 'success');
        setRefreshTrigger(prev => prev + 1);
      } else {
        const err = await res.json();
        showToast(`Error: ${err.message}`, 'error');
      }
    } catch (e) {
      showToast('Failed resolving leave', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin: Create or edit employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${user?.token}`,
        'Content-Type': 'application/json'
      };

      const body = {
        employeeId: empFormId,
        firstName: empFormFirst,
        lastName: empFormLast,
        phone: empFormPhone,
        email: empFormEmail,
        departmentId: empFormDept,
        shiftId: empFormShift,
        basicSalary: empFormSalary
      };

      let res;
      if (editingEmp) {
        res = await fetch(`${API_BASE}/employee/${editingEmp.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ ...body, active: editingEmp.active })
        });
      } else {
        res = await fetch(`${API_BASE}/employee`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      }

      const data = await res.json();
      if (res.ok) {
        showToast(editingEmp ? 'Employee profile updated!' : 'Employee created successfully!', 'success');
        setEmpModalOpen(false);
        setEditingEmp(null);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast(`Error: ${data.message}`, 'error');
      }
    } catch (e) {
      showToast('Failed saving employee', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Edit Employee Modal
  const openEditEmp = (emp: any) => {
    setEditingEmp(emp);
    setEmpFormId(emp.employeeId);
    setEmpFormFirst(emp.firstName);
    setEmpFormLast(emp.lastName);
    setEmpFormPhone(emp.user.phone || '');
    setEmpFormEmail(emp.user.email || '');
    setEmpFormDept(emp.departmentId);
    setEmpFormShift(emp.shiftId);
    setEmpFormSalary(emp.basicSalary.toString());
    setEmpModalOpen(true);
  };

  const openNewEmp = () => {
    setEditingEmp(null);
    setEmpFormId(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setEmpFormFirst('');
    setEmpFormLast('');
    setEmpFormPhone('');
    setEmpFormEmail('');
    setEmpFormDept(departmentsList[0]?.id || '');
    setEmpFormShift(shiftsList[0]?.id || '');
    setEmpFormSalary('45000');
    setEmpModalOpen(true);
  };

  // Delete Employee
  const handleDeleteEmp = async (id: string) => {
    showConfirm('Are you sure you want to delete this employee? All associated logs, salary sheets, and biometrics will be permanently removed.', async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/employee/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        if (res.ok) {
          showToast('Employee deleted successfully', 'success');
          setRefreshTrigger(prev => prev + 1);
        } else {
          showToast('Failed to delete employee', 'error');
        }
      } catch (e) {
        showToast('Failed deleting profile', 'error');
      } finally {
        setIsLoading(false);
      }
    });
  };

  // Reset face enrollment
  const handleResetFace = async (id: string) => {
    showConfirm('Reset facial biometrics for this employee? They will need to re-enroll their face on next login.', async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/employee/${id}/reset-face`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        if (res.ok) {
          showToast('Face biometrics reset successfully', 'success');
          setRefreshTrigger(prev => prev + 1);
        } else {
          showToast('Failed to reset face data', 'error');
        }
      } catch (e) {
        showToast('Failed resetting face', 'error');
      } finally {
        setIsLoading(false);
      }
    });
  };

  // Admin: Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayFormName || !holidayFormDate) {
      showToast('Holiday name and date are required', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/holiday`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: holidayFormName,
          date: holidayFormDate,
          type: holidayFormType,
          description: holidayFormDesc
        })
      });

      if (res.ok) {
        showToast('Holiday added and synced with employee calendars!', 'success');
        setHolidayFormOpen(false);
        setHolidayFormName('');
        setHolidayFormDate('');
        setHolidayFormDesc('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        const err = await res.json();
        showToast(`Error: ${err.message}`, 'error');
      }
    } catch (e) {
      showToast('Failed adding holiday', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin: Delete Holiday
  const handleDeleteHoliday = async (id: string) => {
    showConfirm('Remove this holiday from the calendar?', async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/holiday/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user?.token}` }
        });
        if (res.ok) {
          showToast('Holiday removed from calendar', 'success');
          setRefreshTrigger(prev => prev + 1);
        } else {
          showToast('Failed to delete holiday', 'error');
        }
      } catch (e) {
        showToast('Error deleting holiday', 'error');
      } finally {
        setIsLoading(false);
      }
    });
  };

  // Admin: Run monthly payroll slips calculation
  const handleGeneratePayroll = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payroll/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: parseInt(payrollMonth),
          year: parseInt(payrollYear)
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Payroll computed! ${data.slipsCount} payslips generated in Draft status.`, 'success');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast(`Error: ${data.message}`, 'error');
      }
    } catch (e) {
      showToast('Error calculating payroll', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin: Update payroll slip status (APPROVED / PAID)
  const handleUpdatePayrollStatus = async (id: string, status: 'APPROVED' | 'PAID') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payroll/update-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, status })
      });

      if (res.ok) {
        showToast(`Payslip updated to ${status}`, 'success');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Failed to update payslip status', 'error');
      }
    } catch (e) {
      showToast('Failed updating payslip', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin: Save updated Salary Rules
  const handleSaveSalaryRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payroll/rules`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(salaryRules)
      });

      if (res.ok) {
        showToast('Salary & deduction policies updated successfully!', 'success');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Failed to save salary rules', 'error');
      }
    } catch (e) {
      showToast('Failed updating salary rules', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Admin: Auto-detect GPS Coordinates from browser
  const handleDetectAdminLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    showToast('Detecting location...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCompanySettings(prev => prev ? {
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        } : null);
        showToast('Successfully detected GPS coordinates!', 'success');
      },
      (err) => {
        showToast(`Failed to detect location: ${err.message}`, 'error');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  // Admin: Save updated Company geofence
  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/company/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(companySettings)
      });

      if (res.ok) {
        showToast('Office geofencing and company settings saved!', 'success');
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Failed to save company settings', 'error');
      }
    } catch (e) {
      showToast('Failed modifying company details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Format Helper: date string to weekday/month
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Export Table data to CSV
  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row)
        .map(val => typeof val === 'object' ? JSON.stringify(val).replace(/,/g, ';') : `"${val}"`)
        .join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container">
      {/* Top Banner Bar */}
      <header className="glass" style={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={styles.headerLogo}>A</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700 }}>AttendX</h1>
            <p style={{ fontSize: 10, color: 'var(--brand-primary)', fontWeight: 600 }}>ENTERPRISE SUITE</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {user && (
            <div style={styles.headerUserTag}>
              <Shield size={12} style={{ color: 'var(--brand-primary)' }} />
              <span>{user.role} - {user.employeeName || user.email || 'Admin'}</span>
            </div>
          )}

          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            style={styles.themeToggle}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && (
            <button onClick={handleLogout} style={styles.logoutBtn} title="Sign Out">
              <LogOut size={16} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body Switcher */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!user ? (
          /* Authentication Screen */
          <div style={styles.authWrapper}>
            <div className="glass" style={styles.authCard}>
              <div style={styles.authHeader}>
                <h2 style={{ fontSize: 24, fontWeight: 800 }}>Welcome to AttendX</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  Authentication Gateway for Corporate Entities
                </p>
              </div>

              {/* Tab Selector */}
              <div style={styles.authTabSelector}>
                <button 
                  onClick={() => { setAuthRole('EMPLOYEE'); setAuthError(''); }}
                  style={{ ...styles.authTab, borderBottomColor: authRole === 'EMPLOYEE' ? 'var(--brand-primary)' : 'transparent', color: authRole === 'EMPLOYEE' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  Employee Portal (OTP)
                </button>
                <button 
                  onClick={() => { setAuthRole('ADMIN'); setAuthError(''); }}
                  style={{ ...styles.authTab, borderBottomColor: authRole === 'ADMIN' ? 'var(--brand-primary)' : 'transparent', color: authRole === 'ADMIN' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  Admin Console
                </button>
              </div>

              {authError && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={16} />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div style={styles.successAlert}>
                  <CheckCircle2 size={16} />
                  <span>{authSuccess}</span>
                </div>
              )}

              {authRole === 'ADMIN' ? (
                /* Admin Login Form */
                <form onSubmit={handleAdminLogin}>
                  <div className="form-group">
                    <label className="form-label">Admin Email</label>
                    <input 
                      type="email" 
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                  </div>
                  <button type="submit" style={styles.authSubmitBtn}>
                    <KeyRound size={16} style={{ marginRight: 8 }} />
                    Authenticate
                  </button>
                </form>
              ) : (
                /* Employee Login Form (OTP) */
                <div>
                  {!otpSent ? (
                    <form onSubmit={handleRequestOtp}>
                      <div className="form-group">
                        <label className="form-label">Registered Phone Number</label>
                        <input 
                          type="tel" 
                          className="form-input" 
                          placeholder="e.g. 9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required 
                        />
                      </div>
                      <button type="submit" style={styles.authSubmitBtn}>
                        <Send size={16} style={{ marginRight: 8 }} />
                        Send One-Time OTP
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp}>
                      <div className="form-group">
                        <label className="form-label">Enter 6-Digit OTP</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="******"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          required 
                        />
                      </div>

                      {receivedOtp && (
                        <div className="glass" style={styles.otpPromptBox}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)' }}>SIMULATED DEVICE SMS RECEIVER:</p>
                          <p style={{ fontSize: 14, marginTop: 4 }}>
                            OTP Code: <strong style={{ color: 'var(--success)', letterSpacing: 2, fontSize: 16 }}>{receivedOtp}</strong>
                          </p>
                          <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                            Copy and paste the code above, or enter master OTP '123456' to proceed.
                          </p>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button 
                          type="button" 
                          onClick={() => setOtpSent(false)} 
                          style={{ ...styles.authSubmitBtn, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                          Change Number
                        </button>
                        <button type="submit" style={styles.authSubmitBtn}>
                          Verify & Sign In
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : user.role === 'EMPLOYEE' ? (
          /* Employee Mobile Web Portal / APK view */
          <div className="mobile-viewport">
            {/* Live Clock Ticker */}
            <div style={styles.employeeTimeBanner}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Today's Date</p>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Current Time</p>
                <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                  {currentTime.toLocaleTimeString()}
                </h2>
              </div>
            </div>

            {/* TAB VIEW 1: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div style={{ padding: 16 }}>
                {/* Punch Status Card */}
                <div className="glass" style={styles.punchStatusCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Duty Shift Status</p>
                      <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                        {todayStatus?.attendance ? (
                          <span style={{ color: 
                            todayStatus.attendance.status === 'PRESENT' ? 'var(--success)' : 
                            todayStatus.attendance.status === 'LATE' ? 'var(--warning)' : 
                            todayStatus.attendance.status === 'HALFDAY' ? 'var(--warning)' : 'var(--error)'
                          }}>
                            {todayStatus.attendance.status}
                          </span>
                        ) : 'NOT PUNCHED IN'}
                      </h3>
                      {todayStatus?.attendance?.punchInTime && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          In: {new Date(todayStatus.attendance.punchInTime).toLocaleTimeString()}
                          {todayStatus.attendance.punchOutTime && ` | Out: ${new Date(todayStatus.attendance.punchOutTime).toLocaleTimeString()}`}
                        </p>
                      )}
                    </div>

                    <div style={styles.punchIndicatorGlow}>
                      <Clock size={20} style={{ color: 'var(--brand-primary)' }} />
                    </div>
                  </div>

                  {/* Simulated GPS Settings Toggle */}
                  <div className="glass" style={styles.locationSimulatorBox}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                      <input 
                        type="checkbox" 
                        checked={simulateLocation} 
                        onChange={(e) => setSimulateLocation(e.target.checked)} 
                      />
                      <span>Simulate Location (Apex Office Geofence)</span>
                    </label>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                      {simulateLocation ? (
                        'GPS: Locked inside Bangalore Office (Radius <= 150m)'
                      ) : isFetchingLiveLocation ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Loader2 size={10} className="animate-spin" /> GPS: Detecting live coordinates...
                        </div>
                      ) : liveLocationError ? (
                        <div style={{ color: 'var(--error)' }}>GPS Error: {liveLocationError}</div>
                      ) : liveLocation ? (
                        <div style={{ color: 'var(--success)', fontWeight: 500 }}>
                          GPS: Live (Lat: {liveLocation.latitude.toFixed(6)}, Long: {liveLocation.longitude.toFixed(6)}, Acc: {liveLocation.accuracy.toFixed(1)}m)
                        </div>
                      ) : (
                        'GPS: Reading live device coordinates'
                      )}
                    </div>
                  </div>

                  {/* Punch Button Actions */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button
                      onClick={() => handlePunchTrigger('in')}
                      disabled={!!todayStatus?.attendance?.punchInTime}
                      className={!todayStatus?.attendance?.punchInTime ? 'punch-btn-glow' : ''}
                      style={{ 
                        ...styles.punchButton, 
                        background: todayStatus?.attendance?.punchInTime ? 'var(--bg-tertiary)' : 'var(--brand-gradient)',
                        cursor: todayStatus?.attendance?.punchInTime ? 'not-allowed' : 'pointer',
                        opacity: todayStatus?.attendance?.punchInTime ? 0.6 : 1
                      }}
                    >
                      Punch In (Selfie + GPS)
                    </button>
                    
                    <button
                      onClick={() => handlePunchTrigger('out')}
                      disabled={!todayStatus?.attendance?.punchInTime || !!todayStatus?.attendance?.punchOutTime}
                      style={{ 
                        ...styles.punchButton, 
                        backgroundColor: (!todayStatus?.attendance?.punchInTime || todayStatus?.attendance?.punchOutTime) ? 'var(--bg-tertiary)' : 'var(--success)',
                        cursor: (!todayStatus?.attendance?.punchInTime || todayStatus?.attendance?.punchOutTime) ? 'not-allowed' : 'pointer',
                        opacity: (!todayStatus?.attendance?.punchInTime || todayStatus?.attendance?.punchOutTime) ? 0.6 : 1
                      }}
                    >
                      Punch Out
                    </button>
                  </div>
                </div>

                {/* Employee Analytics Rings & Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                  <div className="glass" style={{ padding: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>ATTENDANCE RATE</p>
                    <div style={styles.metricRingContainer}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                        {todayStatus?.metrics?.attendancePercentage || 0}%
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Target: 95% (22 days)</p>
                  </div>

                  <div className="glass" style={{ padding: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>MONTHLY WAGE ESTIMATE</p>
                    <div style={styles.metricRingContainer}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
                        {todayStatus?.company?.currency || 'INR'} {todayStatus?.metrics?.monthlySalaryEstimate || 0}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Accumulated this month</p>
                  </div>
                </div>

                {/* Notifications Panel */}
                <div className="glass" style={{ padding: 16, marginTop: 14 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={14} style={{ color: 'var(--brand-primary)' }} />
                    System Alerts & Updates
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notifications.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No alerts received today.</p>
                    ) : (
                      notifications.slice(0, 3).map((n) => (
                        <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>
                          <div style={{ ...styles.notifDot, backgroundColor: n.type === 'ALERT' ? 'var(--error)' : 'var(--success)' }} />
                          <div>
                            <p style={{ fontWeight: 600 }}>{n.title}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{n.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW 2: HISTORY */}
            {activeTab === 'history' && (
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>My Punch History</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attendanceHistory.length === 0 ? (
                    <div className="glass" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No punch history logs discovered.
                    </div>
                  ) : (
                    attendanceHistory.map((item) => (
                      <div key={item.id} className="glass" style={styles.historyCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{formatDate(item.date)}</span>
                          <span style={{ 
                            ...styles.statusBadge, 
                            backgroundColor: 
                              item.status === 'PRESENT' ? 'var(--success-glow)' : 
                              item.status === 'LATE' ? 'var(--warning-glow)' : 
                              item.status === 'HALFDAY' ? 'var(--warning-glow)' : 'var(--error-glow)',
                            color: 
                              item.status === 'PRESENT' ? 'var(--success)' : 
                              item.status === 'LATE' ? 'var(--warning)' : 
                              item.status === 'HALFDAY' ? 'var(--warning)' : 'var(--error)'
                          }}>
                            {item.status}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10, marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <div>
                            <p>Punch In: {item.punchInTime ? new Date(item.punchInTime).toLocaleTimeString() : 'N/A'}</p>
                            <p>Punch Out: {item.punchOutTime ? new Date(item.punchOutTime).toLocaleTimeString() : 'N/A'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p>Worked: {item.workHours || 0} Hours</p>
                            <p style={{ color: 'var(--success)', fontWeight: 600 }}>Earned: +{todayStatus?.company?.currency} {item.salaryEarnedToday}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB VIEW 3: LEAVE */}
            {activeTab === 'leave' && (
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Apply Leave</h3>

                {/* Balance cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div className="glass" style={{ padding: 10, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Casual</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)' }}>{leaveBalance.casual}</p>
                  </div>
                  <div className="glass" style={{ padding: 10, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Sick</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)' }}>{leaveBalance.sick}</p>
                  </div>
                  <div className="glass" style={{ padding: 10, textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Paid</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)' }}>{leaveBalance.paid}</p>
                  </div>
                </div>

                {/* Form */}
                <form className="glass" onSubmit={handleApplyLeave} style={{ padding: 16, marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Leave Category</label>
                    <select 
                      value={applyLeaveType} 
                      onChange={(e) => setApplyLeaveType(e.target.value)}
                      style={styles.selectInput}
                    >
                      <option value="CASUAL">Casual Leave</option>
                      <option value="SICK">Sick Leave</option>
                      <option value="PAID">Paid Leave</option>
                      <option value="UNPAID">Unpaid Leave</option>
                      <option value="WFH">Work From Home (WFH)</option>
                      <option value="OUTDOOR">Outdoor Duty</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={applyLeaveStart} 
                        onChange={(e) => setApplyLeaveStart(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={applyLeaveEnd} 
                        onChange={(e) => setApplyLeaveEnd(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reason / Explanation</label>
                    <textarea 
                      className="form-input" 
                      rows={3} 
                      value={applyLeaveReason} 
                      onChange={(e) => setApplyLeaveReason(e.target.value)}
                      placeholder="Specify reason for request..."
                      required 
                    />
                  </div>

                  <button type="submit" style={styles.authSubmitBtn}>
                    Submit Leave Request
                  </button>
                </form>

                {/* Leave History List */}
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Submitted Requests</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {employeeLeaves.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No leave requests filed.</p>
                  ) : (
                    employeeLeaves.map((l) => (
                      <div key={l.id} className="glass" style={{ padding: 12, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700 }}>{l.leaveType}</span>
                          <span style={{ 
                            ...styles.statusBadge,
                            backgroundColor: l.status === 'APPROVED' ? 'var(--success-glow)' : l.status === 'REJECTED' ? 'var(--error-glow)' : 'var(--bg-tertiary)',
                            color: l.status === 'APPROVED' ? 'var(--success)' : l.status === 'REJECTED' ? 'var(--error)' : 'var(--text-secondary)'
                          }}>
                            {l.status}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                          Duration: {formatDate(l.startDate)} to {formatDate(l.endDate)}
                        </p>
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 2 }}>"{l.reason}"</p>
                        {l.adminNotes && (
                          <p style={{ fontSize: 11, color: 'var(--brand-primary)', marginTop: 4 }}>Admin Note: {l.adminNotes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB VIEW 4: PROFILE */}
            {activeTab === 'profile' && (
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>My Profile</h3>
                
                {employeeProfile && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* User Card */}
                    <div className="glass" style={{ padding: 20, textAlign: 'center' }}>
                      <div style={styles.profileAvatar}>
                        <User size={36} style={{ color: 'var(--brand-primary)' }} />
                      </div>
                      <h4 style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>
                        {employeeProfile.firstName} {employeeProfile.lastName}
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--brand-primary)' }}>ID: {employeeProfile.employeeId}</p>
                    </div>

                    {/* Meta Fields */}
                    <div className="glass" style={{ padding: 16 }}>
                      <div style={styles.profileMetaItem}>
                        <span style={styles.profileMetaLabel}>Department</span>
                        <span style={{ fontWeight: 600 }}>{employeeProfile.department?.name || 'N/A'}</span>
                      </div>
                      <div style={styles.profileMetaItem}>
                        <span style={styles.profileMetaLabel}>Linked Shift</span>
                        <span style={{ fontWeight: 600 }}>{employeeProfile.shift?.name} ({employeeProfile.shift?.startTime} - {employeeProfile.shift?.endTime})</span>
                      </div>
                      <div style={styles.profileMetaItem}>
                        <span style={styles.profileMetaLabel}>Base Salary</span>
                        <span style={{ fontWeight: 600 }}>{todayStatus?.company?.currency} {employeeProfile.basicSalary} / Mo</span>
                      </div>
                      <div style={styles.profileMetaItem}>
                        <span style={styles.profileMetaLabel}>Registered Mobile</span>
                        <span style={{ fontWeight: 600 }}>{employeeProfile.user?.phone}</span>
                      </div>
                    </div>

                    {/* Biometrics Actions */}
                    <div className="glass" style={{ padding: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} style={{ color: 'var(--brand-primary)' }} />
                        Face Biometrics Status
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {todayStatus?.metrics?.isFaceRegistered 
                          ? '✅ Facial coordinates enrolled. Ready for daily checks.' 
                          : '⚠️ Facial biometrics missing. You must enroll face coordinates before you can punch attendance.'
                        }
                      </p>
                      
                      <button 
                        onClick={() => { setScannerAction('enroll'); setScannerOpen(true); }}
                        style={styles.authSubmitBtn}
                      >
                        <RefreshCcw size={14} style={{ marginRight: 8 }} />
                        Re-register Face Profiles
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Nav bar for mobile portal */}
            <nav className="bottom-nav">
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <Clock size={20} />
                <span>Punch</span>
              </button>
              <button 
                onClick={() => setActiveTab('history')} 
                className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              >
                <Calendar size={20} />
                <span>Logs</span>
              </button>
              <button 
                onClick={() => setActiveTab('leave')} 
                className={`nav-item ${activeTab === 'leave' ? 'active' : ''}`}
              >
                <FileText size={20} />
                <span>Leaves</span>
              </button>
              <button 
                onClick={() => setActiveTab('profile')} 
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              >
                <User size={20} />
                <span>Profile</span>
              </button>
            </nav>
          </div>
        ) : (
          /* Admin Dashboard Layout */
          <div className="admin-layout">
            {/* Sidebar Left */}
            <aside className="admin-sidebar">
              <div className="sidebar-header">
                <div className="sidebar-logo">A</div>
                <span className="sidebar-title">Admin Hub</span>
              </div>

              <div className="sidebar-menu">
                <button 
                  onClick={() => setAdminTab('dashboard')} 
                  className={`sidebar-link ${adminTab === 'dashboard' ? 'active' : ''}`}
                >
                  <Users size={16} />
                  <span>Dashboard Stats</span>
                </button>

                <button 
                  onClick={() => setAdminTab('attendance')} 
                  className={`sidebar-link ${adminTab === 'attendance' ? 'active' : ''}`}
                >
                  <Clock size={16} />
                  <span>Attendance</span>
                </button>

                <button 
                  onClick={() => setAdminTab('employees')} 
                  className={`sidebar-link ${adminTab === 'employees' ? 'active' : ''}`}
                >
                  <User size={16} />
                  <span>Employee Roster</span>
                </button>

                <button 
                  onClick={() => setAdminTab('leaves')} 
                  className={`sidebar-link ${adminTab === 'leaves' ? 'active' : ''}`}
                >
                  <CheckSquare size={16} />
                  <span>Leave Resolves</span>
                </button>

                <button 
                  onClick={() => setAdminTab('holidays')} 
                  className={`sidebar-link ${adminTab === 'holidays' ? 'active' : ''}`}
                >
                  <Calendar size={16} />
                  <span>Holidays Calendar</span>
                </button>

                <button 
                  onClick={() => setAdminTab('payroll')} 
                  className={`sidebar-link ${adminTab === 'payroll' ? 'active' : ''}`}
                >
                  <FileSpreadsheet size={16} />
                  <span>Payroll Processor</span>
                </button>

                <button 
                  onClick={() => setAdminTab('settings')} 
                  className={`sidebar-link ${adminTab === 'settings' ? 'active' : ''}`}
                >
                  <Settings size={16} />
                  <span>Rules Settings</span>
                </button>

                <button 
                  onClick={() => setAdminTab('logs')} 
                  className={`sidebar-link ${adminTab === 'logs' ? 'active' : ''}`}
                >
                  <ShieldAlert size={16} />
                  <span>Audit Logs</span>
                </button>
              </div>

              <div style={{ padding: 24, borderTop: '1px solid var(--glass-border)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tenant ID:</p>
                <p style={{ fontSize: 10, color: 'var(--brand-primary)', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user.companyId}
                </p>
              </div>
            </aside>

            {/* Content Area Right */}
            <section className="admin-content">
              {/* ADMIN TAB: ATTENDANCE OVERVIEW */}
              {adminTab === 'attendance' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700 }}>Daily Attendance Register</h2>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={attendanceFilter}
                        onChange={e => setAttendanceFilter(e.target.value)}
                      />
                      <select
                        style={styles.selectInput}
                        value={attendanceStatusFilter}
                        onChange={e => setAttendanceStatusFilter(e.target.value)}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PRESENT">Present</option>
                        <option value="LATE">Late</option>
                        <option value="HALFDAY">Half Day</option>
                        <option value="ABSENT">Absent</option>
                        <option value="ON_LEAVE">On Leave</option>
                      </select>
                      <button onClick={() => handleExportCSV(adminAttendance?.records || [], `attendance_${attendanceFilter}`)} style={{ ...styles.addBtn, backgroundColor: 'var(--success)' }}>
                        <FileSpreadsheet size={14} /> Export
                      </button>
                    </div>
                  </div>

                  {adminAttendance && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                      {[
                        { label: 'Total Staff', value: adminAttendance.total, color: 'var(--brand-primary)' },
                        { label: 'Present', value: adminAttendance.present, color: 'var(--success)' },
                        { label: 'Absent', value: adminAttendance.absent, color: 'var(--error)' },
                        { label: 'Late / Half-day', value: adminAttendance.late, color: 'var(--warning)' },
                      ].map(card => (
                        <div key={card.label} className="glass metric-card" style={{ padding: 16, textAlign: 'center' }}>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</p>
                          <p style={{ fontSize: 32, fontWeight: 800, color: card.color, marginTop: 4 }}>{card.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Shift</th>
                          <th>Punch In</th>
                          <th>Punch Out</th>
                          <th>Work Hours</th>
                          <th>Status</th>
                          <th>GPS ✓</th>
                          <th>Face ✓</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!adminAttendance ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading attendance data...</td></tr>
                        ) : adminAttendance.records?.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No records found for this date/filter.</td></tr>
                        ) : (
                          adminAttendance.records?.map((r: any, idx: number) => (
                            <tr key={idx}>
                              <td>
                                <p style={{ fontWeight: 700 }}>{r.employee?.firstName} {r.employee?.lastName}</p>
                                <p style={{ fontSize: 10, color: 'var(--brand-primary)' }}>{r.employee?.employeeId}</p>
                              </td>
                              <td>{r.employee?.department?.name}</td>
                              <td>{r.employee?.shift?.name} ({r.employee?.shift?.startTime})</td>
                              <td style={{ fontFamily: 'monospace' }}>{r.punchInTime ? new Date(r.punchInTime).toLocaleTimeString() : '—'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{r.punchOutTime ? new Date(r.punchOutTime).toLocaleTimeString() : '—'}</td>
                              <td>{r.workHours ? `${r.workHours}h` : '—'}</td>
                              <td>
                                <span style={{
                                  ...styles.statusBadge,
                                  backgroundColor: r.status === 'PRESENT' ? 'var(--success-glow)' : r.status === 'LATE' ? 'var(--warning-glow)' : r.status === 'HALFDAY' ? 'var(--warning-glow)' : 'var(--error-glow)',
                                  color: r.status === 'PRESENT' ? 'var(--success)' : r.status === 'LATE' ? 'var(--warning)' : r.status === 'HALFDAY' ? 'var(--warning)' : 'var(--error)'
                                }}>{r.status}</span>
                              </td>
                              <td style={{ color: r.verifiedGPS ? 'var(--success)' : 'var(--error)', textAlign: 'center' }}>{r.verifiedGPS ? '✓' : '✗'}</td>
                              <td style={{ color: r.verifiedFace ? 'var(--success)' : 'var(--error)', textAlign: 'center' }}>{r.verifiedFace ? '✓' : '✗'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 1: METRICS DASHBOARD */}
              {adminTab === 'dashboard' && adminStats && (
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Operations Dashboard</h2>
                  
                  {/* Summary grid */}
                  <div className="card-grid">
                    <div className="glass metric-card">
                      <div className="metric-header">
                        <span className="metric-title">Present Today</span>
                        <Users size={16} style={{ color: 'var(--success)' }} />
                      </div>
                      <span className="metric-value">{adminStats.cards.presentToday}</span>
                      <span className="metric-footer">Active in building</span>
                    </div>

                    <div className="glass metric-card">
                      <div className="metric-header">
                        <span className="metric-title">Absent Roster</span>
                        <AlertCircle size={16} style={{ color: 'var(--error)' }} />
                      </div>
                      <span className="metric-value">{adminStats.cards.absentToday}</span>
                      <span className="metric-footer">Unexcused missing</span>
                    </div>

                    <div className="glass metric-card">
                      <div className="metric-header">
                        <span className="metric-title">Late Punches</span>
                        <Clock size={16} style={{ color: 'var(--warning)' }} />
                      </div>
                      <span className="metric-value">{adminStats.cards.lateToday}</span>
                      <span className="metric-footer">Arrived past grace period</span>
                    </div>

                    <div className="glass metric-card">
                      <div className="metric-header">
                        <span className="metric-title">On Approved Leave</span>
                        <FileText size={16} style={{ color: 'var(--brand-secondary)' }} />
                      </div>
                      <span className="metric-value">{adminStats.cards.onLeaveToday}</span>
                      <span className="metric-footer">WFH, Casual, or Sick</span>
                    </div>
                  </div>

                  {/* Graph Panels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginTop: 20 }}>
                    {/* Attendance Trend SVG Graph */}
                    <div className="glass" style={{ padding: 24 }}>
                      <h4 style={{ fontSize: 16, marginBottom: 16 }}>Attendance Proximity Trend (Last 7 Days)</h4>
                      
                      <div style={styles.chartContainer}>
                        <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%' }}>
                          {/* Y lines */}
                          <line x1="40" y1="20" x2="480" y2="20" stroke="var(--glass-border)" strokeWidth="1" />
                          <line x1="40" y1="80" x2="480" y2="80" stroke="var(--glass-border)" strokeWidth="1" />
                          <line x1="40" y1="140" x2="480" y2="140" stroke="var(--glass-border)" strokeWidth="1" />
                          <line x1="40" y1="180" x2="480" y2="180" stroke="var(--text-muted)" strokeWidth="1.5" />
                          
                          {/* Y scale labels */}
                          <text x="10" y="24" fill="var(--text-secondary)" fontSize="10">100%</text>
                          <text x="10" y="84" fill="var(--text-secondary)" fontSize="10">50%</text>
                          <text x="15" y="144" fill="var(--text-secondary)" fontSize="10">10%</text>

                          {/* Data Line */}
                          <path
                            d={adminStats.graphs.attendanceTrend.reduce((acc: string, curr: any, i: number) => {
                              const x = 50 + i * 65;
                              // Convert 100% to Y=20, 0% to Y=180
                              const y = 180 - (curr.presentRate / 100) * 160;
                              return acc + `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }, '')}
                            fill="none"
                            stroke="var(--brand-primary)"
                            strokeWidth="3"
                          />

                          {/* Dot plotters */}
                          {adminStats.graphs.attendanceTrend.map((curr: any, i: number) => {
                            const x = 50 + i * 65;
                            const y = 180 - (curr.presentRate / 100) * 160;
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="5" fill="var(--bg-primary)" stroke="var(--brand-primary)" strokeWidth="2.5" />
                                <text x={x - 15} y="195" fill="var(--text-secondary)" fontSize="9">{curr.date}</text>
                                <text x={x - 10} y={y - 10} fill="var(--text-primary)" fontSize="9" fontWeight="700">{curr.presentRate}%</text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Department Grid status */}
                    <div className="glass" style={{ padding: 24 }}>
                      <h4 style={{ fontSize: 16, marginBottom: 16 }}>Department Breakdown</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {adminStats.graphs.departmentWise.map((d: any, idx: number) => {
                          const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                          return (
                            <div key={idx} style={{ fontSize: 13 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600 }}>{d.departmentName}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{d.present}/{d.total} Present ({pct}%)</span>
                              </div>
                              <div style={styles.chartProgressBarBg}>
                                <div style={{ ...styles.chartProgressBarFill, width: `${pct}%`, background: 'var(--brand-gradient)' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 2: EMPLOYEE ROSTER */}
              {adminTab === 'employees' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700 }}>Employee Profiles</h2>
                    <button onClick={openNewEmp} style={styles.addBtn}>
                      <Plus size={16} /> Add Employee
                    </button>
                  </div>

                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Full Name</th>
                          <th>Department</th>
                          <th>Shift</th>
                          <th>Contact Details</th>
                          <th>Basic Salary</th>
                          <th>Biometrics</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeesList.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No employees registered.</td>
                          </tr>
                        ) : (
                          employeesList.map((emp) => (
                            <tr key={emp.id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{emp.employeeId}</td>
                              <td style={{ fontWeight: 700 }}>{emp.firstName} {emp.lastName}</td>
                              <td>{emp.department?.name || 'Unassigned'}</td>
                              <td>{emp.shift?.name}</td>
                              <td>
                                <p>{emp.user?.phone}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.user?.email || 'No email'}</p>
                              </td>
                              <td>{companySettings?.currency} {emp.basicSalary.toLocaleString()}</td>
                              <td>
                                <span style={{ 
                                  ...styles.statusBadge,
                                  backgroundColor: emp.faceEmbeddings.length > 0 ? 'var(--success-glow)' : 'var(--error-glow)',
                                  color: emp.faceEmbeddings.length > 0 ? 'var(--success)' : 'var(--error)'
                                }}>
                                  {emp.faceEmbeddings.length > 0 ? 'Registered' : 'None'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <button onClick={() => openEditEmp(emp)} style={styles.iconBtn} title="Edit Profile">
                                    <Edit size={14} />
                                  </button>
                                  <button onClick={() => handleResetFace(emp.id)} style={{ ...styles.iconBtn, color: 'var(--warning)' }} title="Reset Biometrics">
                                    <Shield size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteEmp(emp.id)} style={{ ...styles.iconBtn, color: 'var(--error)' }} title="Delete Employee">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 3: LEAVE RESOLVES */}
              {adminTab === 'leaves' && (
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Leave Applications</h2>
                  
                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Leave Type</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminLeaves.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No leaves requests submitted.</td>
                          </tr>
                        ) : (
                          adminLeaves.map((l) => (
                            <tr key={l.id}>
                              <td>
                                <p style={{ fontWeight: 700 }}>{l.employee.firstName} {l.employee.lastName}</p>
                                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {l.employee.employeeId} | {l.employee.department?.name}</p>
                              </td>
                              <td style={{ fontWeight: 600 }}>{l.leaveType}</td>
                              <td>{formatDate(l.startDate)}</td>
                              <td>{formatDate(l.endDate)}</td>
                              <td>"{l.reason}"</td>
                              <td>
                                <span style={{
                                  ...styles.statusBadge,
                                  backgroundColor: l.status === 'APPROVED' ? 'var(--success-glow)' : l.status === 'REJECTED' ? 'var(--error-glow)' : 'var(--bg-tertiary)',
                                  color: l.status === 'APPROVED' ? 'var(--success)' : l.status === 'REJECTED' ? 'var(--error)' : 'var(--text-secondary)'
                                }}>
                                  {l.status}
                                </span>
                              </td>
                              <td>
                                {l.status === 'PENDING' ? (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleResolveLeave(l.id, 'APPROVED')} style={styles.actionApproveBtn}>
                                      <Check size={12} /> Approve
                                    </button>
                                    <button onClick={() => handleResolveLeave(l.id, 'REJECTED')} style={styles.actionRejectBtn}>
                                      <X size={12} /> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resolved</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 4: HOLIDAYS CALENDAR */}
              {adminTab === 'holidays' && (
                <div>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700 }}>Corporate Holidays Calendar</h2>
                    <button onClick={() => setHolidayFormOpen(true)} style={styles.addBtn}>
                      <Plus size={16} /> Add Holiday
                    </button>
                  </div>

                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Holiday Name</th>
                          <th>Category Type</th>
                          <th>Description</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holidaysList.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No holiday events configured.</td>
                          </tr>
                        ) : (
                          holidaysList.map((h) => (
                            <tr key={h.id}>
                              <td style={{ fontWeight: 700 }}>{formatDate(h.date)}</td>
                              <td>{h.name}</td>
                              <td>
                                <span style={{ ...styles.statusBadge, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                  {h.type}
                                </span>
                              </td>
                              <td>{h.description || 'No description provided'}</td>
                              <td>
                                <button onClick={() => handleDeleteHoliday(h.id)} style={{ ...styles.iconBtn, color: 'var(--error)' }} title="Delete Holiday">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 5: PAYROLL PROCESSOR */}
              {adminTab === 'payroll' && (
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Payroll Sheet Processor</h2>
                  
                  {/* Calculation run panel */}
                  <div className="glass" style={{ padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Run Monthly Calculations</h3>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Select Month</label>
                        <select value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} style={styles.selectInput}>
                          <option value="1">January</option>
                          <option value="2">February</option>
                          <option value="3">March</option>
                          <option value="4">April</option>
                          <option value="5">May</option>
                          <option value="6">June</option>
                          <option value="7">July</option>
                          <option value="8">August</option>
                          <option value="9">September</option>
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Select Year</label>
                        <select value={payrollYear} onChange={(e) => setPayrollYear(e.target.value)} style={styles.selectInput}>
                          <option value="2026">2026</option>
                          <option value="2027">2027</option>
                        </select>
                      </div>
                      
                      <button onClick={handleGeneratePayroll} style={styles.addBtn}>
                        Calculate Payroll Slips
                      </button>

                      <button 
                        onClick={() => handleExportCSV(
                          payrollList.map(p => ({
                            id: p.id,
                            employeeId: p.employee?.employeeId,
                            name: `${p.employee?.firstName} ${p.employee?.lastName}`,
                            basicSalary: p.basicSalary,
                            overtimePay: p.overtimePay,
                            allowances: p.allowances,
                            latePenalty: p.latePenaltyDeduction,
                            halfDayDeduction: p.halfDayDeduction,
                            absentDeduction: p.absentDeduction,
                            pfDeduction: p.pfDeduction,
                            esiDeduction: p.esiDeduction,
                            netSalary: p.netSalary,
                            status: p.status
                          })),
                          `attendx_payroll_${payrollMonth}_${payrollYear}`
                        )}
                        style={{ ...styles.addBtn, backgroundColor: 'var(--success)' }}
                      >
                        <FileSpreadsheet size={16} /> Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Month/Year</th>
                          <th>Basic Pay</th>
                          <th>Additions (OT/Bonus)</th>
                          <th>Penalties (Late/Absent)</th>
                          <th>Socials (PF/ESI)</th>
                          <th>Net Salary</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollList.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payroll statements generated yet.</td>
                          </tr>
                        ) : (
                          payrollList.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <p style={{ fontWeight: 700 }}>{p.employee?.firstName} {p.employee?.lastName}</p>
                                <span style={{ fontSize: 10, color: 'var(--brand-primary)' }}>ID: {p.employee?.employeeId}</span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{p.month}/{p.year}</td>
                              <td>{companySettings?.currency} {p.basicSalary.toLocaleString()}</td>
                              <td style={{ color: 'var(--success)' }}>
                                +{companySettings?.currency} {(p.overtimePay + p.allowances).toLocaleString()}
                              </td>
                              <td style={{ color: 'var(--error)' }}>
                                -{companySettings?.currency} {(p.latePenaltyDeduction + p.halfDayDeduction + p.absentDeduction + p.unpaidLeaveDeduction).toLocaleString()}
                              </td>
                              <td>
                                <p style={{ fontSize: 11 }}>PF: -{p.pfDeduction}</p>
                                <p style={{ fontSize: 11 }}>ESI: -{p.esiDeduction}</p>
                              </td>
                              <td style={{ fontWeight: 800, color: 'var(--success)' }}>
                                {companySettings?.currency} {p.netSalary.toLocaleString()}
                              </td>
                              <td>
                                <span style={{
                                  ...styles.statusBadge,
                                  backgroundColor: p.status === 'PAID' ? 'var(--success-glow)' : 'var(--bg-tertiary)',
                                  color: p.status === 'PAID' ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                  {p.status}
                                </span>
                              </td>
                              <td>
                                {p.status === 'DRAFT' && (
                                  <button onClick={() => handleUpdatePayrollStatus(p.id, 'APPROVED')} style={styles.actionApproveBtn}>
                                    Lock Draft
                                  </button>
                                )}
                                {p.status === 'APPROVED' && (
                                  <button onClick={() => handleUpdatePayrollStatus(p.id, 'PAID')} style={{ ...styles.actionApproveBtn, backgroundColor: 'var(--success)' }}>
                                    Disburse
                                  </button>
                                )}
                                {p.status === 'PAID' && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Completed</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 6: RULES SETTINGS */}
              {adminTab === 'settings' && companySettings && salaryRules && (
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Rules Configurations</h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Geofence & Company Settings */}
                    <form className="glass" onSubmit={handleSaveCompanySettings} style={{ padding: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--brand-primary)' }}>Office Geofencing Boundaries</h3>
                      
                      <div className="form-group">
                        <label className="form-label">Office Location Title</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={companySettings.name}
                          onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Address Reference</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={companySettings.address}
                          onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Office Latitude</label>
                          <input 
                            type="number" 
                            step="any" 
                            className="form-input" 
                            value={companySettings.latitude}
                            onChange={(e) => setCompanySettings({ ...companySettings, latitude: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Office Longitude</label>
                          <input 
                            type="number" 
                            step="any" 
                            className="form-input" 
                            value={companySettings.longitude}
                            onChange={(e) => setCompanySettings({ ...companySettings, longitude: e.target.value })}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDetectAdminLocation}
                        style={{
                          ...styles.cancelBtn,
                          padding: '10px 14px',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: '100%',
                          marginTop: -4,
                          marginBottom: 16
                        }}
                      >
                        <RefreshCcw size={14} /> Detect & Use My Current GPS Location
                      </button>

                      <div className="form-group">
                        <label className="form-label">Allowed Geofence Radius (Meters)</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={companySettings.allowedRadius}
                          onChange={(e) => setCompanySettings({ ...companySettings, allowedRadius: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Corporate Currency</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={companySettings.currency}
                            onChange={(e) => setCompanySettings({ ...companySettings, currency: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Target Timezone</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={companySettings.timezone}
                            onChange={(e) => setCompanySettings({ ...companySettings, timezone: e.target.value })}
                          />
                        </div>
                      </div>

                      <button type="submit" style={styles.addBtn}>
                        Save Geofencing Rules
                      </button>
                    </form>

                    {/* Payroll Deduction Policies Form */}
                    <form className="glass" onSubmit={handleSaveSalaryRules} style={{ padding: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--brand-primary)' }}>Salary & Deduction Formulas</h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Late Penalty Rate (Amt/Min)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.latePenaltyRate}
                            onChange={(e) => setSalaryRules({ ...salaryRules, latePenaltyRate: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Half-Day Deduction Rate (%)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.halfDayDeductionRate}
                            onChange={(e) => setSalaryRules({ ...salaryRules, halfDayDeductionRate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Absent Deduction Rate (%)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.absentDeductionRate}
                            onChange={(e) => setSalaryRules({ ...salaryRules, absentDeductionRate: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Overtime Hourly Multiplier (x)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.overtimeMultiplier}
                            onChange={(e) => setSalaryRules({ ...salaryRules, overtimeMultiplier: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">PF Contribution Rate (%)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.pfRate}
                            onChange={(e) => setSalaryRules({ ...salaryRules, pfRate: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">ESI Contribution Rate (%)</label>
                          <input 
                            type="number" 
                            step="any"
                            className="form-input" 
                            value={salaryRules.esiRate}
                            onChange={(e) => setSalaryRules({ ...salaryRules, esiRate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Monthly Bonus / Allowances</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={salaryRules.bonusAmount}
                          onChange={(e) => setSalaryRules({ ...salaryRules, bonusAmount: e.target.value })}
                        />
                      </div>

                      <button type="submit" style={styles.addBtn}>
                        Save Salary Rules
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ADMIN TAB 7: AUDIT LOGS */}
              {adminTab === 'logs' && (
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>System Audit Logs</h2>
                  
                  <div className="table-container glass">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Operator</th>
                          <th>Action Trigger</th>
                          <th>Incident details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No system audits logged.</td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td style={{ fontWeight: 600 }}>{log.user.email || log.user.phone}</td>
                              <td style={{ fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{log.action}</td>
                              <td>{log.details}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* GLOBAL LOADING OVERLAY */}
      {isLoading && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass" style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-primary)' }} />
            <span style={{ fontWeight: 600 }}>Processing...</span>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      <div style={{ position: 'fixed', bottom: 80, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 18px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
            maxWidth: 360,
            backgroundColor: t.type === 'success' ? 'var(--success)' : t.type === 'error' ? 'var(--error)' : 'var(--brand-primary)',
            color: 'white',
            animation: 'slideInRight 0.3s ease'
          }}>
            {t.type === 'success' ? <CheckCircle2 size={16} /> : t.type === 'error' ? <AlertCircle size={16} /> : <Bell size={16} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL */}
      {confirmModal?.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <AlertCircle size={22} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 15, lineHeight: 1.6 }}>{confirmModal.message}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={styles.cancelBtn}>Cancel</button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                style={{ ...styles.addBtn, backgroundColor: 'var(--error)' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BIOMETRICS VIDEO CAPTURE OVERLAY */}
      {scannerOpen && (
        <FaceScanner
          mode={scannerAction}
          onScanComplete={handleScanComplete}
          onCancel={() => {
            setScannerOpen(false);
            setPendingPunchType(null);
          }}
        />
      )}

      {/* ADMIN DIALOG MODALS */}
      {/* 1. Add/Edit Employee Modal */}
      {empModalOpen && (
        <div style={styles.modalOverlay}>
          <div className="glass" style={styles.modalContent}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {editingEmp ? 'Modify Employee Profile' : 'Enroll New Employee'}
            </h3>
            
            <form onSubmit={handleSaveEmployee}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={empFormId} 
                    onChange={(e) => setEmpFormId(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Base Salary (/Mo)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={empFormSalary} 
                    onChange={(e) => setEmpFormSalary(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={empFormFirst} 
                    onChange={(e) => setEmpFormFirst(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={empFormLast} 
                    onChange={(e) => setEmpFormLast(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Registered Phone Number</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={empFormPhone} 
                  onChange={(e) => setEmpFormPhone(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={empFormEmail} 
                  onChange={(e) => setEmpFormEmail(e.target.value)} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select value={empFormDept} onChange={(e) => setEmpFormDept(e.target.value)} style={styles.selectInput} required>
                    {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Active Shift</label>
                  <select value={empFormShift} onChange={(e) => setEmpFormShift(e.target.value)} style={styles.selectInput} required>
                    {shiftsList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                  </select>
                </div>
              </div>

              {editingEmp && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={editingEmp.active}
                      onChange={(e) => setEditingEmp({ ...editingEmp, active: e.target.checked })} 
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setEmpModalOpen(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.addBtn}>
                  Save Employee Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Holiday Modal */}
      {holidayFormOpen && (
        <div style={styles.modalOverlay}>
          <div className="glass" style={styles.modalContent}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Configure Corporate Holiday</h3>
            
            <form onSubmit={handleAddHoliday}>
              <div className="form-group">
                <label className="form-label">Holiday Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={holidayFormName} 
                  onChange={(e) => setHolidayFormName(e.target.value)} 
                  placeholder="e.g. Independence Day"
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Holiday Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={holidayFormDate} 
                    onChange={(e) => setHolidayFormDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Holiday Type</label>
                  <select value={holidayFormType} onChange={(e) => setHolidayFormType(e.target.value)} style={styles.selectInput} required>
                    <option value="NATIONAL">National Holiday</option>
                    <option value="COMPANY">Company Holiday</option>
                    <option value="FESTIVAL">Festival Holiday</option>
                    <option value="EMERGENCY">Emergency Holiday</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  value={holidayFormDesc} 
                  onChange={(e) => setHolidayFormDesc(e.target.value)} 
                  placeholder="Brief context..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setHolidayFormOpen(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.addBtn}>
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topHeader: {
    height: 60,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    borderRadius: '0',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--brand-gradient)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 800,
    fontSize: 16
  },
  headerUserTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'var(--bg-tertiary)',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid var(--glass-border)'
  },
  themeToggle: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 6
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  authWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    padding: 32
  },
  authHeader: {
    textAlign: 'center',
    marginBottom: 24
  },
  authTabSelector: {
    display: 'flex',
    borderBottom: '1px solid var(--glass-border)',
    marginBottom: 24
  },
  authTab: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    paddingBottom: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  authSubmitBtn: {
    width: '100%',
    padding: '12px 20px',
    background: 'var(--brand-gradient)',
    border: 'none',
    color: 'white',
    fontWeight: 700,
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-glow)',
    transition: 'all 0.2s'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--error-glow)',
    color: 'var(--error)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 16
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--success-glow)',
    color: 'var(--success)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 16
  },
  otpPromptBox: {
    padding: 12,
    marginTop: 10,
    marginBottom: 16,
    borderLeft: '4px solid var(--success)',
    borderRadius: '0 8px 8px 0'
  },
  employeeTimeBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 16px',
    borderBottom: '1px solid var(--glass-border)'
  },
  punchStatusCard: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden'
  },
  punchIndicatorGlow: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationSimulatorBox: {
    padding: 10,
    marginTop: 14,
    borderLeft: '3px solid var(--brand-primary)',
    borderRadius: '0 6px 6px 0',
    backgroundColor: 'rgba(6, 182, 212, 0.05)'
  },
  punchButton: {
    flex: 1,
    padding: '14px 20px',
    border: 'none',
    color: 'white',
    fontWeight: 700,
    borderRadius: 10,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  metricRingContainer: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    border: '6px solid var(--bg-tertiary)',
    borderTopColor: 'var(--brand-primary)',
    margin: '12px auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    marginTop: 5,
    flexShrink: 0
  },
  historyCard: {
    padding: 14
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase'
  },
  selectInput: {
    width: '100%',
    padding: '11px 14px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-primary)',
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer'
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto'
  },
  profileMetaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid var(--glass-border)'
  },
  profileMetaLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12
  },
  addBtn: {
    padding: '10px 18px',
    backgroundColor: 'var(--brand-primary)',
    border: 'none',
    color: 'white',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4
  },
  actionApproveBtn: {
    padding: '4px 10px',
    backgroundColor: 'var(--brand-primary)',
    border: 'none',
    color: 'white',
    fontSize: 11,
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600
  },
  actionRejectBtn: {
    padding: '4px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    color: 'var(--error)',
    fontSize: 11,
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600
  },
  chartContainer: {
    height: 200,
    width: '100%'
  },
  chartProgressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 3,
    overflow: 'hidden'
  },
  chartProgressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    padding: 24,
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  cancelBtn: {
    padding: '10px 18px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer'
  }
};
