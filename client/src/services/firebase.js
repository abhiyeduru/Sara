import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from "firebase/auth";

// Firebase Web App Configuration
const envApiKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_API_KEY : null;
const isRealConfig = Boolean(
  envApiKey && 
  envApiKey.length > 20 && 
  !envApiKey.includes("AIzaSyDhycimimNkKKmgeSPXe6XxlO7VBR91YsU")
);

const firebaseConfig = {
  apiKey: envApiKey || "",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || ""
};

let app = null;
let auth = null;

if (isRealConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.warn("Firebase initialization notice:", err.message);
  }
}

// Safe fallback stubs if Firebase is unconfigured
const safeSignInAnonymously = auth ? signInAnonymously : async () => ({ user: { uid: "dev-user-1", email: "owner@sara.ai" } });
const safeSignInWithEmailAndPassword = auth ? signInWithEmailAndPassword : async () => ({ user: { uid: "dev-user-1", email: "owner@sara.ai" } });
const safeCreateUserWithEmailAndPassword = auth ? createUserWithEmailAndPassword : async () => ({ user: { uid: "dev-user-1", email: "owner@sara.ai" } });
const safeSignOut = auth ? signOut : async () => {};
const safeOnAuthStateChanged = auth ? onAuthStateChanged : (authInstance, callback) => {
  callback({ uid: "dev-user-1", email: "owner@sara.ai", displayName: "SARA Admin" });
  return () => {};
};

export { 
  auth, 
  safeSignInAnonymously as signInAnonymously, 
  safeSignInWithEmailAndPassword as signInWithEmailAndPassword, 
  safeCreateUserWithEmailAndPassword as createUserWithEmailAndPassword, 
  safeSignOut as signOut, 
  safeOnAuthStateChanged as onAuthStateChanged 
};

export async function getCurrentUserToken() {
  if (!auth || !auth.currentUser) return "dev-token-business-owner";
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return "dev-token-business-owner";
  }
}
