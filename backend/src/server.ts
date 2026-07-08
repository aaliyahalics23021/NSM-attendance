import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Route Imports
import authRoutes from './routes/auth.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import holidayRoutes from './routes/holiday.routes';
import payrollRoutes from './routes/payroll.routes';
import companyRoutes from './routes/company.routes';
import employeeRoutes from './routes/employee.routes';

// Load env configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS with support for local dev configurations
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set parsing size limits high to allow base64 selfie upload data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Log incoming request paths for debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Register REST API Route endpoints
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/holiday', holidayRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employee', employeeRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global Fallback Error Handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start Express server binding
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` AttendX Backend running on: http://localhost:${PORT} `);
  console.log(`===============================================`);
});
