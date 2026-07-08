import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    companyId: string;
    employeeId?: string; // only if role is EMPLOYEE
  };
}
