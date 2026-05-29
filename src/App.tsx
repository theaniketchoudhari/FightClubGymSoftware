import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { Member } from './types';
import { handleFirestoreError, OperationType } from './errorUtils';
import AdminDashboard from './components/AdminDashboard';
import MemberApp from './components/MemberApp';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const loadMemberData = async (firebaseUser: any) => {
    const docRef = doc(db, 'members', firebaseUser.uid);
    let docSnap;
    try {
      docSnap = await getDoc(docRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `members/${firebaseUser.uid}`);
    }

    if (docSnap && docSnap.exists()) {
      setMemberData(docSnap.data() as Member);
    } else {
      const newMember: Member = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'New Member',
        phone: firebaseUser.phoneNumber || '',
        email: firebaseUser.email || '',
        planId: 'basic',
        planName: 'Basic',
        planPrice: 0,
        joinDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        paymentStatus: 'pending',
        qrCode: Math.random().toString(36).substring(7),
        role: 'admin',
        adminId: firebaseUser.uid
      };
      try {
        await setDoc(docRef, newMember);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `members/${firebaseUser.uid}`);
      }
      setMemberData(newMember);
    }
  };

  useEffect(() => {
    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          await loadMemberData(firebaseUser);
          setUser(firebaseUser);
        } catch (error) {
          console.error("Auth state change error:", error);
          setLoginError("Database Error: Make sure Firestore is enabled in Firebase Console and security rules are configured. " + (error instanceof Error ? error.message : ""));
          // Still set user so they aren't completely stuck if it's just a permissions issue,
          // though the app won't work perfectly without database access.
          setUser(null); 
        }
      } else {
        setUser(null);
        setMemberData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      // Using popup since authDomain is now correctly your own Firebase project!
      await signInWithPopup(auth, provider);
      setSigningIn(false);
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError(error.message || "An error occurred during login");
      setSigningIn(false);
    }
  };

  if (loading || signingIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        {signingIn && (
          <p className="text-slate-500 text-sm">Redirecting to Google Sign-In...</p>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mx-auto mb-6 shadow-md">
            <img 
              src="https://iili.io/Cd4Knae.md.png" 
              alt="Fight Club Logo" 
              referrerPolicy="no-referrer" 
              className="w-full h-full object-cover rounded-full" 
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Fight Club Gym</h1>
          <p className="text-slate-500 mb-8">Professional Gym Management Platform</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-600">
                <p className="font-bold mb-1">Login Error</p>
                <p>{loginError}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            {signingIn ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting...</>
            ) : (
              <><LogIn className="w-5 h-5" /> Sign in with Google</>
            )}
          </button>
          
          <p className="mt-6 text-xs text-slate-400">
            Exclusive access for Gym Owners and Administrators.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AnimatePresence mode="wait">
        <AdminDashboard key="admin" user={user} memberData={memberData} />
      </AnimatePresence>
    </div>
  );
}
