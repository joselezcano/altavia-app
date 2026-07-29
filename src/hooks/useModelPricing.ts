import { db } from "@/config/firebase";
import { ModelPricing } from "@/types/pricing";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";

export interface ModelPricingDoc extends ModelPricing {
  id: string;
}

export function useModelPricing() {
  return useQuery<ModelPricingDoc[]>({
    queryKey: ["model-pricing"],
    queryFn: async () => {
      try {
        const q = collection(db, "model-pricing");
        const snapshot = await getDocs(q);
        const list: ModelPricingDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            model: data.model,
            defaultPricePerMile: data.defaultPricePerMile,
            updatedAt: data.updatedAt,
          });
        });

        return list;
      } catch (error) {
        console.error("Error fetching model pricing in useModelPricing:", error);
        throw error;
      }
    },
  });
}
