import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, where, orderBy, limit } from 'firebase/firestore';
import { Member, Payment, Attendance, Workout } from '../types';
import { 
  Dumbbell, Calendar, CreditCard, MessageSquare, 
  User, QrCode, TrendingUp, ChevronRight, 
  Clock, Award, Flame, Heart, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInSeconds } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import AIChatbot from './AIChatbot';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const CountdownTimer = ({ expiryDate }: { expiryDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = differenceInSeconds(new Date(expiryDate), new Date());
      setTimeLeft(seconds > 0 ? seconds : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryDate]);

  if (timeLeft <= 0) return <span className="text-red-500 font-black">EXPIRED</span>;

  const days = Math.floor(timeLeft / (24 * 3600));
  const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex gap-2 text-xs font-black">
      <div className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">{days}d</div>
      <div className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">{hours}h</div>
      <div className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">{minutes}m</div>
      <div className="bg-white/40 px-2 py-1 rounded-lg backdrop-blur-sm animate-pulse">{seconds}s</div>
    </div>
  );
};

export default function MemberApp({ user, memberData }: { user: any, memberData: Member }) {
  const [activeTab, setActiveTab] = useState('home');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    const qPayments = query(
      collection(db, 'payments'), 
      where('memberId', '==', memberData.id),
      orderBy('date', 'desc')
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });

    const qAttendance = query(
      collection(db, 'attendance'), 
      where('memberId', '==', memberData.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    });

    return () => {
      unsubscribePayments();
      unsubscribeAttendance();
    };
  }, [memberData.id]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Header */}
      <header className="p-6 pt-12 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {memberData.name.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-sm">Ready for your workout?</p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm"
        >
          <User className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Membership Card */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Membership Plan</p>
                    <h2 className="text-3xl font-black">{memberData.planName}</h2>
                  </div>
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-70 mb-2">Time Remaining</p>
                    <CountdownTimer expiryDate={memberData.expiryDate} />
                  </div>
                  <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    memberData.status === 'active' ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                  }`}>
                    {memberData.status}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                  <Flame className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">12</p>
                  <p className="text-xs text-slate-500">Day Streak</p>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                  <Clock className="w-6 h-6 text-blue-500 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">45m</p>
                  <p className="text-xs text-slate-500">Avg Session</p>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] text-center shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Your Check-in QR</h3>
                <div className="bg-slate-50 p-4 rounded-2xl inline-block mb-4 border border-slate-100">
                  <QRCodeSVG value={memberData.qrCode} size={150} />
                </div>
                <p className="text-xs text-slate-500">Scan this at the gym entrance to record your attendance</p>
              </div>

              {/* Recent Attendance */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">Recent Visits</h3>
                  <button className="text-blue-600 text-sm font-bold">View All</button>
                </div>
                <div className="space-y-3">
                  {attendance.map((entry) => (
                    <div key={entry.id} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{format(new Date(entry.timestamp), 'EEEE, MMM dd')}</p>
                          <p className="text-xs text-slate-500">{format(new Date(entry.timestamp), 'hh:mm a')}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-[calc(100vh-200px)]"
            >
              <AIChatbot memberData={memberData} />
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Payment History</h3>
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{payment.planName}</p>
                        <p className="text-xs text-slate-500">{format(new Date(payment.date), 'MMM dd, yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">₹{payment.amount}</p>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          payment.status === 'paid' ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-8">No payment records found.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-6 right-6 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] p-2 flex justify-between items-center shadow-xl z-50">
        {[
          { id: 'home', icon: User, label: 'Profile' },
          { id: 'workout', icon: Dumbbell, label: 'Workout' },
          { id: 'chat', icon: MessageSquare, label: 'AI Coach' },
          { id: 'billing', icon: CreditCard, label: 'Billing' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all ${
              activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
