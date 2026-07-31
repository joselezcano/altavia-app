import { db } from "@/config/firebase";
import { PilotProfile } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { collection, documentId, getDocs, query, Timestamp, where } from "firebase/firestore";

export function useReservationPilots(pilotIds: string[] | undefined) {
  return useQuery<PilotProfile[]>({
    queryKey: ["reservation-pilots", pilotIds],
    queryFn: async () => {
      if (!pilotIds || pilotIds.length === 0) return [];

      try {
        // Fetch pilot docs from 'pilots' collection where documentId() is in pilotIds
        const pilotsQuery = query(
          collection(db, "pilots"),
          where(documentId(), "in", pilotIds)
        );

        const snap = await getDocs(pilotsQuery);

        const pilotDocsMap = new Map<string, PilotProfile>();
        snap.forEach((doc) => pilotDocsMap.set(doc.id, doc.data() as PilotProfile));

        const fetchedPilotUids = Array.from(pilotDocsMap.keys());
        if (fetchedPilotUids.length === 0) return [];

        // Fetch corresponding base user info from 'users' collection for names
        const usersQuery = query(
          collection(db, "users"),
          where(documentId(), "in", fetchedPilotUids)
        );
        const usersSnapshot = await getDocs(usersQuery);

        const usersMap: Record<string, BaseUser> = {};
        usersSnapshot.forEach((doc) => {
          usersMap[doc.id] = doc.data() as BaseUser;
        });

        // Construct list of PilotProfile objects
        const result: PilotProfile[] = [];

        pilotDocsMap.forEach((data, docId) => {
          const userObj = usersMap[docId];
          const profile: PilotProfile = {
            user: {
              uid: userObj?.uid || docId,
              email: userObj?.email || "",
              firstName: userObj?.firstName || "",
              lastName: userObj?.lastName || "",
            },
            basic: {
              id_first_name: data.basic?.id_first_name || "",
              id_last_name: data.basic?.id_last_name || "",
              id_type: data.basic?.id_type || "Documento de Identidad",
              id_number: data.basic?.id_number || "",
              id_country: data.basic?.id_country || "",
              id_nationality: data.basic?.id_nationality || "",
              id_date_of_birth: data.basic?.id_date_of_birth
                ? (data.basic.id_date_of_birth as Timestamp).toDate()
                : new Date(),
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
            owner_ids: data.owner_ids || [],
            isEncargado: Boolean(data.isEncargado),
            managed_aircrafts: data.managed_aircrafts || [],
            pilot_aircrafts: data.pilot_aircrafts || [],
            accepted_terms_version: data.accepted_terms_version || "",
            updated_at: data.updated_at
              ? (data.updated_at as Timestamp).toDate()
              : new Date(),
          };

          result.push(profile);
        });

        return result;
      } catch (error) {
        console.error("Error fetching reservation pilots:", error);
        return [];
      }
    },
    enabled: !!pilotIds && pilotIds.length > 0,
  });
}
