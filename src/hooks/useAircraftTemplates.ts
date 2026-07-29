import { db } from "@/config/firebase";
import { AircraftTemplate } from "@/types/templates";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";

export interface AircraftTemplateDoc extends AircraftTemplate {
  id: string;
}

export function useAircraftTemplates() {
  return useQuery<AircraftTemplateDoc[]>({
    queryKey: ["aircraft-templates"],
    queryFn: async () => {
      try {
        const q = collection(db, "aircraft-templates");
        const snapshot = await getDocs(q);
        const list: AircraftTemplateDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data() as AircraftTemplate;
          list.push({
            id: doc.id,
            ...data,
          });
        });

        return list;
      } catch (error) {
        console.error("Error fetching aircraft templates in useAircraftTemplates:", error);
        throw error;
      }
    },
  });
}
