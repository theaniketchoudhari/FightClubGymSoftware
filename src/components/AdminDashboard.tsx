import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, setDoc, doc, deleteDoc, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { Member, Payment, Attendance, MembershipPlan, Expense } from '../types';
import { handleFirestoreError, OperationType } from '../errorUtils';
import { 
  Users, CreditCard, Calendar, BarChart3, Settings, 
  Plus, Search, Bell, LogOut, CheckCircle2, XCircle, 
  TrendingUp, UserPlus, QrCode, X, Wallet, Clock,
  ChevronRight, MoreVertical, Trash2, Edit2, Check, Award,
  MessageSquare, ArrowUpRight, ArrowDownRight, Shield,
  FileText, Printer, Download, Share2, Phone, RefreshCw,
  CalendarDays, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, addMonths, differenceInDays, differenceInMonths, differenceInYears, differenceInSeconds, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isSameDay, isSameMonth, isSameYear, subDays, subMonths, subYears, isAfter, isBefore } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { signOut } from 'firebase/auth';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const CountdownTimer = ({ expiryDate }: { expiryDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = differenceInSeconds(new Date(expiryDate), new Date());
      setTimeLeft(seconds > 0 ? seconds : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryDate]);

  if (timeLeft <= 0) return <span className="text-red-600 font-bold">Expired</span>;

  const days = Math.floor(timeLeft / (24 * 3600));
  const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex gap-1 text-[10px] font-mono font-bold">
      <div className="bg-slate-100 px-1 rounded text-slate-700">{days}d</div>
      <div className="bg-slate-100 px-1 rounded text-slate-700">{hours}h</div>
      <div className="bg-slate-100 px-1 rounded text-slate-700">{minutes}m</div>
      <div className="bg-blue-100 px-1 rounded text-blue-600 animate-pulse">{seconds}s</div>
    </div>
  );
};

