// ╔══════════════════════════════════════════════════════════════╗
// ║   FIFA GROUP — FIREBASE CONFIG                               ║
// ║   ضع بيانات مشروعك من Firebase Console هنا                 ║
// ║   Project Settings → Your apps → Firebase SDK snippet       ║
// ╚══════════════════════════════════════════════════════════════╝

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

// 🔴 استبدل هذه القيم ببيانات مشروعك من Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyD-Bbu8-GvdfxzWdZCKI70tXPftcYkkkJM",
  authDomain: "fifa-group.firebaseapp.com",
  projectId: "fifa-group",
  storageBucket: "fifa-group.firebasestorage.app",
  messagingSenderId: "1063835143344",
  appId: "1:1063835143344:web:6b37c2e4984f5800977f75"
};

// ── Initialize ────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// Messaging (اختياري — للإشعارات)
export const getMessagingIfSupported = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
