import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getAirportTimezone } from "@/utils/timezone";
import { Button } from "react-native";


// Used in DEV mode only to load airports
import airports_sa from "@/assets/data/airports_sa.json";
import { db } from "@/config/firebase";
import { Airport } from "@/types/all-roles";
import { buildSearchTags, getSearchableFields } from "@/utils/search-airport";
import { collection, doc, writeBatch } from "firebase/firestore";


export default function Dashboard() {

  const loadAirports = async () => {
    const airports = airports_sa as Airport[];
    const chunk = 500;
    console.log('Airports to load: ', airports.length);

    const testSearchTags = true;

    if (testSearchTags) {
      const airportsPY = airports.filter((airport) => airport.country === 'Paraguay');
      for (let i = 0; i < airportsPY.length; i += chunk) {
        let loadedAirports = 0;
        for (let j = 0; j < chunk; j++) {
          if (i + j < airportsPY.length) {
            airportsPY[i + j].timezone = getAirportTimezone(airportsPY[i + j]);
            const searchableFields = getSearchableFields(airportsPY[i + j]);
            airportsPY[i + j].search_tags = buildSearchTags(searchableFields);
            console.log(airportsPY[i + j].timezone, airportsPY[i + j].search_tags);
            loadedAirports++;
          }
        }
      }
    } else {
      for (let i = 0; i < airports.length; i += chunk) {
        let loadedAirports = 0;
        const batch = writeBatch(db);
        for (let j = 0; j < chunk; j++) {
          if (i + j < airports.length) {
            const documentRef = doc(collection(db, 'airports'));
            airports[i + j].timezone = getAirportTimezone(airports[i + j]);
            const searchableFields = getSearchableFields(airports[i + j]);
            airports[i + j].search_tags = buildSearchTags(searchableFields);
            batch.set(documentRef, airports[i + j]);
            loadedAirports++;
          }
        }
        // Write stream exhausted maximum allowed queued writes. Max 30 batches
        batch.commit().then(() => {
          console.log(`Loaded airports in this chunk (from ${i + 1} to ${Math.min(i + chunk, airports.length)}): ${loadedAirports}`);
        });
      }
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