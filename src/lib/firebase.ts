import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNyM60kCNwpeaOrwlLdAMc8D-AEy5MHYc",
  authDomain: "clinic-dfu.firebaseapp.com",
  projectId: "clinic-dfu",
  storageBucket: "clinic-dfu.firebasestorage.app",
  messagingSenderId: "63949686062",
  appId: "1:63949686062:web:b7a5b6fdb59495bc2726bf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};
const shouldUseEmulators = viteEnv.VITE_USE_FIREBASE_EMULATOR === 'true';
const emulatorState = globalThis as typeof globalThis & {
  __clinicDfuFirebaseEmulatorsConnected?: boolean;
};

if (shouldUseEmulators && !emulatorState.__clinicDfuFirebaseEmulatorsConnected) {
  connectAuthEmulator(
    auth,
    viteEnv.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099',
    { disableWarnings: true }
  );
  connectFirestoreEmulator(
    db,
    viteEnv.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(viteEnv.VITE_FIRESTORE_EMULATOR_PORT || 8080)
  );
  connectStorageEmulator(
    storage,
    viteEnv.VITE_STORAGE_EMULATOR_HOST || '127.0.0.1',
    Number(viteEnv.VITE_STORAGE_EMULATOR_PORT || 9199)
  );
  emulatorState.__clinicDfuFirebaseEmulatorsConnected = true;
}

export { auth, db, storage, googleProvider };
