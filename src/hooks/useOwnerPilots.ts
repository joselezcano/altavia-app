import { db } from "@/config/firebase";
import { PilotProfile } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { collection, documentId, getDocs, query, Timestamp, where } from "firebase/firestore";

// Firestore admite como máximo 30 valores en un filtro `in`.
const IN_QUERY_LIMIT = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Convierte Timestamp / Date / string a Date sin romperse si falta el campo.
function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val.toDate === "function") return val.toDate();
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Pilotos vinculados a un propietario (pilots.owner_ids contiene ownerUid).
 * Para la encargada, pasar el ownerId de la aeronave, no su propio uid.
 * Tolera perfiles incompletos (ej. pilotos recién dados de alta por el admin,
 * que todavía no tienen basic / aeronautical / other_information).
 */
export function useOwnerPilots(ownerUid: string | undefined) {
  return useQuery<PilotProfile[]>({
    queryKey: ["owner-pilots", ownerUid],
    queryFn: async () => {
      if (!ownerUid) return [];

      try {
        // 1. Pilotos cuyo owner_ids contiene ownerUid
        const pilotsQuery = query(
          collection(db, "pilots"),
          where("owner_ids", "array-contains", ownerUid)
        );

        const snap = await getDocs(pilotsQuery);

        const pilotDocsMap = new Map<string, any>();
        snap.forEach((pilotDoc) => pilotDocsMap.set(pilotDoc.id, pilotDoc.data()));

        const pilotUids = Array.from(pilotDocsMap.keys());
        if (pilotUids.length === 0) return [];

        // 2. Datos base de cada piloto en 'users' (en tandas de 30 por el límite de `in`)
        const usersMap: Record<string, BaseUser> = {};
        const userSnapshots = await Promise.all(
          chunk(pilotUids, IN_QUERY_LIMIT).map((uids) =>
            getDocs(query(collection(db, "users"), where(documentId(), "in", uids)))
          )
        );
        userSnapshots.forEach((usersSnapshot) => {
          usersSnapshot.forEach((userDoc) => {
            usersMap[userDoc.id] = userDoc.data() as BaseUser;
          });
        });

        // 3. Mapear al esquema PilotProfile con valores por defecto
        const result: PilotProfile[] = [];

        pilotDocsMap.forEach((data, docId) => {
          const userData = usersMap[docId];
          const ownerIds: string[] = Array.isArray(data.owner_ids) ? data.owner_ids : [ownerUid];

          const profile: PilotProfile = {
            user: {
              uid: userData?.uid || docId,
              email: userData?.email || "",
              firstName: userData?.firstName || "",
              lastName: userData?.lastName || "",
            },
            basic: {
              id_first_name: data.basic?.id_first_name || "",
              id_last_name: data.basic?.id_last_name || "",
              id_type: data.basic?.id_type || "Documento de Identidad",
              id_number: data.basic?.id_number || "",
              id_country: data.basic?.id_country || "",
              id_nationality: data.basic?.id_nationality || "",
              id_date_of_birth: parseDate(data.basic?.id_date_of_birth),
              telephone: data.basic?.telephone || "",
            },
            aeronautical: {
              pilot_licence: data.aeronautical?.pilot_licence || "",
              licence_type: data.aeronautical?.licence_type || "Piloto privado",
              licence_permits: data.aeronautical?.licence_permits || "",
              licence_issuer: data.aeronautical?.licence_issuer || "",
            },
            other_information: {
              aeronautical_medical_certificate:
                data.other_information?.aeronautical_medical_certificate || "Clase 1",
              languages: Array.isArray(data.other_information?.languages)
                ? data.other_information.languages
                : ["es"],
              flight_hours: data.other_information?.flight_hours ?? undefined,
            },
            owner_ids: ownerIds,
            isEncargado: Boolean(data.isEncargado),
            managed_aircrafts: Array.isArray(data.managed_aircrafts) ? data.managed_aircrafts : [],
            pilot_aircrafts: Array.isArray(data.pilot_aircrafts) ? data.pilot_aircrafts : [],
            accepted_terms_version: data.accepted_terms_version || "",
            updated_at: parseDate(data.updated_at),
          };

          result.push(profile);
        });

        return result;
      } catch (error) {
        console.error("Error al obtener los pilotos del propietario en useOwnerPilots:", error);
        throw error;
      }
    },
    enabled: !!ownerUid,
  });
}
