"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Route Imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const leave_routes_1 = __importDefault(require("./routes/leave.routes"));
const holiday_routes_1 = __importDefault(require("./routes/holiday.routes"));
const payroll_routes_1 = __importDefault(require("./routes/payroll.routes"));
const company_routes_1 = __importDefault(require("./routes/company.routes"));
// Load env configuration
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Enable CORS with support for local dev configurations
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Set parsing size limits high to allow base64 selfie upload data
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Log incoming request paths for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Register REST API Route endpoints
app.use('/api/auth', auth_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/leave', leave_routes_1.default);
app.use('/api/holiday', holiday_routes_1.default);
app.use('/api/payroll', payroll_routes_1.default);
app.use('/api/company', company_routes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});
// Global Fallback Error Handler middleware
app.use((err, req, res, next) => {
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
