import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let firebaseAppInitialized = false;

if (projectId && clientEmail && privateKey) {
  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseAppInitialized = true;
    console.log('✅ Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
} else {
  console.log('⚠️ Firebase Admin credentials missing from backend/.env. Firebase verification will bypass in development.');
}

export const verifyFirebaseToken = async (idToken: string): Promise<{ success: boolean; phone?: string; error?: string }> => {
  // If the user specifies VITE_FIREBASE_DEV_BYPASS in development, we can allow testing
  if (!firebaseAppInitialized) {
    // If it's a test token in local dev, allow bypass for testing convenience
    if (idToken.startsWith('DEV_TOKEN_')) {
      const mockPhone = idToken.replace('DEV_TOKEN_', '');
      return { success: true, phone: mockPhone };
    }
    return {
      success: false,
      error: 'Firebase credentials missing in backend/.env'
    };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return {
      success: true,
      phone: decodedToken.phone_number // Returns +E164 formatted number
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
};
