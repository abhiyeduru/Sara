import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from "firebase/auth";

// User provided Firebase Web API Key
const firebaseConfig = {
  apiKey: "AIzaSyDhycimimNkKKmgeSPXe6XxlO7VBR91YsU",
  authDomain: "meet-sara.firebaseapp.com",
  projectId: "meet-sara",
  storageBucket: "meet-sara.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

let app = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (err) {
  console.warn("Firebase initialization notice:", err.message);
}

export { 
  auth, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
};

export async function getCurrentUserToken() {
  if (!auth || !auth.currentUser) return "dev-token-business-owner";
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return "dev-token-business-owner";
  }
}
