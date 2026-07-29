import React from "react";
import { Button, Alert } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getAirportTimezone } from "@/utils/timezone";
import airports_sa from "@/assets/data/airports_sa.json";
import { db } from "@/config/firebase";
import { Airport } from "@/types/all-roles";
import { buildSearchTags, getSearchableFields } from "@/utils/search-airport";
import { collection, doc, writeBatch } from "firebase/firestore";

export default function DevLoaderScreen() {
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
      Alert.alert("Prueba completada", "Consola analizada para Paraguay");
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
        await batch.commit();
        console.log(`Loaded airports in this chunk (from ${i + 1} to ${Math.min(i + chunk, airports.length)}): ${loadedAirports}`);
      }
      Alert.alert("Éxito", "Aeropuertos cargados en Firestore");
    }
  };

  const loadTemplates = async () => {
    const c208Template = {
      template_info: {
        name: "Cessna 208B Grand Caravan",
        type: "C208",
        model: "Cessna 208B Grand Caravan",
        default_pax_count: 10,
      },
      technical_specs: {
        equipment: ["S", "D", "G"],
        transponder: "S",
        flight_rules: "VFR",
        wake_turbulence_category: "L",
        fuel_capacity_gallons: 332,
      },
      operating_specs: {
        cruise_speed_knots: 185,
        fuel_burn_rate_gph: 45,
        service_ceiling_feet: 25000,
        max_takeoff_weight_lbs: 8750,
        takeoff_distance_feet: 2050,
        landing_distance_feet: 1625,
        rate_of_climb_fpm: 775,
      },
      emergency: {
        radio_equipment: ["V", "E"],
        survival_equipment: ["J", "M"],
        life_jacket_equipment: ["L"],
        dinghies_capacity: {
          carried: false,
        },
      },
    };

    const be20Template = {
      template_info: {
        name: "Beechcraft King Air B200",
        type: "BE20",
        model: "Beechcraft King Air B200",
        default_pax_count: 9,
      },
      technical_specs: {
        equipment: ["S", "D", "G", "I"],
        transponder: "E",
        flight_rules: "IFR",
        wake_turbulence_category: "M",
        fuel_capacity_gallons: 544,
      },
      operating_specs: {
        cruise_speed_knots: 280,
        fuel_burn_rate_gph: 100,
        service_ceiling_feet: 35000,
        max_takeoff_weight_lbs: 12500,
        takeoff_distance_feet: 2580,
        landing_distance_feet: 2845,
        rate_of_climb_fpm: 2450,
      },
      emergency: {
        radio_equipment: ["V", "U", "E"],
        survival_equipment: ["M"],
        life_jacket_equipment: ["L", "F"],
        dinghies_capacity: {
          carried: true,
          number: 1,
          total_capacity: 8,
          covered: true,
          color: "ORANGE",
        },
      },
    };

    try {
      const { collection, addDoc } = await import("firebase/firestore");
      await addDoc(collection(db, "aircraft-templates"), c208Template);
      await addDoc(collection(db, "aircraft-templates"), be20Template);
      Alert.alert("Éxito", "¡Plantillas cargadas con éxito en Firestore!");
    } catch (e) {
      console.error("Error al cargar plantillas:", e);
      Alert.alert("Error", "Error al cargar plantillas.");
    }
  };

  return (
    <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
      <ThemedText className="font-bold text-lg">Carga de Datos de Desarrollo</ThemedText>
      <Button title="Cargar aeropuertos" onPress={loadAirports} />
      <Button title="Cargar plantillas de prueba" onPress={loadTemplates} />
    </ThemedView>
  );
}
