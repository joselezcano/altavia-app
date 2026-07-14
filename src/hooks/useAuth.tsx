import { auth, db } from "@/config/firebase";
import {
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";

export const USER_ROLE = {
  ADMIN: "ADMIN",
  CLIENT: "CLIENT",
  PILOT: "PILOT",
  OWNER: "OWNER",
} as const;

export type Role = keyof typeof USER_ROLE | null;

// export type Role = "ADMIN" | "CLIENT" | "PILOT" | "OWNER" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  isLoading: boolean;
  userData: UserData | null;
  signOut: () => Promise<void>;
}

export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  uid: string;
  role: Role;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  userData: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null); // Estado para almacenar los datos del usuario

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Consultar el rol del usuario en Firestore
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUser(firebaseUser);
            setRole(userDoc.data().role as Role);
            setUserData(userDoc.data() as UserData); // Guardar los datos del usuario en el estado
          } else {
            setRole(USER_ROLE.CLIENT); // Rol por defecto si no se encuentra
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setUserData(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      console.log("Cerrando sesión...");
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, userData, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
