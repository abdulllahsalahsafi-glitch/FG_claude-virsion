// Push Notifications Stub
export const PUSH_SW_PATH_FOR_FOREGROUND = "/firebase-messaging-sw.js";

export function getInitialPushStatus() {
  return { state: "ready", token: "" };
}

export function pushTokenDocId(token) {
  return String(token || "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);
}

export async function enableFifaPushNotifications() {
  return { state: "error", message: "غير مدعوم في هذه النسخة" };
}

export async function syncFifaPushTokenIfAllowed() {
  return null;
}

export function listenToForegroundPushMessages() {
  return () => {};
}
