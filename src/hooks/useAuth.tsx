import { auth, db } from "@/config/firebase";
import { claimPreRegisteredProfile } from "@/services/profile-claim";
import { BaseUser } from "@/types/user";
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

interface RegistrationMetadata {
  termsAccepted: boolean;
  referralSource: string | null;
}

interface AuthContextType {
  user: User | null;
  role: Role | null; // Selected active role
  roles: Role[]; // All roles assigned to user
  isLoading: boolean;
  userData: BaseUser | null; // Common user data
  profileData: any | null; // Role-specific profile data (PilotProfile, etc.)
  isRoleSelectorRequired: boolean;
  needsProfileCompletion: boolean; // Flag to indicate step 2 onboarding is required
  registrationMetadata: RegistrationMetadata;
  setRegistrationMetadata: (meta: RegistrationMetadata) => void;
  refreshUserData: () => Promise<void>;
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
  needsProfileCompletion: false,
  registrationMetadata: { termsAccepted: false, referralSource: null },
  setRegistrationMetadata: () => { },
  refreshUserData: async () => { },
  selectRole: async () => { },
  signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userData, setUserData] = useState<BaseUser | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleSelectorRequired, setIsRoleSelectorRequired] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [registrationMetadata, setRegistrationMetadata] = useState<RegistrationMetadata>({
    termsAccepted: false,
    referralSource: null,
  });

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

  const loadUserData = async (firebaseUser: User, allowClaim = true) => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      // Primer ingreso con Google / Apple: si la encargada ya lo había dado de alta
      // con ese email, el servidor une ese perfil (y sus reservas) a esta cuenta.
      if (!userDoc.exists() && allowClaim) {
        const claim = await claimPreRegisteredProfile();
        if (claim.claimed) {
          await loadUserData(firebaseUser, false);
          return;
        }
      }

      if (userDoc.exists()) {
        const data = userDoc.data() as BaseUser;

        // Check if account was deleted
        if (data.deleted) {
          console.warn("Usuario con cuenta eliminada detectado. Cerrando sesión...");
          await firebaseSignOut(auth);
          setUser(null);
          setUserData(null);
          setRole(null);
          setRoles([]);
          setProfileData(null);
          setNeedsProfileCompletion(false);
          setIsRoleSelectorRequired(false);
          return;
        }

        setUser(firebaseUser);
        setUserData(data);

        // Check if user needs Step 2 profile completion (Persona Física vs Empresa)
        if (!data.personType || data.profileCompleted === false) {
          setNeedsProfileCompletion(true);
          setRole(null);
          setRoles([]);
          setProfileData(null);
          setIsRoleSelectorRequired(false);
          return;
        }

        setNeedsProfileCompletion(false);
        const userRoles = (data.roles || []) as Role[];
        setRoles(userRoles);

        if (userRoles.length === 1) {
          const active = userRoles[0];
          const profile = await fetchProfileData(firebaseUser.uid, active);
          setRole(active);
          setProfileData(profile);
          setIsRoleSelectorRequired(false);
        } else if (userRoles.length > 1) {
          // Multirole, needs selection
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
        // Document doesn't exist yet (brand new Google/Apple user)
        setUser(firebaseUser);
        setUserData(null);
        setRole(null);
        setRoles([]);
        setProfileData(null);
        setNeedsProfileCompletion(true);
        setIsRoleSelectorRequired(false);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUser(firebaseUser);
      setUserData(null);
      setNeedsProfileCompletion(true);
      setRole(null);
      setRoles([]);
      setProfileData(null);
      setIsRoleSelectorRequired(false);
    }
  };

  const refreshUserData = async () => {
    if (auth.currentUser) {
      setIsLoading(true);
      await loadUserData(auth.currentUser);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        await loadUserData(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
        setRoles([]);
        setUserData(null);
        setProfileData(null);
        setNeedsProfileCompletion(false);
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
        needsProfileCompletion,
        registrationMetadata,
        setRegistrationMetadata,
        refreshUserData,
        selectRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
