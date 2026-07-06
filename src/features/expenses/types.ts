export interface ExpenseCategory {
  id: string;
  name: string;
  is_default: number;
  created_at: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string | null;
  amount: number;
  date: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
}

export interface NetSummaryExpenseLine {
  category: string;
  total: number;
}

export interface NetSummary {
  revenue: number;
  expenses: NetSummaryExpenseLine[];
  totalExpenses: number;
  purchasesPaid: number;
  salaries: number;
  net: number;
}
