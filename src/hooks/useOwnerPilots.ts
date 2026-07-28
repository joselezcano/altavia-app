import { db } from "@/config/firebase";
import { PilotProfile } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { collection, documentId, getDocs, query, Timestamp, where } from "firebase/firestore";


export function useOwnerPilots(ownerUid: string | undefined) {
  return useQuery<PilotProfile[]>({
    queryKey: ["owner-pilots", ownerUid],
    queryFn: async () => {
      if (!ownerUid) return [];

      // 1. Fetch from 'pilots' collection where owner_ids contains ownerUid
      const pilotsQuery = query(
        collection(db, "pilots"),
        where("owner_ids", "array-contains", ownerUid)
      );

      const snap = await getDocs(pilotsQuery);

      const pilotDocsMap = new Map<string, PilotProfile>();
      snap.forEach((doc) => pilotDocsMap.set(doc.id, doc.data() as PilotProfile));

      const pilotUids = Array.from(pilotDocsMap.keys());
      if (pilotUids.length === 0) return [];

      // 2. Fetch corresponding base user info from 'users' collection for missing basic info
      const usersQuery = query(
        collection(db, "users"),
        where(documentId(), "in", pilotUids)
      );
      const usersSnapshot = await getDocs(usersQuery);

      const usersMap: Record<string, BaseUser> = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = doc.data() as BaseUser;
      });

      // 3. Map doc data to PilotProfile schema
      const result: PilotProfile[] = [];

      pilotDocsMap.forEach((data, docId) => {

        const ownerIds: string[] = Array.isArray(data.owner_ids) ? data.owner_ids : [ownerUid];

        const profile: PilotProfile = {
          user: {
            uid: usersMap[docId].uid || "",
            email: usersMap[docId].email || "",
            firstName: usersMap[docId].firstName || "",
            lastName: usersMap[docId].lastName || "",
          },
          basic: {
            id_first_name: data.basic.id_first_name || "",
            id_last_name: data.basic.id_last_name || "",
            id_type: data.basic.id_type || "",
            id_number: data.basic.id_number || "",
            id_country: data.basic.id_country || "",
            id_nationality: data.basic.id_nationality || "",
            id_date_of_birth: (data.basic.id_date_of_birth as Timestamp).toDate() || new Date(),
            telephone: data.basic.telephone || "",
          },
          aeronautical: {
            pilot_licence: data.aeronautical.pilot_licence || "",
            licence_type: data.aeronautical.licence_type || "Piloto privado",
            licence_permits: data.aeronautical.licence_permits || "",
            licence_issuer: data.aeronautical.licence_issuer || "",
          },
          other_information: {
            aeronautical_medical_certificate: data.other_information.aeronautical_medical_certificate || "Clase 1",
            languages: Array.isArray(data.other_information.languages) ? data.other_information.languages : ["es"],
            flight_hours: data.other_information.flight_hours ?? undefined,
          },
          owner_ids: ownerIds,
          isEncargado: Boolean(data.isEncargado),
          managed_aircrafts: Array.isArray(data.managed_aircrafts) ? data.managed_aircrafts : [],
          pilot_aircrafts: Array.isArray(data.pilot_aircrafts) ? data.pilot_aircrafts : [],
          accepted_terms_version: data.accepted_terms_version || "",
          updated_at: (data.updated_at as Timestamp).toDate() || new Date(),
        };

        result.push(profile);
      });

      return result;
    },
    enabled: !!ownerUid,
  });
}

