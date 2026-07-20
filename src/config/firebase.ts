// config/firebase.ts

import { getApp, getApps, initializeApp } from "firebase/app";
// NOTA 1: initializeAuth y getAuth vienen del paquete principal
// @ts-expect-error
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
// NOTA 2: getReactNativePersistence DEBE venir de /react-native
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Configuración usando las variables de entorno de Expo
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// 1. Patrón Singleton para evitar crasheos de inicialización múltiple
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Patrón Singleton para Auth
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "southamerica-east1");

export { app, auth, db, functions, storage };
