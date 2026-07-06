import type { UserRole } from "@/lib/types";

export type SalaryType = "monthly" | "weekly";

export interface Employee {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  salaryType: SalaryType;
  dailyHours: number;
  createdAt: string | null;
  currentSalary: number | null;
}

export interface SalaryHistoryRecord {
  id: string;
  userId: string;
  amount: number;
  effectiveFrom: string;
  createdAt: string;
  notes: string | null;
}

export interface ShiftSalaryDetail {
  shiftId: string;
  date: string;
  hours: number;
  salary: number;
  hourlyRate: number;
  earned: number;
}

export interface SalarySummary {
  userId: string;
  from: string;
  to: string;
  totalHours: number;
  totalEarned: number;
  salaryType: SalaryType;
  dailyHours: number;
  shifts: ShiftSalaryDetail[];
}
