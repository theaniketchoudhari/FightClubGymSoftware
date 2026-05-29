export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  adminId?: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string;
  planId: string;
  planName: string;
  planPrice: number;
  joinDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  paymentStatus: 'paid' | 'pending';
  qrCode: string;
  role: 'member' | 'admin';
  lastPaymentDate?: string;
  autoReminderSent?: boolean;
  adminId?: string;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  planName: string;
  adminId?: string;
}

export interface Attendance {
  id: string;
  memberId: string;
  date: string;
  timestamp: string;
  adminId?: string;
}

export interface Workout {
  id: string;
  memberId: string;
  date: string;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
  notes?: string;
  adminId?: string;
}

export interface HealthStat {
  id: string;
  memberId: string;
  date: string;
  weight: number;
  bodyFat?: number;
  muscleMass?: number;
  adminId?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  description?: string;
  type: 'income' | 'expense';
  adminId?: string;
}
