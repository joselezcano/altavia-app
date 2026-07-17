import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getAirportTimezone } from "@/utils/timezone";
import { Button } from "react-native";


// Used in DEV mode only to load airports
import airports_sa from "@/assets/data/airports_sa.json";
import { db } from "@/config/firebase";
import { Airport } from "@/types/all-roles";
import { collection, doc, writeBatch } from "firebase/firestore";


const buildSearchTags = (airport: Airport) => {
  // Fields to search
  const searchableFields = `${airport.name} ${airport.municipality ?? ''} ${airport.region} ${airport.country} ${airport.iata_code ?? ''} ${airport.icao_code ?? ''} ${airport.gps_code ?? ''}`.toLowerCase();

  // Split by spaces, remove empty strings, and get unique values
  let words = searchableFields.split(/\s+/).filter(Boolean);

  // Add words without accents and diacritics
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  words.push(...words.map(removeAccents));

  // Remove parenthesis
  words = words.map((word) => word.replace(/[()]/g, ""));

  // Unique words
  const keywords = Array.from(new Set(words));

  // Remove common words
  const commonWords = [
    'united', 'states',
    'airport', 'aeropuerto',
    'heliport', 'helipuerto', 'helipad', 'helicentro',
    'international', 'internacional',
    'national', 'nacional',
    'department', 'departamento',
    'region', 'region', 'región', 'regiao', 'região',
    'country', 'pais', 'país',
    'municipality', 'municipio', 'município',
    'city', 'ciudad',
    'state', 'estado',
    'county', 'condado',
    'district', 'distrito',
    'territory', 'territorio',
    'province', 'provincia',
    'aerodromo', 'aeródromo',
    'base', 'federal',
    '-', '/', '&',
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
    'do', 'da', 'dos', 'das', 'e', 'a', 'o',
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'for', 'unassigned', 'under'
  ];
  const filteredKeywords = keywords.filter((keyword) => !commonWords.includes(keyword));

  // Generate n-grams to enable partial word matching during search
  const nGrams = new Set<string>();

  filteredKeywords.forEach(word => {
    // Generate prefixes starting at 3 characters up to the full word length
    for (let i = 3; i <= word.length; i++) {
      nGrams.add(word.substring(0, i));
    }
  });

  return Array.from(nGrams);
};

// @ts-ignore
const chooseOneTimezone = (timezones: string[], airport: Airport) => {
  if (timezones.length === 0) {
    return "";
  }

  if (timezones.length === 1) {
    return timezones[0];
  }

  // Prefer match with municipality (city) because the IANA timezone format is Region/City
  // The region is usually the continent in America
  const searchString = (airport.municipality?.toLowerCase() ?? '') + ' ' + airport.region.toLowerCase() + ' ' + airport.country.toLowerCase();

  const matches: number[] = [];
  timezones.forEach((timezone, i) => {
    const city = timezone.toLowerCase().split('/')[1];
    if (searchString.includes(city)) matches.push(i);
  });

  // Pick the first match because getAirportTimezone (geo-tz) provides timezones ordered by highest population nearby
  return matches.length > 0 ? timezones[matches[0]] : "";
}


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
            airportsPY[i + j].search_tags = buildSearchTags(airportsPY[i + j]);
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
            airports[i + j].search_tags = buildSearchTags(airports[i + j]);
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