export default function AdminDashboard({ user, memberData }: { user: any, memberData: any }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);

  
  const [newMember, setNewMember] = useState({ name: '', phone: '', planId: '', isTest: false });
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, durationDays: 30 });
  const [revenueTimeScale, setRevenueTimeScale] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [remindedMembers, setRemindedMembers] = useState<Set<string>>(new Set());
  const [expiryAlert, setExpiryAlert] = useState<Member | null>(null);
  const [automationSuccess, setAutomationSuccess] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ title: '', amount: 0, category: 'Other', type: 'expense' });
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [selectedInvoiceMember, setSelectedInvoiceMember] = useState<Member | null>(null);
  const [selectedRenewMember, setSelectedRenewMember] = useState<Member | null>(null);
  const [selectedCalendarMember, setSelectedCalendarMember] = useState<Member | null>(null);
  const [renewPlanId, setRenewPlanId] = useState<string>('');
  const [renewStatus, setRenewStatus] = useState<'paid' | 'pending'>('paid');
  const [renewStartChoice, setRenewStartChoice] = useState<'today' | 'extend'>('today');

  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [editInvoiceName, setEditInvoiceName] = useState('');
  const [editInvoicePhone, setEditInvoicePhone] = useState('');
  const [editInvoicePlanName, setEditInvoicePlanName] = useState('');
  const [editInvoicePlanPrice, setEditInvoicePlanPrice] = useState<number>(0);
  const [editInvoiceJoinDate, setEditInvoiceJoinDate] = useState('');
  const [editInvoiceExpiryDate, setEditInvoiceExpiryDate] = useState('');
  const [editInvoicePaymentStatus, setEditInvoicePaymentStatus] = useState<'paid' | 'pending'>('paid');

  const [showRevenueCalendar, setShowRevenueCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'member' | 'expense' | 'plan' } | null>(null);

  useEffect(() => {
    if (selectedInvoiceMember) {
      setIsEditingInvoice(false);
      setEditInvoiceName(selectedInvoiceMember.name || '');
      setEditInvoicePhone(selectedInvoiceMember.phone || '');
      setEditInvoicePlanName(selectedInvoiceMember.planName || '');
      setEditInvoicePlanPrice(selectedInvoiceMember.planPrice || 0);
      setEditInvoiceJoinDate(selectedInvoiceMember.joinDate ? selectedInvoiceMember.joinDate.substring(0, 10) : '');
      setEditInvoiceExpiryDate(selectedInvoiceMember.expiryDate ? selectedInvoiceMember.expiryDate.substring(0, 10) : '');
      setEditInvoicePaymentStatus(selectedInvoiceMember.paymentStatus || 'paid');
    }
  }, [selectedInvoiceMember]);

  const handleSaveInvoiceChanges = async () => {
    if (!selectedInvoiceMember) return;
    try {
      const updatedData = {
        name: editInvoiceName,
        phone: editInvoicePhone,
        planName: editInvoicePlanName,
        planPrice: Number(editInvoicePlanPrice),
        joinDate: new Date(editInvoiceJoinDate).toISOString(),
        expiryDate: new Date(editInvoiceExpiryDate).toISOString(),
        paymentStatus: editInvoicePaymentStatus
      };
      await updateDoc(doc(db, 'members', selectedInvoiceMember.id), updatedData);
      
      const updatedMember = {
        ...selectedInvoiceMember,
        ...updatedData
      };
      setSelectedInvoiceMember(updatedMember);
      setIsEditingInvoice(false);
    } catch (error) {
      console.error("Error saving invoice changes:", error);
    }
  };

  useEffect(() => {
    if (selectedRenewMember) {
      setRenewPlanId(selectedRenewMember.planId || '');
      setRenewStatus('paid');
      const hasExpired = isBefore(new Date(selectedRenewMember.expiryDate), new Date());
      setRenewStartChoice(hasExpired ? 'today' : 'extend');
    }
  }, [selectedRenewMember]);

  useEffect(() => {
    // Listen for background automation notifications
    const qNotifications = query(
      collection(db, 'notifications'), 
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          // Only show if it's recent (within last 10 seconds)
          if (data.timestamp && (Date.now() - data.timestamp.toMillis() < 10000)) {
            setAutomationSuccess(data.message);
            setTimeout(() => setAutomationSuccess(null), 5000);
          }
        }
      });
    });

    return () => unsubscribeNotifications();
  }, []);

  useEffect(() => {
    const qMembers = query(collection(db, 'members'), orderBy('joinDate', 'desc'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    });

    const qPayments = query(collection(db, 'payments'), orderBy('date', 'desc'));
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const qAttendance = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    });

    const qPlans = query(collection(db, 'plans'), orderBy('name', 'asc'));
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MembershipPlan)));
    });

    const qExpenses = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });

    return () => {
      unsubscribeMembers();
      unsubscribePayments();
      unsubscribeAttendance();
      unsubscribePlans();
      unsubscribeExpenses();
    };
  }, []);

  useEffect(() => {
    if (!members || members.length === 0) return;

    const checkExpirations = async () => {
      // Avoid parallel updates for same member
      const now = new Date();
      for (const member of members) {
        if (member.status === 'active') {
          const expiry = new Date(member.expiryDate);
          if (expiry <= now) {
            console.log(`[Client Automation] Member ${member.name} expired. Updating status...`);
            try {
              // Update status and autoReminderSent in Firestore
              await updateDoc(doc(db, 'members', member.id), {
                status: 'expired',
                autoReminderSent: true
              });

              // Create a notification for the admin dashboard
              await addDoc(collection(db, 'notifications'), {
                type: 'whatsapp_sent',
                memberName: member.name,
                memberPhone: member.phone,
                timestamp: serverTimestamp(),
                message: `Auto-reminder sent successfully to ${member.name}`
              });
            } catch (err) {
              console.error("[Client Automation Error]:", err);
            }
          }
        }
      }
    };

    checkExpirations();
    const interval = setInterval(checkExpirations, 30000);
    return () => clearInterval(interval);
  }, [members]);



  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlan = plans.find(p => p.id === newMember.planId);
    if (!selectedPlan) return;

    const id = Math.random().toString(36).substring(7);
    const joinDate = new Date().toISOString();
    const expiryDate = newMember.isTest 
      ? addDays(new Date(), 0.002).toISOString() // ~3 minutes
      : addDays(new Date(), selectedPlan.durationDays).toISOString();
    
    const member: Member = {
      id,
      name: newMember.name,
      phone: newMember.phone,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      planPrice: selectedPlan.price,
      joinDate,
      expiryDate,
      status: 'active',
      paymentStatus: 'pending',
      autoReminderSent: false,
      qrCode: Math.random().toString(36).substring(7),
      role: 'member',
      lastPaymentDate: joinDate
    };

    try {
      await setDoc(doc(db, 'members', id), member);
      
      // Create initial payment record as pending
      await addDoc(collection(db, 'payments'), {
        memberId: id,
        memberName: member.name,
        amount: selectedPlan.price,
        date: joinDate,
        status: 'pending',
        planName: selectedPlan.name
      });

      setShowAddMember(false);
      setNewMember({ name: '', phone: '', planId: '', isTest: false });
      setSelectedInvoiceMember(member);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `members/${id}`);
    }
  };

  const handleCreateDemoMember = async () => {
    const selectedPlan = plans[0] || { id: 'demo', name: 'Demo Plan', price: 99, durationDays: 0.002 }; // ~3 mins
    const id = 'demo-' + Math.random().toString(36).substring(7);
    const joinDate = new Date().toISOString();
    const expiryDate = addDays(new Date(), 0.002).toISOString(); // 3 minutes
    
    const member: Member = {
      id,
      name: 'Demo Member (3 Mins)',
      phone: '911234567890',
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      planPrice: selectedPlan.price,
      joinDate,
      expiryDate,
      status: 'active',
      paymentStatus: 'pending',
      autoReminderSent: false,
      qrCode: 'demo-' + id,
      role: 'member',
      lastPaymentDate: joinDate
    };

    try {
      await setDoc(doc(db, 'members', id), member);
      await addDoc(collection(db, 'payments'), {
        memberId: id,
        memberName: member.name,
        amount: selectedPlan.price,
        date: joinDate,
        status: 'pending',
        planName: selectedPlan.name
      });
      alert('Demo member created! Expiry in 3 minutes.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `members/${id}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'plans', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `plans/${id}`);
    }
  };

  const handleMarkAsPaid = async (paymentId: string, memberId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), { status: 'paid' });
      await updateDoc(doc(db, 'members', memberId), { paymentStatus: 'paid' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substring(7);
    try {
      await setDoc(doc(db, 'plans', id), { ...newPlan, id });
      setShowAddPlan(false);
      setNewPlan({ name: '', price: 0, durationDays: 30 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `plans/${id}`);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenewMember) return;
    const selectedPlan = plans.find(p => p.id === renewPlanId);
    if (!selectedPlan) {
      alert('Selected plan not found. Please select a valid plan.');
      return;
    }

    const nowStr = new Date().toISOString();
    // Choose starting point: today or extend from existing expiry date
    const startDay = renewStartChoice === 'today' 
      ? new Date() 
      : new Date(selectedRenewMember.expiryDate);
    
    // Calculate new expiryDate
    const newExpiryDate = addDays(startDay, selectedPlan.durationDays).toISOString();

    try {
      const updatedMember: Member = {
        ...selectedRenewMember,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planPrice: selectedPlan.price,
        joinDate: nowStr, // We update join date as the start of the new paid cycle
        expiryDate: newExpiryDate,
        status: 'active',
        paymentStatus: renewStatus,
        lastPaymentDate: renewStatus === 'paid' ? nowStr : (selectedRenewMember.lastPaymentDate || nowStr),
        autoReminderSent: false
      };

      // 1. Update member document in Firestore
      await setDoc(doc(db, 'members', selectedRenewMember.id), updatedMember);

      // 2. Add an explicit payment transaction to register instant check
      await addDoc(collection(db, 'payments'), {
        memberId: selectedRenewMember.id,
        memberName: selectedRenewMember.name,
        amount: selectedPlan.price,
        date: nowStr,
        status: renewStatus,
        planName: selectedPlan.name
      });

      // 3. Clear the renewal modal state
      setSelectedRenewMember(null);

      // 4. Automatically trigger the PDF bill showing modal!
      setSelectedInvoiceMember(updatedMember);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `members/${selectedRenewMember.id}`);
    }
  };

  const handleQuickPaidRenew = async (member: Member) => {
    const selectedPlan = plans.find(p => p.id === member.planId) || plans[0];
    if (!selectedPlan) {
      alert('No plans configured. Please add a membership plan first.');
      return;
    }
    const nowStr = new Date().toISOString();
    const startDay = new Date();
    const newExpiryDate = addDays(startDay, selectedPlan.durationDays).toISOString();

    try {
      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planPrice: selectedPlan.price,
        joinDate: nowStr,
        expiryDate: newExpiryDate,
        status: 'active',
        paymentStatus: 'paid',
        lastPaymentDate: nowStr,
        autoReminderSent: false
      };

      await setDoc(doc(db, 'members', member.id), updatedMember);

      await addDoc(collection(db, 'payments'), {
        memberId: member.id,
        memberName: member.name,
        amount: selectedPlan.price,
        date: nowStr,
        status: 'paid',
        planName: selectedPlan.name
      });

      setSelectedInvoiceMember(updatedMember);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `members/${member.id}`);
    }
  };

  const sendWhatsApp = (member: Member) => {
    const invoiceUrl = `${window.location.origin}/api/invoices/${member.id}`;
    const message = `🥋 *FIGHT CLUB GYM* 🥋\n\nHi ${member.name}, your membership for ${member.planName} is active/expired. Please find below your official invoice link.\n\n📥 *Digital Invoice (PDF):* ${invoiceUrl}\n\nContact Gym Owner (Akshay Choudhari) at +91 83086 28416 for any queries. Keep training!`;
    window.open(`https://wa.me/${member.phone}?text=${encodeURIComponent(message)}`);
  };

  const now = new Date();
  const expiredUnpaidMembers = members.filter(m => {
    const isExpired = isBefore(new Date(m.expiryDate), now) || m.status === 'expired';
    if (!isExpired) return false;
    // Check if they already have a pending payment in the database to avoid duplicate count
    const hasPendingPayment = payments.some(p => p.memberId === m.id && p.status === 'pending');
    return !hasPendingPayment;
  });

  const stats = {
    totalMembers: members.length,
    activeMembers: members.filter(m => isAfter(new Date(m.expiryDate), now)).length,
    expiredMembers: members.filter(m => isBefore(new Date(m.expiryDate), now) || m.status === 'expired').length,
    monthlyRevenue: payments
      .filter(p => p.status === 'paid' && isSameMonth(new Date(p.date), now))
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    pendingBills: payments.filter(p => p.status === 'pending').length + expiredUnpaidMembers.length
  };

  const escapeCSV = (val: any) => {
    if (val === undefined || val === null) return '';
    let str = String(val);
    str = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const triggerCSVDownload = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadMembersCSV = () => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Plan ID', 'Plan Name', 'Plan Price', 'Join Date', 'Expiry Date', 'Status', 'Payment Status', 'Last Payment Date'];
    const rows = members.map(m => [
      m.id,
      m.name,
      m.phone,
      m.email || '',
      m.planId,
      m.planName,
      m.planPrice,
      m.joinDate,
      m.expiryDate,
      m.status,
      m.paymentStatus,
      m.lastPaymentDate || ''
    ]);
    triggerCSVDownload('gym_members_backup.csv', headers, rows);
  };

  const downloadRevenueCSV = () => {
    const headers = ['Payment ID', 'Member ID', 'Member Name', 'Plan Name', 'Amount Paid', 'Payment Date'];
    const rows = payments.filter(p => p.status === 'paid').map(p => [
      p.id,
      p.memberId,
      p.memberName,
      p.planName,
      p.amount,
      p.date
    ]);
    triggerCSVDownload('gym_revenue_history_backup.csv', headers, rows);
  };

  const downloadPendingBillsCSV = () => {
    const headers = ['Type', 'Name', 'Phone', 'Plan Name', 'Amount Due', 'Date Generated / Expired'];
    const rows1 = payments.filter(p => p.status === 'pending').map(p => {
      const m = members.find(mem => mem.id === p.memberId);
      return [
        'Pending Bill',
        p.memberName,
        m?.phone || '',
        p.planName,
        p.amount,
        p.date
      ];
    });
    const rows2 = expiredUnpaidMembers.map(m => [
      'Subscription Expired (Dues Outstanding)',
      m.name,
      m.phone,
      m.planName,
      m.planPrice,
      m.expiryDate
    ]);
    triggerCSVDownload('gym_pending_bills_backup.csv', headers, [...rows1, ...rows2]);
  };

  const downloadExpensesCSV = () => {
    const headers = ['Record ID', 'Date', 'Title', 'Category', 'Amount', 'Description'];
    const rows = expenses.filter(e => e.type === 'expense').map(e => [
      e.id,
      e.date,
      e.title,
      e.category,
      e.amount,
      e.description || ''
    ]);
    triggerCSVDownload('personal_expenses_backup.csv', headers, rows);
  };

  const downloadPlansCSV = () => {
    const headers = ['Plan ID', 'Plan Name', 'Price', 'Duration (Days)'];
    const rows = plans.map(p => [
      p.id,
      p.name,
      p.price,
      p.durationDays
    ]);
    triggerCSVDownload('membership_plans_backup.csv', headers, rows);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substring(7);
    try {
      await setDoc(doc(db, 'expenses', id), {
        ...newExpense,
        id,
        date: new Date().toISOString()
      });
      setShowAddExpense(false);
      setNewExpense({ title: '', amount: 0, category: 'Other', type: 'expense' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `expenses/${id}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const filteredMembers = members.filter(m => {
    if (memberFilter === 'all') return true;
    if (memberFilter === 'active') return isAfter(new Date(m.expiryDate), new Date());
    if (memberFilter === 'expired') return isBefore(new Date(m.expiryDate), new Date());
    return true;
  });

  const getRevenueData = () => {
    const now = new Date();
    if (revenueTimeScale === 'daily') {
      // Show last 30 days
      return Array.from({ length: 30 }).map((_, i) => {
        const date = subDays(now, 29 - i);
        const amount = payments
          .filter(p => p.status === 'paid' && isSameDay(new Date(p.date), date))
          .reduce((acc, p) => acc + p.amount, 0);
        return { name: format(date, 'MMM dd'), amount };
      });
    } else if (revenueTimeScale === 'monthly') {
      // Show all months since the first payment, or at least 12 months
      const oldestDate = payments.length > 0 
        ? new Date(Math.min(...payments.map(p => new Date(p.date).getTime())))
        : subMonths(now, 11);
      
      const monthsCount = Math.max(12, differenceInMonths(now, oldestDate) + 1);
      
      return Array.from({ length: monthsCount }).map((_, i) => {
        const date = subMonths(now, (monthsCount - 1) - i);
        const amount = payments
          .filter(p => p.status === 'paid' && isSameMonth(new Date(p.date), date))
          .reduce((acc, p) => acc + p.amount, 0);
        return { name: format(date, 'MMM yyyy'), amount };
      });
    } else {
      // Yearly - show all years since first payment, or at least 3 years
      const oldestDate = payments.length > 0 
        ? new Date(Math.min(...payments.map(p => new Date(p.date).getTime())))
        : subYears(now, 2);
      
      const yearsCount = Math.max(3, differenceInYears(now, oldestDate) + 1);

      return Array.from({ length: yearsCount }).map((_, i) => {
        const date = subYears(now, (yearsCount - 1) - i);
        const amount = payments
          .filter(p => p.status === 'paid' && isSameYear(new Date(p.date), date))
          .reduce((acc, p) => acc + p.amount, 0);
        return { name: format(date, 'yyyy'), amount };
      });
    }
  };

  const revenueData = getRevenueData();

  const renderSidebarContent = (isMobile: boolean) => {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src="https://iili.io/Cd4Knae.md.png" 
                alt="Fight Club Logo" 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-cover rounded-full" 
              />
            </div>
            <span className="font-bold text-xl text-slate-900">Fight Club</span>
          </div>
          {isMobile && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer lg:hidden border border-slate-100 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {[
            { id: 'overview', icon: BarChart3, label: 'Overview' },
            { id: 'members', icon: Users, label: 'Members' },
            { id: 'plans', icon: Settings, label: 'Plans' },
            { id: 'payments', icon: CreditCard, label: 'Revenue' },
            { id: 'pending', icon: Clock, label: 'Pending Bills' },
            { id: 'vault', icon: Shield, label: 'Personal Vault' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (isMobile) setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-600 font-bold' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}

          {/* Backup Data Section */}
          <div className="mt-8 pt-6 border-t border-slate-100 px-2 pb-4">
            <div className="flex items-center gap-1.5 px-2 mb-3">
              <Download className="w-4 h-4 text-blue-600 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CSV Backups</p>
            </div>
            <div className="space-y-1.5">
              <button 
                onClick={() => {
                  downloadMembersCSV();
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 p-2.5 rounded-xl transition-all border border-slate-100 flex items-center gap-2 cursor-pointer shadow-sm bg-white hover:border-blue-200"
                title="Backup Gym Members"
              >
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Members List</span>
              </button>
              <button 
                onClick={() => {
                  downloadRevenueCSV();
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 p-2.5 rounded-xl transition-all border border-slate-100 flex items-center gap-2 cursor-pointer shadow-sm bg-white hover:border-blue-200"
                title="Backup Revenue History"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Revenue History</span>
              </button>
              <button 
                onClick={() => {
                  downloadPendingBillsCSV();
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 p-2.5 rounded-xl transition-all border border-slate-100 flex items-center gap-2 cursor-pointer shadow-sm bg-white hover:border-blue-200"
                title="Backup Pending Outstanding bills"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Pending Bills</span>
              </button>
              <button 
                onClick={() => {
                  downloadExpensesCSV();
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 p-2.5 rounded-xl transition-all border border-slate-100 flex items-center gap-2 cursor-pointer shadow-sm bg-white hover:border-blue-200"
                title="Backup Personal Expenses"
              >
                <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Personal Expenses</span>
              </button>
              <button 
                onClick={() => {
                  downloadPlansCSV();
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 p-2.5 rounded-xl transition-all border border-slate-100 flex items-center gap-2 cursor-pointer shadow-sm bg-white hover:border-blue-200"
                title="Backup Membership Plans"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Membership Plans</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              AC
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">Akshay Choudhari</p>
              <p className="text-[10px] text-slate-500 truncate">Gym Owner • Admin Panel</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay with Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-white z-50 flex flex-col shadow-2xl lg:hidden"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0 animate-fade-in">
        {renderSidebarContent(false)}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        {/* Mobile Top Header Bar */}
        <div className="flex lg:hidden items-center justify-between p-4 bg-white border-b border-slate-200 mb-6 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 cursor-pointer flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shadow-sm">
                <img 
                  src="https://iili.io/Cd4Knae.md.png" 
                  alt="Fight Club Logo" 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover rounded-full" 
                />
              </div>
              <span className="font-bold text-lg text-slate-900 leading-none">Fight Club</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAddMember(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-all shadow-md shadow-blue-200 flex items-center justify-center cursor-pointer"
              title="Add Member"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome, Akshay Choudhari</h1>
            <p className="text-sm sm:text-base text-slate-500">Manage your gym operations efficiently</p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button 
              onClick={() => setShowAddMember(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 w-full sm:w-auto cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Add Member
            </button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', filter: 'all', action: null },
                { label: 'Active Members', value: stats.activeMembers, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'active', action: null },
                { label: 'Subscription Ends', value: stats.expiredMembers, icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-50', filter: 'expired', action: null },
                { label: 'Monthly Revenue', value: `₹${stats.monthlyRevenue}`, icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', filter: null, action: () => setShowRevenueCalendar(true) },
                { label: 'Pending Bills', value: stats.pendingBills, icon: Clock, color: 'text-red-600', bg: 'bg-red-50', filter: null, action: () => setActiveTab('pending') },
              ].map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  onClick={() => {
                    if (stat.filter) {
                      setMemberFilter(stat.filter as any);
                      setActiveTab('members');
                    } else if (stat.action) {
                      stat.action();
                    }
                  }}
                  className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm transition-all cursor-pointer hover:border-blue-500 hover:shadow-md active:scale-95"
                >
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
                  <p className="text-2xl font-bold mt-1 text-slate-900">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Fight Club Intelligence Notifications Terminal */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm text-slate-800 font-sans relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                <Shield className="w-56 h-56 text-blue-500" />
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-600 font-bold">INTELLIGENCE MONITOR ENGINE</span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900 mt-1">Fight Club Intelligence Notifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Automated subscription status monitor & direct WhatsApp reminder integrations</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-3 py-1 rounded bg-slate-50 border border-slate-200 text-slate-500 font-mono font-bold">SYS CORE STATUS: ONLINE</span>
                </div>
              </div>

              {(() => {
                const now = new Date();
                
                // Expiry alerts: expired or ending today
                const endedAlerts = members.filter(m => {
                  const days = differenceInDays(new Date(m.expiryDate), now);
                  return days < 0 || m.status === 'expired';
                });

                // Under Warning alert: ending in <= 3 days (not already expired)
                const warningAlerts = members.filter(m => {
                  const days = differenceInDays(new Date(m.expiryDate), now);
                  return days >= 0 && days <= 3 && m.status === 'active';
                });

                const totalAlerts = endedAlerts.length + warningAlerts.length;

                if (totalAlerts === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500 font-mono text-sm max-w-md mx-auto">
                      <p className="text-emerald-600 font-bold tracking-wider mb-2">● SYSTEM STATE SECURE</p>
                      <p className="text-xs text-slate-400">Every single subscription is active and verified. No expired or expiring members in the next 3 days.</p>
                    </div>
                  );
                }

                return (
                  <div className="mt-6 space-y-4 max-h-[350px] overflow-y-auto pr-2">
                    {/* Render Expired Members */}
                    {endedAlerts.map(m => {
                      const daysAgo = Math.abs(differenceInDays(new Date(m.expiryDate), now));
                      const msgText = `🥋 *FIGHT CLUB GYM - MEMBERSHIP ENDED* 🥋\n\nHi *${m.name}*,\n\nYour subscription for the *${m.planName}* has ended ${daysAgo === 0 ? "today" : `*${daysAgo} days ago*`}.\n\nPlease pay Rs. *${m.planPrice}* to renew your membership and continue your training uninterrupted. Keep grinding! 🥊\n\n📞 Owner Support: Akshay Choudhari (+91 83086 28416)`;
                      return (
                        <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-red-50 border border-red-100 p-5 rounded-2xl hover:border-red-200 transition-all">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 font-black text-sm animate-pulse">
                              !
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-900">{m.name}</span>
                                <span className="text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded border border-red-200 uppercase font-mono tracking-widest">Ended</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                {m.planName} (Rs. {m.planPrice}) • Ended {daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.phone}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                window.open(`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msgText)}`, '_blank');
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Notify Dues
                            </button>
                            <button
                              onClick={() => setSelectedRenewMember(m)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto border border-slate-200"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Renew
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Warning (Ending in 3 days) Members */}
                    {warningAlerts.map(m => {
                      const daysLeft = differenceInDays(new Date(m.expiryDate), now);
                      const msgText = `🥋 *FIGHT CLUB GYM - RENEWAL REMINDER* 🥋\n\nHi *${m.name}*,\n\nYour subscription for the *${m.planName}* is going to end in *${daysLeft === 0 ? "today" : `${daysLeft} days`}.\n\nPlease pay Rs. *${m.planPrice}* to renew early and continue training smoothly without disconnection.\n\nLet's keep the momentum! 🥊\n\n📞 Owner Support: Akshay Choudhari (+91 83086 28416)`;
                      return (
                        <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 p-5 rounded-2xl hover:border-amber-300 transition-all">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 font-black text-sm animate-pulse">
                              ⚠
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-900">{m.name}</span>
                                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200 uppercase font-mono tracking-widest">Ending Soon</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">
                                {m.planName} (Rs. {m.planPrice}) • Ends in {daysLeft === 0 ? "today!" : `${daysLeft} day${daysLeft > 1 ? 's' : ''}`}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.phone}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                window.open(`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msgText)}`, '_blank');
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto"
                            >
                              <MessageSquare className="w-4 h-4 text-slate-950" />
                              Notify Renewal
                            </button>
                            <button
                              onClick={() => setSelectedRenewMember(m)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto border border-slate-200"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Renew
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Charts & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Revenue Overview</h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['daily', 'monthly', 'yearly'] as const).map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setRevenueTimeScale(scale)}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${
                          revenueTimeScale === scale 
                            ? 'bg-white text-blue-600 shadow-sm font-bold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {scale.charAt(0).toUpperCase() + scale.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        interval={revenueTimeScale === 'daily' ? 4 : 'preserveStartEnd'}
                        tick={{ fill: '#64748b' }}
                      />
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        formatter={(val) => [`₹${val}`, 'Revenue']}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]}>
                        {revenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === revenueData.length - 1 ? '#2563eb' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
                <h3 className="text-lg font-bold mb-6 text-slate-900">Recent Check-ins</h3>
                <div className="space-y-6">
                  {attendance.slice(0, 5).map((entry) => {
                    const member = members.find(m => m.id === entry.memberId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                            {member?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{member?.name}</p>
                            <p className="text-xs text-slate-500">{format(new Date(entry.timestamp), 'hh:mm a')}</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Present</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
                <div className="relative w-full sm:w-80 md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search members..." 
                    className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <select 
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value as any)}
                  className="bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">All Members</option>
                  <option value="active">Active Only</option>
                  <option value="expired">Expired Only</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 font-bold">Member</th>
                    <th className="px-6 py-4 font-bold">Plan</th>
                    <th className="px-6 py-4 font-bold">Time Left</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredMembers.map((member) => {
                    const daysLeft = differenceInDays(new Date(member.expiryDate), new Date());
                    const isActive = isAfter(new Date(member.expiryDate), new Date());
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-xs font-bold text-blue-600">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{member.name}</p>
                              <p className="text-xs text-slate-500">{member.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{member.planName}</p>
                          <p className="text-[10px] text-slate-400">₹{member.planPrice}</p>
                        </td>
                        <td className="px-6 py-4">
                          <CountdownTimer expiryDate={member.expiryDate} />
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                            isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {isActive ? 'active' : 'expired'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 px-2">
                             <a 
                               href={`tel:${member.phone}`}
                               className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                               title="Call Member"
                             >
                               <Phone className="w-4 h-4" />
                             </a>
                             <button 
                               onClick={() => setSelectedRenewMember(member)}
                               className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                               title="Renew Subscription Plan"
                             >
                               <RefreshCw className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => setSelectedInvoiceMember(member)}
                               className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                               title="View & Download Invoice"
                             >
                               <FileText className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => sendWhatsApp(member)}
                               className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                               title="Send WhatsApp Reminder"
                             >
                               <MessageSquare className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => setDeleteTarget({ id: member.id, type: 'member' })}
                               className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                               title="Delete Member"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => setSelectedCalendarMember(member)}
                               className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                               title="View Progress Tracker Calendar"
                             >
                               <MoreVertical className="w-4 h-4" />
                             </button>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Membership Plans</h2>
              <button 
                onClick={() => setShowAddPlan(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Create New Plan
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:border-blue-500/50 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                      <Award className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={() => setDeleteTarget({ id: plan.id, type: 'plan' })}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-3xl font-black text-blue-600 mb-4">₹{plan.price}</p>
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Valid for {plan.durationDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Revenue History</h2>
                <p className="text-slate-500 text-sm">Historical overview of all successfully registered gym payments</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Paid Revenue</p>
                <p className="text-4xl font-black text-emerald-600">
                  ₹{payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (Number(p.amount) || 0), 0)}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 font-bold">Date</th>
                    <th className="px-6 py-4 font-bold">Member</th>
                    <th className="px-6 py-4 font-bold">Plan</th>
                    <th className="px-6 py-4 font-bold">Amount</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.filter(p => p.status === 'paid').map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {format(new Date(payment.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        {payment.memberName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {payment.planName}
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-600">
                        ₹{payment.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono">
                          Paid
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pending Bills</h2>
                <p className="text-slate-500 text-sm">Total outstanding amount from pending payments and expired memberships</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Outstanding</p>
                <p className="text-4xl font-black text-red-500">
                  ₹{payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + (Number(p.amount) || 0), 0) + expiredUnpaidMembers.reduce((acc, m) => acc + (Number(m.planPrice) || 0), 0)}
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 font-bold">Member</th>
                    <th className="px-6 py-4 font-bold">Type / Expiry Date</th>
                    <th className="px-6 py-4 font-bold">Plan</th>
                    <th className="px-6 py-4 font-bold">Amount Due</th>
                    <th className="px-6 py-4 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.filter(p => p.status === 'pending').map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{payment.memberName}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        Pending Bill (Generated {format(new Date(payment.date), 'MMM dd, yyyy')})
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {payment.planName}
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        ₹{payment.amount}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleMarkAsPaid(payment.id, payment.memberId)}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          Mark as Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expiredUnpaidMembers.map((member) => (
                    <tr key={`expired-unpaid-${member.id}`} className="bg-orange-50/10">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{member.name}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-red-600 font-bold font-mono">
                        Expired on {format(new Date(member.expiryDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {member.planName} (Renewal Outstanding)
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        ₹{member.planPrice}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedRenewMember(member)}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer"
                        >
                          Renew
                        </button>
                        <button 
                          onClick={() => handleQuickPaidRenew(member)}
                          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          Quick Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm md:col-span-1 max-w-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Total Personal Expenses</p>
                  <h3 className="text-3xl font-black text-red-600">
                    ₹{expenses.filter(e => e.type === 'expense').reduce((acc, e) => acc + (Number(e.amount) || 0), 0)}
                  </h3>
                </div>
                <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-x-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Recent Expenses</h2>
                <button 
                  onClick={() => setShowAddExpense(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Expense
                </button>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 font-bold">Date</th>
                    <th className="px-6 py-4 font-bold">Title</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Amount</th>
                    <th className="px-6 py-4 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenses.filter(e => e.type === 'expense').map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {format(new Date(expense.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{expense.title}</p>
                        {expense.description && <p className="text-xs text-slate-400">{expense.description}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase font-mono">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        -₹{expense.amount}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setDeleteTarget({ id: expense.id, type: 'expense' })}
                          className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modals */}
        <AnimatePresence>
          {deleteTarget && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full relative border border-slate-200 shadow-2xl text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Are you sure?</h4>
                <p className="text-xs text-slate-500 mb-6">
                  This will permanently delete this {deleteTarget.type} from the database. This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-605 bg-white hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const { id, type } = deleteTarget;
                      setDeleteTarget(null);
                      if (type === 'member') {
                        await handleDeleteMember(id);
                      } else if (type === 'expense') {
                        await handleDeleteExpense(id);
                      } else if (type === 'plan') {
                        await handleDeletePlan(id);
                      }
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-red-100"
                  >
                    Yes, Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {showAddMember && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white p-8 rounded-[2.5rem] max-w-md w-full relative border border-slate-200 shadow-2xl"
              >
                <button 
                  onClick={() => setShowAddMember(false)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold mb-6 text-slate-900">Add New Member</h2>
                <form onSubmit={handleAddMember} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={newMember.name}
                      onChange={e => setNewMember({...newMember, name: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Plan</label>
                    <select 
                      required
                      value={newMember.planId}
                      onChange={e => setNewMember({...newMember, planId: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option value="">Choose a plan...</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <input 
                      type="checkbox"
                      id="isTest"
                      checked={newMember.isTest}
                      onChange={e => setNewMember({...newMember, isTest: e.target.checked})}
                      className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isTest" className="text-sm font-bold text-blue-900">
                      Test Member (3 Minute Expiry)
                    </label>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl mt-4 transition-all shadow-lg shadow-blue-200"
                  >
                    Register Member
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showAddPlan && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white p-8 rounded-[2.5rem] max-w-md w-full relative border border-slate-200 shadow-2xl"
              >
                <button 
                  onClick={() => setShowAddPlan(false)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold mb-6 text-slate-900">Create Membership Plan</h2>
                <form onSubmit={handleAddPlan} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Plan Name</label>
                    <input 
                      required
                      type="text" 
                      value={newPlan.name}
                      onChange={e => setNewPlan({...newPlan, name: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. Monthly Pro"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Price (₹)</label>
                      <input 
                        required
                        type="number" 
                        value={newPlan.price}
                        onChange={e => setNewPlan({...newPlan, price: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duration (Days)</label>
                      <input 
                        required
                        type="number" 
                        value={newPlan.durationDays}
                        onChange={e => setNewPlan({...newPlan, durationDays: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl mt-4 transition-all shadow-lg shadow-blue-200"
                  >
                    Save Membership Plan
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showAddExpense && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white p-8 rounded-[2.5rem] max-w-md w-full relative border border-slate-200 shadow-2xl"
              >
                <button 
                  onClick={() => setShowAddExpense(false)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold mb-6 text-slate-900">Add Vault Record</h2>
                <form onSubmit={handleAddExpense} className="space-y-5">
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setNewExpense({...newExpense, type: 'expense'})}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${newExpense.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewExpense({...newExpense, type: 'income'})}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${newExpense.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Income
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Title</label>
                    <input 
                      required
                      type="text" 
                      value={newExpense.title}
                      onChange={e => setNewExpense({...newExpense, title: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. Rent, Supplement Sale"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Amount (₹)</label>
                      <input 
                        required
                        type="number" 
                        value={newExpense.amount}
                        onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                      <select 
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                        className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="Rent">Rent</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Salary">Salary</option>
                        <option value="Supplements">Supplements</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Description (Optional)</label>
                    <textarea 
                      value={newExpense.description}
                      onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-blue-500 transition-all h-24 resize-none"
                      placeholder="Add more details..."
                    />
                  </div>
                  <button 
                    type="submit"
                    className={`w-full text-white font-bold py-5 rounded-2xl mt-4 transition-all shadow-lg ${newExpense.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                  >
                    Save Record
                  </button>
                </form>
              </motion.div>
            </div>
          )}



          {expiryAlert && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white p-8 rounded-[2.5rem] max-w-md w-full relative border border-slate-200 shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Bell className="w-8 h-8 text-red-500 animate-bounce" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Subscription Expired!</h2>
                <p className="text-slate-500 mb-8">
                  {expiryAlert.name}'s subscription has just ended. Send a WhatsApp reminder now?
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setExpiryAlert(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                  >
                    Later
                  </button>
                  <button 
                    onClick={() => {
                      sendWhatsApp(expiryAlert);
                      setExpiryAlert(null);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Send WhatsApp
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {selectedInvoiceMember && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] max-w-2xl w-full relative border border-slate-200 shadow-2xl overflow-hidden flex flex-col md:flex-row my-4 sm:my-8"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedInvoiceMember(null)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors z-10 bg-slate-100 p-2 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Left side actions and overview */}
                <div className="p-6 sm:p-8 bg-slate-50 md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight">Invoice Menu</h3>
                    <p className="text-xs text-slate-400 mb-6 font-medium">Digital Bill Management</p>

                    <div className="space-y-4">
                      {isEditingInvoice ? (
                        <>
                          {/* Save Button */}
                          <button 
                            onClick={handleSaveInvoiceChanges}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100 text-sm cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            Save Changes
                          </button>

                          {/* Cancel Button */}
                          <button 
                            onClick={() => setIsEditingInvoice(false)}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Action: Toggle Edit Mode */}
                          <button 
                            onClick={() => setIsEditingInvoice(true)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-100 text-sm cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Invoice
                          </button>

                          {/* Action: Download PDF */}
                          <button 
                            onClick={() => {
                              const docInst = generateInvoicePDF(selectedInvoiceMember);
                              docInst.save(`FightClub_Bill_${selectedInvoiceMember.name.replace(/\s+/g, '_')}.pdf`);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-100 text-sm cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            Download PDF Bill
                          </button>

                          {/* Action: Share via WhatsApp */}
                          <button 
                            onClick={() => {
                              const formattedDate = format(new Date(selectedInvoiceMember.expiryDate), 'MMM dd, yyyy');
                              const invoiceUrl = `${window.location.origin}/api/invoices/${selectedInvoiceMember.id}`;
                              const text = encodeURIComponent(`🥋 *FIGHT CLUB GYM - DIGITAL BILL* 🥋\n\nHi *${selectedInvoiceMember.name}*,\n\nYour digital bill for *${selectedInvoiceMember.planName}* has been generated successfully.\n• *Plan Price:* Rs. ${selectedInvoiceMember.planPrice}\n• *Access Key:* ${selectedInvoiceMember.qrCode.toUpperCase()}\n• *Valid Until:* ${formattedDate}\n• *Status:* ${selectedInvoiceMember.paymentStatus.toUpperCase()}\n\n📥 *Official PDF Invoice Link:* ${invoiceUrl}\n\nThank you for choosing Fight Club Gym! Keep training.\n📞 Owner Support: Akshay Choudhari (+91 83086 28416)`);
                              window.open(`https://wa.me/${selectedInvoiceMember.phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100 text-sm cursor-pointer"
                          >
                            <Share2 className="w-4 h-4" />
                            Share on WhatsApp
                          </button>

                          {/* Action: Printing invoice */}
                          <button 
                            onClick={() => {
                              const docInst = generateInvoicePDF(selectedInvoiceMember);
                              const blob = docInst.output('bloburl');
                              window.open(blob, '_blank');
                            }}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                            Print/Preview PDF
                          </button>
                        </>
                      )}
                    </div>

                    {/* Quick Payment status toggles */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            try {
                              const updatedMember = { ...selectedInvoiceMember, paymentStatus: 'paid' as const, lastPaymentDate: new Date().toISOString() };
                              await updateDoc(doc(db, 'members', selectedInvoiceMember.id), {
                                paymentStatus: 'paid',
                                lastPaymentDate: new Date().toISOString()
                              });
                              setSelectedInvoiceMember(updatedMember);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedInvoiceMember.paymentStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                        >
                          Mark Paid
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              const updatedMember = { ...selectedInvoiceMember, paymentStatus: 'pending' as const };
                              await updateDoc(doc(db, 'members', selectedInvoiceMember.id), {
                                paymentStatus: 'pending'
                              });
                              setSelectedInvoiceMember(updatedMember);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedInvoiceMember.paymentStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-500'}`}
                        >
                          Mark Unpaid
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 mt-6 md:mt-0">
                    <p>Fight Club Pro Billing</p>
                    <p>System ver 1.0.0</p>
                  </div>
                </div>

                {/* Right side: HTML Bill preview designed beautifully on standard Gym Template */}
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Gym Logo Banner */}
                    <div className="bg-slate-900 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 p-5 sm:p-6 mb-6 flex justify-between items-center text-white border-b border-blue-500">
                      <div>
                        <h4 className="font-black text-base tracking-widest leading-none">FIGHT CLUB GYM</h4>
                        <p className="text-[8px] tracking-wider text-slate-400 uppercase mt-1">Ultimate Training Zone</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] px-2.5 py-1 rounded bg-blue-600 text-white font-mono font-bold">DIGITAL INVOICE</span>
                      </div>
                    </div>

                    {/* Member Profile billing */}
                    <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                      {isEditingInvoice ? (
                        <>
                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Billed To (Edit)</p>
                            <input
                              type="text"
                              value={editInvoiceName}
                              onChange={(e) => setEditInvoiceName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                              placeholder="Member Name"
                            />
                            <input
                              type="text"
                              value={editInvoicePhone}
                              onChange={(e) => setEditInvoicePhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                              placeholder="Phone Number"
                            />
                          </div>
                          <div className="text-right space-y-1.5 flex flex-col items-end">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Invoice Details</p>
                            <p className="font-mono text-slate-500 text-[10px]">ID: {selectedInvoiceMember.id.substring(0, 8).toUpperCase()}</p>
                            <div className="w-full max-w-[140px] text-right">
                              <span className="text-[9px] text-slate-400 mr-2 block">Join Date:</span>
                              <input
                                type="date"
                                value={editInvoiceJoinDate}
                                onChange={(e) => setEditInvoiceJoinDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none text-xs text-right w-full"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Billed To</p>
                            <p className="font-extrabold text-slate-900 mt-1 text-sm">{selectedInvoiceMember.name}</p>
                            <p className="text-slate-500 mt-0.5">{selectedInvoiceMember.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Invoice Details</p>
                            <p className="font-mono text-slate-700 mt-1">FC-INV-{selectedInvoiceMember.id.substring(0, 8).toUpperCase()}</p>
                            <p className="text-slate-500 mt-0.5">Date: {format(new Date(selectedInvoiceMember.joinDate), 'MMM dd, yyyy')}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* The Gym Package Receipt Rows */}
                    <div className="border border-slate-150 rounded-xl overflow-hidden mb-6">
                      <div className="grid grid-cols-3 bg-slate-50 p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <span>Description</span>
                        <span className="text-center">Validity</span>
                        <span className="text-right">Amount</span>
                      </div>
                      {isEditingInvoice ? (
                        <div className="grid grid-cols-3 p-3 gap-2 text-xs text-slate-700 items-center">
                          <div>
                            <input
                              type="text"
                              value={editInvoicePlanName}
                              onChange={(e) => setEditInvoicePlanName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                              placeholder="Plan Name"
                            />
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 mb-0.5 block">Expiry Date:</span>
                            <input
                              type="date"
                              value={editInvoiceExpiryDate}
                              onChange={(e) => setEditInvoiceExpiryDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none text-xs text-center"
                            />
                          </div>
                          <div className="flex justify-end items-center gap-1">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              value={editInvoicePlanPrice}
                              onChange={(e) => setEditInvoicePlanPrice(Number(e.target.value))}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none text-xs text-right w-20"
                              placeholder="Price"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 p-3 text-xs text-slate-700 items-center">
                          <span className="font-bold text-slate-900">{selectedInvoiceMember.planName}</span>
                          <span className="text-center font-mono text-[10px] text-slate-500">
                            {format(new Date(selectedInvoiceMember.joinDate), 'MMM d')} - {format(new Date(selectedInvoiceMember.expiryDate), 'MMM d, yyyy')}
                          </span>
                          <span className="text-right font-bold text-slate-900">₹{selectedInvoiceMember.planPrice}</span>
                        </div>
                      )}
                    </div>

                    {/* Tax & Total calculation */}
                    <div className="space-y-2 text-xs text-slate-600 ml-auto w-48 text-right mb-6 pt-4 border-t border-slate-100">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-slate-800">₹{isEditingInvoice ? editInvoicePlanPrice : selectedInvoiceMember.planPrice}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Taxes (0%):</span>
                        <span className="font-semibold text-slate-800">₹0</span>
                      </div>
                      <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span>₹{isEditingInvoice ? editInvoicePlanPrice : selectedInvoiceMember.planPrice}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stamp & Footer details */}
                  <div className="pt-6 border-t border-slate-100 flex justify-between items-end">
                    <div className="text-[10px] text-slate-400 text-left space-y-3">
                      {isEditingInvoice ? (
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Receipt Status</p>
                          <select
                            value={editInvoicePaymentStatus}
                            onChange={(e) => setEditInvoicePaymentStatus(e.target.value as 'paid' | 'pending')}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                          >
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      ) : (
                        <div className="text-left">
                          {selectedInvoiceMember.paymentStatus === 'paid' ? (
                            <div className="inline-flex">
                              <span className="text-[9px] text-emerald-600 font-extrabold uppercase bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-150 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> PAID RECEIPT
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex">
                              <span className="text-[9px] text-red-500 font-extrabold uppercase bg-red-50 px-3 py-1.5 rounded-xl border border-red-150 flex items-center gap-1">
                                <X className="w-3.5 h-3.5" /> PENDING RECEIPT
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Authorized Digitized Sign & Stamp */}
                    <div className="flex flex-col items-center justify-end relative">
                      {/* Live Stamp Image */}
                      <div className="absolute bottom-2 right-0 pointer-events-none select-none filter drop-shadow-[1px_2px_3px_rgba(28,55,116,0.18)] opacity-95 transform -rotate-12 hover:-rotate-3 transition-transform duration-300">
                        <img 
                          id="invoice-stamp-image"
                          src="https://iili.io/CdgBFj4.md.png" 
                          alt="FIGHT CLUB GYM OFFICIAL DIGITAL AUTHORIZED STAMP" 
                          className="w-[128px] h-[70px] object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>

                      {/* Authorized line under stamp */}
                      <div className="w-40 border-t border-slate-300 text-center pt-1 mt-16 relative z-10">
                        <p className="text-[7.5px] font-black text-slate-800 tracking-wider">AUTHORIZED SIGNATURE</p>
                        <p className="text-[6px] text-slate-400 font-mono tracking-widest uppercase">FIGHT CLUB GYM</p>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          )}

          {selectedRenewMember && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 max-w-lg w-full relative overflow-hidden"
              >
                <button 
                  onClick={() => setSelectedRenewMember(null)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-all bg-slate-100 p-2 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
                  <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Fight Club Renewal Terminal</h3>
                    <p className="text-xs text-slate-400">Upgrade or extend member subscription parameters</p>
                  </div>
                </div>

                <form onSubmit={handleRenewSubmit} className="space-y-5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Member</span>
                    <p className="font-extrabold text-slate-900 text-base">{selectedRenewMember.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{selectedRenewMember.phone}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Subscription Plan</span>
                    <select
                      value={renewPlanId}
                      onChange={(e) => setRenewPlanId(e.target.value)}
                      className="w-full bg-slate-50 border-slate-200 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all outline-none"
                    >
                      <option value="">-- Choose Plan --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — Rs. {p.price} ({p.durationDays} Days)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">Renewal Start Date</span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRenewStartChoice('today')}
                        className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${renewStartChoice === 'today' ? 'bg-rose-50/50 border-rose-500 text-rose-700 ring-2 ring-rose-500/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Start Today</span>
                        <span className="text-[10px] text-slate-400 font-normal mt-1">Starting {format(new Date(), 'MMM dd, yyyy')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenewStartChoice('extend')}
                        className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${renewStartChoice === 'extend' ? 'bg-rose-50/50 border-rose-500 text-rose-700 ring-2 ring-rose-500/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>Extend Expiry</span>
                        <span className="text-[10px] text-slate-400 font-normal mt-1">From {format(new Date(selectedRenewMember.expiryDate), 'MMM dd, yyyy')}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">Payment Receipt Mode</span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRenewStatus('paid')}
                        className={`py-3 px-4 rounded-xl border text-center text-xs font-bold transition-all ${renewStatus === 'paid' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                      >
                        Paid (Instant)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenewStatus('pending')}
                        className={`py-3 px-4 rounded-xl border text-center text-xs font-bold transition-all ${renewStatus === 'pending' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                      >
                        Pending (Bill Dues)
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRenewMember(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl text-xs transition-all cursor-pointer"
                    >
                      Abort
                    </button>
                    <button
                      type="submit"
                      disabled={!renewPlanId}
                      className={`flex-1 text-white font-bold py-4 rounded-2xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer ${renewPlanId ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-250' : 'bg-slate-300 pointer-events-none'}`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Commit Renewal
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {selectedCalendarMember && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedCalendarMember(null)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-all bg-slate-100 p-2 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Active Plan Calendar Tracker</h3>
                    <p className="text-xs text-slate-400">Real-time subscription days and completion logs</p>
                  </div>
                </div>

                {(() => {
                  const join = new Date(selectedCalendarMember.joinDate);
                  const expiry = new Date(selectedCalendarMember.expiryDate);
                  const totalDays = differenceInDays(expiry, join);
                  const displayDays = totalDays > 0 ? totalDays : 30;
                  
                  const elapsedDays = Math.min(displayDays, Math.max(0, differenceInDays(new Date(), join)));
                  const remainingDays = Math.max(0, differenceInDays(expiry, new Date()));
                  const progressPercent = Math.min(100, Math.round((elapsedDays / displayDays) * 100));

                  // Generate days of membership
                  const daysArray = Array.from({ length: displayDays }).map((_, idx) => addDays(join, idx));

                  return (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                      {/* Top Metrics Card */}
                      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3 pb-3 border-b border-slate-200/50">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Tracked Person</p>
                          <h4 className="text-base font-extrabold text-slate-900 mt-0.5">{selectedCalendarMember.name}</h4>
                          <p className="text-xs text-slate-500 font-medium">Plan: {selectedCalendarMember.planName} • Rs. {selectedCalendarMember.planPrice}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Elapsed Training</p>
                          <p className="text-xl font-extrabold text-slate-900 mt-1">{elapsedDays} Days <span className="text-xs text-slate-500 font-normal font-mono">Completed</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Remaining Period</p>
                          <p className="text-xl font-extrabold text-blue-600 mt-1">{remainingDays} Days <span className="text-xs text-slate-400 font-normal font-mono">Left</span></p>
                        </div>
                        <div className="col-span-1">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Progress Rate</p>
                          <p className="text-xl font-extrabold text-indigo-600 mt-1">{progressPercent}%</p>
                        </div>
                        <div className="md:col-span-3">
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-4 text-[10px] font-mono justify-center py-2 border-y border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" />
                          <span className="text-slate-500">Auto Completed (Passed)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 border" />
                          <span className="text-slate-500">Gym Attendance logged 🏋️</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-blue-50 border-blue-600 border animate-pulse" />
                          <span className="text-slate-500">Current Day (Today)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-white border border-slate-200 border-dashed" />
                          <span className="text-slate-500">Upcoming Schedule</span>
                        </div>
                      </div>

                      {/* Calendar Grid */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-left">Plan Schedule Days Grid</p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2.5">
                          {daysArray.map((cellDate, idx) => {
                            const isPast = isBefore(cellDate, startOfDay(new Date()));
                            const isToday = isSameDay(cellDate, new Date());
                            const hasCheckedIn = attendance.some(a => a.memberId === selectedCalendarMember.id && isSameDay(new Date(a.timestamp), cellDate));

                            let cellClasses = "";
                            let badge = null;

                            if (hasCheckedIn) {
                              cellClasses = "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 text-amber-900 border-2 shadow-sm scale-[1.02] font-extrabold";
                              badge = "🏋️";
                            } else if (isToday) {
                              cellClasses = "bg-blue-50 border-blue-600 text-blue-900 border-2 font-black shadow-md ring-4 ring-blue-500/10";
                              badge = "⏰";
                            } else if (isPast) {
                              cellClasses = "bg-slate-100 border-slate-200 text-slate-400 font-medium line-through";
                              badge = "✓";
                            } else {
                              cellClasses = "bg-white border text-slate-600 border-slate-200 hover:border-slate-350 cursor-default";
                            }

                            return (
                              <div 
                                key={idx}
                                className={`h-16 flex flex-col justify-between p-2 rounded-2xl transition-all relative select-none ${cellClasses}`}
                              >
                                <span className="text-[9px] font-mono text-slate-400">Day {idx + 1}</span>
                                {badge && <span className="absolute top-1.5 right-1.5 text-xs">{badge}</span>}
                                <span className="text-[9.5px] font-extrabold uppercase truncate tracking-tight">{format(cellDate, 'MMM dd')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-6 border-t border-slate-100 mt-auto flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <p>Auto-tracks expired days with real system date.</p>
                  <button
                    onClick={() => setSelectedCalendarMember(null)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-5 rounded-xl text-xs font-sans transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showRevenueCalendar && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white p-6 sm:p-8 rounded-[2.5rem] max-w-4xl w-full flex flex-col md:flex-row gap-6 border border-slate-200 shadow-2xl h-[90vh] md:h-auto overflow-hidden text-slate-800"
              >
                {/* Left Side: Calendar Grid */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Revenue Calendar</h3>
                      <p className="text-xs text-slate-500">Track and trace incoming gym payments by date</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
                      <button 
                        onClick={() => {
                          setCalendarMonth(subMonths(calendarMonth, 1));
                          setSelectedCalendarDay(null);
                        }}
                        className="p-1 px-2.5 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 border border-slate-250/60 shadow-sm rounded-lg cursor-pointer"
                      >
                        &larr;
                      </button>
                      <span className="text-xs font-mono font-bold text-slate-800 px-2 min-w-[100px] text-center">
                        {format(calendarMonth, 'MMMM yyyy')}
                      </span>
                      <button 
                        onClick={() => {
                          setCalendarMonth(addMonths(calendarMonth, 1));
                          setSelectedCalendarDay(null);
                        }}
                        className="p-1 px-2.5 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 border border-slate-250/60 shadow-sm rounded-lg cursor-pointer"
                      >
                        &rarr;
                      </button>
                    </div>
                  </div>

                  {/* Day labels header */}
                  <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-medium text-slate-400">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="py-1 font-bold">{day}</div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const year = calendarMonth.getFullYear();
                      const month = calendarMonth.getMonth();
                      const firstDayIndex = new Date(year, month, 1).getDay();
                      const totalDays = new Date(year, month + 1, 0).getDate();
                      const prevMonthTotalDays = new Date(year, month, 0).getDate();
                      
                      const cells = [];
                      for (let i = firstDayIndex - 1; i >= 0; i--) {
                        cells.push({
                          date: new Date(year, month - 1, prevMonthTotalDays - i),
                          isCurrentMonth: false
                        });
                      }
                      for (let i = 1; i <= totalDays; i++) {
                        cells.push({
                          date: new Date(year, month, i),
                          isCurrentMonth: true
                        });
                      }
                      const remaining = 42 - cells.length;
                      for (let i = 1; i <= remaining; i++) {
                        cells.push({
                          date: new Date(year, month + 1, i),
                          isCurrentMonth: false
                        });
                      }

                      return cells.map((cell, idx) => {
                        const cellPayments = payments.filter(p => p.status === 'paid' && isSameDay(new Date(p.date), cell.date));
                        const dailyRevenue = cellPayments.reduce((acc, p) => acc + p.amount, 0);
                        const isToday = isSameDay(cell.date, new Date());
                        const isSelected = selectedCalendarDay && isSameDay(cell.date, selectedCalendarDay);

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedCalendarDay(cell.date)}
                            className={`h-14 sm:h-16 border rounded-xl flex flex-col justify-between p-1.5 transition-all select-none cursor-pointer relative ${
                              cell.isCurrentMonth ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-350'
                            } ${
                              isSelected 
                                ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-[1.03] z-10 font-bold' 
                                : 'border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <span className={`text-[10px] font-mono leading-none ${
                              isToday ? 'bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full font-black' : 'text-slate-500'
                            }`}>
                              {cell.date.getDate()}
                            </span>
                            {dailyRevenue > 0 && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded-md px-1 py-0.5 truncate text-center font-mono leading-tight scale-90 origin-bottom">
                                ₹{dailyRevenue}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 text-xs">
                    <button 
                      onClick={() => {
                        setCalendarMonth(new Date());
                        setSelectedCalendarDay(new Date());
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      Jump to Today
                    </button>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>
                      Earning recorded
                    </span>
                  </div>
                </div>

                {/* Right Side: Payment details pane */}
                <div className="w-full md:w-[320px] border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 flex flex-col h-full overflow-hidden max-h-[350px] md:max-h-[500px]">
                  <div className="pb-4 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {selectedCalendarDay ? format(selectedCalendarDay, 'MMMM dd, yyyy') : 'Transactions'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Transactions Log</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[150px] max-h-[250px] md:max-h-full">
                    {(() => {
                      if (!selectedCalendarDay) {
                        return <p className="text-xs text-slate-400 py-6 text-center">Select a day on the calendar to view earnings details.</p>;
                      }
                      const dayPayments = payments.filter(p => p.status === 'paid' && isSameDay(new Date(p.date), selectedCalendarDay));
                      
                      if (dayPayments.length === 0) {
                        return (
                          <div className="text-center py-12">
                            <p className="text-sm text-slate-400">No payment records on this date 🥊</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="bg-emerald-50 text-emerald-800 p-3 rounded-2xl border border-emerald-100 mb-2">
                            <p className="text-[10px] font-black uppercase text-emerald-600 leading-none mb-1">Total Received</p>
                            <p className="text-xl font-mono font-black animate-pulse">
                              ₹{dayPayments.reduce((acc, p) => acc + p.amount, 0)}
                            </p>
                          </div>
                          {dayPayments.map((p) => (
                            <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-xs flex flex-col gap-1">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-900 leading-tight">{p.memberName}</span>
                                <span className="font-mono font-bold text-emerald-600 bg-white px-2 py-0.5 rounded border border-slate-100">
                                  +₹{p.amount}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 flex justify-between">
                                <span>{p.planName}</span>
                                <span className="font-mono">{format(new Date(p.date), 'hh:mm a')}</span>
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setShowRevenueCalendar(false)}
                    className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-md cursor-pointer text-center"
                  >
                    Close Tracker
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {automationSuccess && (
            <div className="fixed top-8 right-8 z-[70]">
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500"
              >
                <div className="bg-white/20 p-2 rounded-xl">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm">Automation Success</p>
                  <p className="text-xs opacity-90">{automationSuccess}</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
