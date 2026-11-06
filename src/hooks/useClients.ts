import { db } from "@/config/firebase";
import { QuickClientForm } from "@/types/client";
import { BaseUser } from "@/types/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

/**
 * Hook para consultar todos los clientes registrados en la plataforma
 */
export function useClients() {
  return useQuery<BaseUser[]>({
    queryKey: ["all-clients"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("roles", "array-contains", "CLIENT")
        );
        const snapshot = await getDocs(q);
        const clients: BaseUser[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as BaseUser;
          if (!data.deleted) {
            clients.push({
              ...data,
              uid: docSnap.id,
            });
          }
        });

        // Ordenar por fecha de creación o alfabéticamente
        clients.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );

        return clients;
      } catch (error) {
        console.error("Error al obtener lista de clientes en useClients:", error);
        throw error;
      }
    },
  });
}

/**
 * Hook para registrar un cliente de forma rápida desde el panel de administración
 * Crea la ficha en 'users' y en 'clients' manteniendo el esquema multirrol
 */
export function useCreateQuickClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: QuickClientForm): Promise<BaseUser> => {
      try {
        const cleanEmail = formData.email.trim().toLowerCase();
        const cleanDoc = formData.documentNumber.trim();

        // 1. Verificar si ya existe un cliente con ese email
        const checkQuery = query(
          collection(db, "users"),
          where("email", "==", cleanEmail),
          limit(1)
        );
        const existingSnap = await getDocs(checkQuery);

        let uid: string;
        if (!existingSnap.empty) {
          const existingUser = existingSnap.docs[0];
          uid = existingUser.id;
          const existingData = existingUser.data() as BaseUser;

          // Si ya existe, nos aseguramos de que tenga el rol CLIENT
          const updatedRoles = Array.from(new Set([...(existingData.roles || []), "CLIENT"]));

          await setDoc(
            doc(db, "users", uid),
            {
              roles: updatedRoles,
              phone: formData.phone.trim() || existingData.phone,
              documentNumber: cleanDoc || existingData.documentNumber,
              personType: formData.personType || existingData.personType,
              businessName: formData.businessName?.trim() || existingData.businessName,
              taxId: formData.personType === "company" ? cleanDoc : existingData.taxId,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          // Generar nuevo ID para el cliente
          const newDocRef = doc(collection(db, "users"));
          uid = newDocRef.id;

          const newUserData: Record<string, any> = {
            uid,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: cleanEmail,
            phone: formData.phone.trim(),
            documentNumber: cleanDoc,
            documentType: "CI",
            personType: formData.personType,
            roles: ["CLIENT"],
            profileCompleted: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          if (formData.personType === "company") {
            newUserData.businessName = formData.businessName?.trim() || "";
            newUserData.taxId = cleanDoc;
          }

          await setDoc(newDocRef, newUserData);
        }

        // 2. Crear o actualizar el perfil en la colección dedicada 'clients'
        const clientRef = doc(db, "clients", uid);
        await setDoc(
          clientRef,
          {
            uid,
            personType: formData.personType,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        return {
          uid,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: cleanEmail,
          phone: formData.phone.trim(),
          documentNumber: cleanDoc,
          personType: formData.personType,
          roles: ["CLIENT"],
          profileCompleted: true,
        } as BaseUser;
      } catch (error) {
        console.error("Error al registrar cliente rápido en Firestore:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
    },
  });
}
