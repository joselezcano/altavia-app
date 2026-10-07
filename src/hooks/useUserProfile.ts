import { db } from "@/config/firebase";
import { BaseUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";

export function useUserProfile(uid: string | undefined) {
  return useQuery<BaseUser | null>({
    queryKey: ["user-profile", uid],
    queryFn: async () => {
      if (!uid) return null;
      try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          return userDocSnap.data() as BaseUser;
        }
        return null;
      } catch (error) {
        console.error("Error fetching user profile:", error);
        throw error;
      }
    },
    enabled: !!uid,
  });
}
