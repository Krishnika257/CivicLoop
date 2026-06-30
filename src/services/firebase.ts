// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, updateDoc, addDoc, serverTimestamp, Timestamp, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Issue, IssueStatus, IssueCategory, User, Precedent } from '../types';
// Your Firebase config - replace with your own
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoKey1234567890',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'civicloop-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'civicloop-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'civicloop-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Auth helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
export const getCurrentUser = () => auth.currentUser;

// Firestore helpers
export const firestore = db;
export const collections = {
  issues: 'issues',
  users: 'users',
  precedents: 'precedents',
};

// Storage helpers
export const uploadImage = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Issue CRUD
export const createIssue = async (issueData: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, collections.issues), {
    ...issueData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getIssue = async (id: string): Promise<Issue | null> => {
  const docRef = doc(db, collections.issues, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Issue;
};

export const getIssues = async (filters?: { status?: IssueStatus; category?: IssueCategory }): Promise<Issue[]> => {
  let q = collection(db, collections.issues);
  let constraints: any[] = [];
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.category) constraints.push(where('category', '==', filters.category));
  constraints.push(orderBy('createdAt', 'desc'));
  const queryRef = query(q, ...constraints);
  const snap = await getDocs(queryRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue));
};

export const updateIssue = async (id: string, data: Partial<Issue>) => {
  const docRef = doc(db, collections.issues, id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
};

// User CRUD
export const getUser = async (id: string): Promise<User | null> => {
  const docRef = doc(db, collections.users, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as User;
};

export const createOrUpdateUser = async (userData: Partial<User> & { id: string }) => {
  const docRef = doc(db, collections.users, userData.id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await updateDoc(docRef, { ...userData, updatedAt: serverTimestamp() });
  } else {
    await setDoc(docRef, { ...userData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
};

// Precedents (seed data)
export const seedPrecedents = async (precedents: Omit<Precedent, 'id'>[]) => {
  const coll = collection(db, collections.precedents);
  for (const p of precedents) {
    await addDoc(coll, p);
  }
};

export const getPrecedents = async (category?: IssueCategory): Promise<Precedent[]> => {
  let q = collection(db, collections.precedents);
  if (category) {
    q = query(q, where('category', '==', category)) as any;
  }
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Precedent));
};

export const getPrecedent = async (id: string): Promise<Precedent | null> => {
  const docRef = doc(db, collections.precedents, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Precedent;
};

export { auth, storage, db };