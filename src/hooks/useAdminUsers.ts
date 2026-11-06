import { db } from "@/config/firebase";
import { RoleProfileIds, ToggleUserRoleInput } from "@/types/admin";
import { BaseUser } from "@/types/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/**
 * Todos los usuarios (colección users) para la gestión del ADMIN.
 * La búsqueda por nombre / email / documento se hace en el cliente:
 * Firestore no tiene búsqueda de texto y la cantidad de usuarios es acotada.
 */
export function useAllUsers() {
  return useQuery<BaseUser[]>({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const users: BaseUser[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as BaseUser;
          if (!data.deleted) {
            users.push({
              ...data,
              uid: docSnap.id,
              roles: Array.isArray(data.roles) ? data.roles : [],
            });
          }
        });

        users.sort((a, b) =>
          `${a.firstName || ""} ${a.lastName || ""}`.localeCompare(
            `${b.firstName || ""} ${b.lastName || ""}`
          )
        );

        return users;
      } catch (error) {
        console.error("Error al obtener los usuarios en useAllUsers:", error);
        throw error;
      }
    },
  });
}

/**
 * Ids de los perfiles de rol existentes (pilots/{uid} y owners/{uid}).
 * Sirve para detectar usuarios con el rol en `roles` pero sin su documento de rol
 * (datos viejos): sin pilots/{uid} el propietario no puede vincular al piloto.
 */
export function useRoleProfileIds() {
  return useQuery<RoleProfileIds>({
    queryKey: ["admin-role-profile-ids"],
    queryFn: async () => {
      try {
        const [pilotsSnap, ownersSnap] = await Promise.all([
          getDocs(collection(db, "pilots")),
          getDocs(collection(db, "owners")),
        ]);
        return {
          pilotIds: pilotsSnap.docs.map((d) => d.id),
          ownerIds: ownersSnap.docs.map((d) => d.id),
        };
      } catch (error) {
        console.error("Error al obtener los perfiles de rol en useRoleProfileIds:", error);
        throw error;
      }
    },
  });
}

/**
 * Agrega o quita los roles OWNER / PILOT de un usuario (solo ADMIN, según firestore.rules).
 *  - Al agregar: primero crea el documento del rol si no existe (pilots/{uid} u owners/{uid})
 *    y después suma el rol al array roles. Es idempotente: también sirve para crear el
 *    perfil faltante de un usuario que ya tenía el rol.
 *  - Al quitar: solo saca el rol del array roles. Los documentos de rol NO se borran
 *    (se preserva la historia: vínculos, aeronaves, etc.).
 */
export function useToggleUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uid, role, add }: ToggleUserRoleInput) => {
      try {
        const userRef = doc(db, "users", uid);

        if (!add) {
          await updateDoc(userRef, {
            roles: arrayRemove(role),
            updatedAt: serverTimestamp(),
          });
          return;
        }

        if (role === "PILOT") {
          const pilotRef = doc(db, "pilots", uid);
          const pilotSnap = await getDoc(pilotRef);
          if (!pilotSnap.exists()) {
            await setDoc(pilotRef, {
              uid,
              isEncargado: false,
              owner_ids: [],
              managed_aircrafts: [],
              pilot_aircrafts: [],
              createdAt: serverTimestamp(),
            });
          }
        } else {
          const ownerRef = doc(db, "owners", uid);
          const ownerSnap = await getDoc(ownerRef);
          if (!ownerSnap.exists()) {
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? (userSnap.data() as BaseUser) : null;
            const ownerData: Record<string, any> = {
              uid,
              createdAt: serverTimestamp(),
            };
            if (userData?.personType) ownerData.personType = userData.personType;
            if (userData?.personType === "company") {
              if (userData.businessName) ownerData.companyName = userData.businessName;
              if (userData.taxId) ownerData.taxId = userData.taxId;
            }
            await setDoc(ownerRef, ownerData);
          }
        }

        await updateDoc(userRef, {
          roles: arrayUnion(role),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error al actualizar los roles del usuario:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-role-profile-ids"] });
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
    },
  });
}
