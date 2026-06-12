import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { toast } from 'sonner';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Use custom environment variables if present (e.g. for Vercel production)
// Otherwise, fall back to the test/development environment (Default Gemini Project) in AI Studio
const isCustomConfigDefined = !!apiKey;

const firebaseConfig = isCustomConfigDefined ? {
  apiKey: apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} : {
  apiKey: "AIzaSyCTJuIhPxVtjaCPmIzVGWjlIAhHA_yvrRs",
  authDomain: "gen-lang-client-0052529410.firebaseapp.com",
  projectId: "gen-lang-client-0052529410",
  storageBucket: "gen-lang-client-0052529410.firebasestorage.app",
  messagingSenderId: "82778041601",
  appId: "1:82778041601:web:bbc89c6923b8a1aa293f00",
};

const databaseId = (isCustomConfigDefined ? import.meta.env.VITE_FIREBASE_DATABASE_ID : null) || '(default)';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };

  if (import.meta.env.DEV) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }

  // Parse error messages into friendly Vietnamese
  let friendlyMessage = 'Có lỗi xảy ra khi truy xuất dữ liệu từ hệ thống. Vui lòng thử lại sau.';
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes('permission-denied') || lowerError.includes('insufficient permissions')) {
    friendlyMessage = '🔒 Quyền hạn không hợp lệ: Bạn không có đầy đủ thẩm quyền biên tập hoặc xóa thông tin tại mục này. Vui lòng liên hệ Quản trị viên hệ thống để kiểm tra và nâng quyền (Cán bộ Chuyên môn hoặc Người biên tập).';
  } else if (lowerError.includes('not-found')) {
    friendlyMessage = 'Dữ liệu yêu cầu không tìm thấy hoặc đã bị xóa bởi cán bộ khác.';
  } else if (lowerError.includes('unauthenticated') || lowerError.includes('auth')) {
    friendlyMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  } else if (lowerError.includes('offline') || lowerError.includes('network')) {
    friendlyMessage = 'Mất kết nối mạng. Hãy kiểm tra kết nối Internet của bạn và thử lại.';
  }

  // Show friendly message via toast
  toast.error(friendlyMessage, {
    duration: 5000,
    style: {
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
    }
  });

  throw new Error(friendlyMessage);
}
