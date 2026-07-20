import { auth, db } from "@/config/firebase";
import { BaseUser, PilotProfile, OwnerProfile, ClientProfile, AdminProfile } from "@/types/user";
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

export type Role = keyof typeof USER_ROLE;

interface AuthContextType {
  user: User | null;
  role: Role | null; // Selected active role
  roles: Role[]; // All roles assigned to user
  isLoading: boolean;
  userData: BaseUser | null; // Common user data
  profileData: any | null; // Role-specific profile data (PilotProfile, etc.)
  isRoleSelectorRequired: boolean;
  selectRole: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  roles: [],
  isLoading: true,
  userData: null,
  profileData: null,
  isRoleSelectorRequired: false,
  selectRole: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userData, setUserData] = useState<BaseUser | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleSelectorRequired, setIsRoleSelectorRequired] = useState(false);

  // Fetch role-specific profile data
  const fetchProfileData = async (uid: string, selectedRole: Role) => {
    let collectionName = "";
    switch (selectedRole) {
      case "ADMIN":
        collectionName = "admin-users";
        break;
      case "PILOT":
        collectionName = "pilots";
        break;
      case "OWNER":
        collectionName = "owners";
        break;
      case "CLIENT":
        collectionName = "clients";
        break;
    }

    try {
      const profileDocRef = doc(db, collectionName, uid);
      const profileDoc = await getDoc(profileDocRef);
      if (profileDoc.exists()) {
        return profileDoc.data();
      }
      return null;
    } catch (error) {
      console.error(`Error fetching profile data from ${collectionName}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as BaseUser;
            setUser(firebaseUser);
            setUserData(data);
            const userRoles = (data.roles || []) as Role[];
            setRoles(userRoles);

            if (userRoles.length === 1) {
              const active = userRoles[0];
              const profile = await fetchProfileData(firebaseUser.uid, active);
              setRole(active);
              setProfileData(profile);
              setIsRoleSelectorRequired(false);
            } else if (userRoles.length > 1) {
              // Multirrole, needs selection
              setIsRoleSelectorRequired(true);
            } else {
              // Default to client if no roles defined
              const active = "CLIENT";
              const profile = await fetchProfileData(firebaseUser.uid, active);
              setRole(active);
              setProfileData(profile);
              setIsRoleSelectorRequired(false);
            }
          } else {
            // Document doesn't exist in users
            setUser(null);
            setRole(null);
            setRoles([]);
            setUserData(null);
            setProfileData(null);
            setIsRoleSelectorRequired(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
          setRole(null);
          setRoles([]);
          setUserData(null);
          setProfileData(null);
          setIsRoleSelectorRequired(false);
        }
      } else {
        setUser(null);
        setRole(null);
        setRoles([]);
        setUserData(null);
        setProfileData(null);
        setIsRoleSelectorRequired(false);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const selectRole = async (selectedRole: Role) => {
    if (!user) return;
    setIsLoading(true);
    const profile = await fetchProfileData(user.uid, selectedRole);
    setRole(selectedRole);
    setProfileData(profile);
    setIsRoleSelectorRequired(false);
    setIsLoading(false);
  };

  const signOut = async () => {
    try {
      console.log("Cerrando sesión...");
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        roles,
        userData,
        profileData,
        isLoading,
        isRoleSelectorRequired,
        selectRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
