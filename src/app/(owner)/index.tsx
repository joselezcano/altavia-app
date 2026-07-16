import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "react-native";


// Used in DEV mode only to load airports
import airports_na from "@/assets/data/airports_na.json";
import { db } from "@/config/firebase";
import { Airport } from "@/types/all-roles";
import { collection, doc, writeBatch } from "firebase/firestore";


export default function Dashboard() {

  const loadAirports = async () => {
    const airports = airports_na as Airport[];
    const chunk = 500;
    console.log('Airports to load: ', airports.length);

    for (let i = 0; i < airports.length; i += chunk) {
      let loadedAirports = 0;
      const batch = writeBatch(db);
      for (let j = 0; j < chunk; j++) {
        if (i + j < airports.length) {
          const documentRef = doc(collection(db, 'airports'));
          batch.set(documentRef, airports[i + j]);
          loadedAirports++;
        }
      }
      // Write stream exhausted maximum allowed queued writes. Max 30 batches
      batch.commit().then(() => {
        console.log(`Loaded airports in this chunk: ${loadedAirports}`);
      });
    }
  }

  return (
    <ThemedView
      style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
    >
      <ThemedText>Dashboard</ThemedText>
      {!__DEV__ &&
        <Button title="Cargar aeropuertos" onPress={loadAirports} disabled={true} />
      }
    </ThemedView>
  );
}