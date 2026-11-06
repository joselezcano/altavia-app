import { db } from "@/config/firebase";
import { QuickClientForm, QuickClientResult } from "@/types/client";
import { BaseUser } from "@/types/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  QueryDocumentSnapshot,
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
 * Variantes de un número de documento para comparar: tal cual se escribió y sin
 * puntos ni espacios (ej. "1.234.567" y "1234567").
 */
function documentVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const compact = trimmed.replace(/[.\s]/g, "");
  return Array.from(new Set([trimmed, compact].filter((v) => v.length > 0)));
}

/** Quita las claves con valor undefined (Firestore no las acepta en setDoc). */
function withoutUndefined<T extends Record<string, any>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Busca un usuario no eliminado por número de documento (documentNumber) y,
 * si es empresa, también por RUC (taxId).
 */
async function findUserByDocument(
  rawDoc: string,
  personType: QuickClientForm["personType"]
): Promise<QueryDocumentSnapshot | null> {
  const variants = documentVariants(rawDoc);
  if (variants.length === 0) return null;

  const fields = personType === "company" ? ["taxId", "documentNumber"] : ["documentNumber"];

  for (const field of fields) {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where(field, "in", variants), limit(5))
      );
      const match = snap.docs.find((d) => !(d.data() as BaseUser).deleted);
      if (match) return match;
    } catch (error) {
      console.error(`Error al buscar usuario por ${field}:`, error);
      throw error;
    }
  }

  return null;
}

/**
 * Hook para registrar un cliente de forma rápida desde el panel de administración
 * Crea la ficha en 'users' y en 'clients' manteniendo el esquema multirrol.
 *
 * Antes de crear busca, en este orden:
 *  1. Un usuario con el mismo documento (C.I. / RUC). Si existe, NO se crea otro:
 *     se reutiliza el existente (matchedBy: "document").
 *  2. Un usuario con el mismo email (solo si se cargó email).
 */
export function useCreateQuickClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: QuickClientForm): Promise<QuickClientResult> => {
      try {
        const cleanEmail = (formData.email || "").trim().toLowerCase();
        const cleanDoc = formData.documentNumber.trim();

        // 1. ¿Ya existe un usuario con ese documento?
        const existingByDoc = await findUserByDocument(cleanDoc, formData.personType);
        if (existingByDoc) {
          const uid = existingByDoc.id;
          const existingData = existingByDoc.data() as BaseUser;
          const currentRoles = existingData.roles || [];

          // Solo nos aseguramos de que tenga el rol CLIENT; no se pisan sus datos.
          if (!currentRoles.includes("CLIENT")) {
            await setDoc(
              doc(db, "users", uid),
              { roles: [...currentRoles, "CLIENT"], updatedAt: serverTimestamp() },
              { merge: true }
            );
          }

          const clientRef = doc(db, "clients", uid);
          const clientSnap = await getDoc(clientRef);
          if (!clientSnap.exists()) {
            await setDoc(clientRef, {
              uid,
              personType: existingData.personType || formData.personType,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          return {
            client: {
              ...existingData,
              uid,
              // La UI usa firstName.charAt(0): nunca devolverlo vacío.
              firstName: existingData.firstName || formData.firstName.trim(),
              lastName: existingData.lastName || formData.lastName.trim(),
              roles:currentRoles.includes("CLIENT") ? currentRoles : [...currentRoles, "CLIENT"],
            },
            matchedBy: "document",
          };
        }

        // 2. ¿Ya existe un usuario con ese email? (solo si se cargó email)
        let existingByEmail: QueryDocumentSnapshot | null = null;
        if (cleanEmail) {
          const checkQuery = query(
            collection(db, "users"),
            where("email", "==", cleanEmail),
            limit(1)
          );
          const existingSnap = await getDocs(checkQuery);
          existingByEmail = existingSnap.empty ? null : existingSnap.docs[0];
        }

        let uid: string;
        if (existingByEmail) {
          uid = existingByEmail.id;
          const existingData = existingByEmail.data() as BaseUser;

          // Si ya existe, nos aseguramos de que tenga el rol CLIENT
          const updatedRoles = Array.from(new Set([...(existingData.roles || []), "CLIENT"]));

          await setDoc(
            doc(db, "users", uid),
            withoutUndefined({
              roles: updatedRoles,
              phone: formData.phone.trim() || existingData.phone,
              documentNumber: cleanDoc || existingData.documentNumber,
              personType: formData.personType || existingData.personType,
              businessName: formData.businessName?.trim() || existingData.businessName,
              taxId: formData.personType === "company" ? cleanDoc : existingData.taxId,
              updatedAt: serverTimestamp(),
            }),
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
            phone: formData.phone.trim(),
            documentNumber: cleanDoc,
            documentType: "CI",
            personType: formData.personType,
            roles: ["CLIENT"],
            profileCompleted: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // El email es opcional: si no se cargó, no se guarda el campo.
          if (cleanEmail) {
            newUserData.email = cleanEmail;
          }

          if (formData.personType === "company") {
            newUserData.businessName = formData.businessName?.trim() || "";
            newUserData.taxId = cleanDoc;
          }

          await setDoc(newDocRef, newUserData);
        }

        // 3. Crear o actualizar el perfil en la colección dedicada 'clients'
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
          client: {
            uid,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: cleanEmail,
            phone: formData.phone.trim(),
            documentNumber: cleanDoc,
            personType: formData.personType,
            roles: ["CLIENT"],
            profileCompleted: true,
          } as BaseUser,
          matchedBy: existingByEmail ? "email" : null,
        };
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
