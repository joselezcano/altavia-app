import { db } from "@/config/firebase";
import { PilotProfile } from "@/types/pilot";
import { BaseUser } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc, Timestamp } from "firebase/firestore";

export function usePilotDetails(pilotUid: string | undefined) {
  return useQuery<PilotProfile | null>({
    queryKey: ["pilot-details", pilotUid],
    queryFn: async () => {
      if (!pilotUid) return null;

      // 1. Fetch pilot doc from 'pilots' collection
      const pilotRef = doc(db, "pilots", pilotUid);
      const pilotSnap = await getDoc(pilotRef);

      if (!pilotSnap.exists()) return null;

      const data = pilotSnap.data();

      // 2. Fetch corresponding base user info from 'users' collection
      const userRef = doc(db, "users", pilotUid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as BaseUser) : null;

      // Helper function to safely parse timestamps or dates
      const parseDate = (val: any): Date => {
        if (!val) return new Date();
        if (val instanceof Timestamp) return val.toDate();
        if (val.toDate && typeof val.toDate === "function") return val.toDate();
        return new Date(val);
      };

      // 3. Map to PilotProfile
      const profile: PilotProfile = {
        user: {
          uid: userData?.uid || pilotUid,
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
        owner_ids: Array.isArray(data.owner_ids) ? data.owner_ids : [],
        isEncargado: Boolean(data.isEncargado),
        managed_aircrafts: Array.isArray(data.managed_aircrafts)
          ? data.managed_aircrafts
          : [],
        pilot_aircrafts: Array.isArray(data.pilot_aircrafts)
          ? data.pilot_aircrafts
          : [],
        accepted_terms_version: data.accepted_terms_version || "",
        updated_at: parseDate(data.updated_at),
      };

      return profile;
    },
    enabled: !!pilotUid,
  });
}
