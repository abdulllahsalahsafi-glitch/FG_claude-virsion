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
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
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
