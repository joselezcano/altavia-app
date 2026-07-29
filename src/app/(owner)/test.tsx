import { ThemedText } from "@/components/themed-text";
import { db } from "@/config/firebase";
import { flightCurrentPositionSample } from "@/utils/sample-data";
import { addDoc, collection, doc, Firestore, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from 'react-native';


// Used to load airports
import airports_sa from "@/assets/data/airports_sa.json";
import { Airport } from "@/types/all-roles";
import { buildSearchTags, getSearchableFields } from "@/utils/search-airport";
import { getAirportTimezone } from "@/utils/timezone";


export default function Test() {
    const [loading, setLoading] = useState(false);

    const handleFetchFlightPosition = async () => {
        setLoading(true);
        try {
            const fa_flight_id = process.env.EXPO_PUBLIC_FA_FLIGHT_ID ?? '';
            const flightCurrentPositionSample = await getFlightCurrentPosition(fa_flight_id);
            loadFlightCurrentPositionSample(db, flightCurrentPositionSample);
        } catch (error) {
            console.error("Error: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadFlightPositionSample = () => {
        loadFlightCurrentPositionSample(db, flightCurrentPositionSample);
        setLoading(false);
    };

    const handleSearchFlights = async () => {
        setLoading(true);
        try {
            const airport = 'SGAS'; // ASU = SGAS, AGT = SGES, MVD = SUMU, AEP = SABE, GRU = SBGR
            const airportFlights = await searchFlightsByAirport(airport);
            // const airportFlights = await searchFlightsByAircraftIdent('ZPBWK');
            loadAirportFlights(db, airportFlights);
        } catch (error) {
            console.error("Error: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchFlightMap = async () => {
        setLoading(true);
        try {
            const fa_flight_id = process.env.EXPO_PUBLIC_FA_FLIGHT_ID ?? '';
            const flightMap = await getFlightMap(fa_flight_id);
            loadFlightMap(db, flightMap, fa_flight_id);
        } catch (error) {
            console.error("Error: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchFlightByAircraftRegistration = async () => {
        setLoading(true);
        try {
            const registration = 'ZP-BMR';
            const flightsByRegistration = await searchFlightsByAircraftRegistration(registration);
            loadFlightsByRegistration(db, flightsByRegistration);
        } catch (error) {
            console.error("Error: ", error);
        } finally {
            setLoading(false);
        }
    };

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
            addDoc(collection(db, "aircraft-templates"), c208Template);
            addDoc(collection(db, "aircraft-templates"), be20Template);
            Alert.alert("Éxito", "¡Plantillas cargadas con éxito en Firestore!");
        } catch (e) {
            console.error("Error al cargar plantillas:", e);
            Alert.alert("Error", "Error al cargar plantillas.");
        }
    };

    return (
        <View className="flex-1 items-center justify-center bg-white dark:bg-gray-950">
            <Text className="text-gray-900 dark:text-white">Flight Current Position</Text>
            <TouchableOpacity
                onPress={handleFetchFlightPosition}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load from AeroAPI"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleLoadFlightPositionSample}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load sample data"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleSearchFlights}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Search flights"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleFetchFlightMap}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load flight map"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleSearchFlightByAircraftRegistration}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load flight info"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={loadAirports}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load airports"}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={loadTemplates}
                className="bg-brand-gold px-6 py-4 rounded-xl shadow-md mt-4"
                activeOpacity={0.8}
                disabled={loading}
            >
                <ThemedText className="text-white font-bold">{loading ? "Loading..." : "Load aircraft templates"}</ThemedText>
            </TouchableOpacity>
        </View >
    );
}


const loadFlightCurrentPositionSample = (db: Firestore, flightCurrentPosition: FlightCurrentPosition) => {
    addDoc(collection(db, 'flight-current-position'), flightCurrentPosition).then(() => {
        console.log('Flight current position added!');
    });
};


const loadFlightMap = (db: Firestore, flightMap: FlightMap, fa_flight_id: string) => {
    // Upsert map
    getDocs(
        query(
            collection(db, 'flight-maps'),
            where('fa_flight_id', '==', fa_flight_id)
        )
    ).then(querySnapshot => {
        if (querySnapshot.size > 0) {
            querySnapshot.forEach(documentSnapshot => {
                updateDoc(doc(collection(db, 'flight-maps'), documentSnapshot.id), {
                    map: flightMap.map,
                    createdAt: serverTimestamp(),
                }).then(() => {
                    console.log('Flight map updated!');
                });
            });
        } else {
            const flightMapWithID = { ...flightMap, fa_flight_id: fa_flight_id, createdAt: serverTimestamp() } as FlightMapWithID;
            addDoc(collection(db, 'flight-maps'), flightMapWithID).then(() => {
                console.log('Flight map added!');
            });
        }
    });
    // If in a cloud function a docRef is available, use setDoc and { merge: true } as explained in https://docs.cloud.google.com/firestore/native/docs/manage-data/add-data#set_a_document
};


const loadAirportFlights = (db: Firestore, airportFlights: FlightSearchResult) => {
    const batch = writeBatch(db);

    airportFlights.flights.forEach(flight => {
        // Generate a reference with a random ID
        const documentRef = doc(collection(db, 'aeroapi-flights-per-airport'));
        batch.set(documentRef, flight);
    });

    batch.commit().then(() => {
        console.log('Airport flights successfully loaded in a batch. #Flights: ', airportFlights.flights.length);
    });
}


const loadFlightsByRegistration = (db: Firestore, flightsByRegistration: FlightByRegistration) => {
    const batch = writeBatch(db);

    flightsByRegistration.flights.forEach(flight => {
        // Generate a reference with a random ID
        const documentRef = doc(collection(db, 'aeroapi-flights-by-registration'));
        batch.set(documentRef, flight);
    });

    batch.commit().then(() => {
        console.log('Flights by registration successfully loaded in a batch. #Flights: ', flightsByRegistration.flights.length);
    });
}


import { fetch } from 'expo/fetch';

// AeroAPI async data fetching function using HTTP GET
async function getAeroAPI<T>(url: URL): Promise<T> {
    const apiKey = process.env.EXPO_PUBLIC_AEROAPI_KEY ?? '';
    if (!apiKey) {
        throw new Error('AeroAPI key was not set as an environment variable in the file .env');
    }
    const response = await fetch(url, {
        headers: {
            "x-apikey": apiKey
        },
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<T>;
}


import { FlightByRegistration, flightByRegistrationSchema, FlightCurrentPosition, flightCurrentPositionSchema, FlightMap, flightMapSchema, FlightMapWithID, FlightSearchResult, flightSearchResultSchema } from "@/types/aeroapi";

async function getFlightCurrentPosition(fa_flight_id: string) {
    const aeroApiUrl = process.env.EXPO_PUBLIC_AEROAPI_URL ?? '';
    const pathname = `/aeroapi/flights/${fa_flight_id}/position`;
    if (URL.canParse(pathname, aeroApiUrl)) {
        const url = new URL(pathname, aeroApiUrl);
        const response = await getAeroAPI<FlightCurrentPosition>(url);
        // Validate the response. Throws an error if the JSON structure is incorrect.
        const validatedData: FlightCurrentPosition = flightCurrentPositionSchema.parse(response);
        return validatedData;
    } else {
        throw new Error('Could not parse AeroAPI URL');
    }
}

async function searchFlightsByAirport(airport: string) {
    const aeroApiUrl = process.env.EXPO_PUBLIC_AEROAPI_URL ?? '';
    const pathname = "/aeroapi/flights/search";
    if (URL.canParse(pathname, aeroApiUrl)) {
        const url = new URL(pathname, aeroApiUrl);
        url.searchParams.set("query", `-originOrDestination ${airport}`);
        url.searchParams.set("max_pages", "1");
        const response = await getAeroAPI<FlightSearchResult>(url);
        // Validate the response. Throws an error if the JSON structure is incorrect.
        const validatedData: FlightSearchResult = flightSearchResultSchema.parse(response);
        return validatedData;
    } else {
        throw new Error('Could not parse AeroAPI URL');
    }
}

async function searchFlightsByAircraftIdent(ident: string) {
    const aeroApiUrl = process.env.EXPO_PUBLIC_AEROAPI_URL ?? '';
    const pathname = "/aeroapi/flights/search";
    if (URL.canParse(pathname, aeroApiUrl)) {
        const url = new URL(pathname, aeroApiUrl);
        url.searchParams.set("query", `-identOrReg ${ident}`);
        url.searchParams.set("max_pages", "1");
        const response = await getAeroAPI<FlightSearchResult>(url);
        // Validate the response. Throws an error if the JSON structure is incorrect.
        const validatedData: FlightSearchResult = flightSearchResultSchema.parse(response);
        return validatedData;
    } else {
        throw new Error('Could not parse AeroAPI URL');
    }
}

async function searchFlightsByAircraftRegistration(registration: string) {
    const aeroApiUrl = process.env.EXPO_PUBLIC_AEROAPI_URL ?? '';
    const pathname = `/aeroapi/flights/${registration}`;
    if (URL.canParse(pathname, aeroApiUrl)) {
        const url = new URL(pathname, aeroApiUrl);
        url.searchParams.set("max_pages", "1");
        const response = await getAeroAPI<FlightByRegistration>(url);
        // Validate the response. Throws an error if the JSON structure is incorrect.
        const validatedData: FlightByRegistration = flightByRegistrationSchema.parse(response);
        return validatedData;
    } else {
        throw new Error('Could not parse AeroAPI URL');
    }
}

async function getFlightMap(fa_flight_id: string) {
    const aeroApiUrl = process.env.EXPO_PUBLIC_AEROAPI_URL ?? '';
    const pathname = `/aeroapi/flights/${fa_flight_id}/map`;
    if (URL.canParse(pathname, aeroApiUrl)) {
        const url = new URL(pathname, aeroApiUrl);
        // Optional layers that seem to come by default
        // url.searchParams.append("layer_on", "major airports");
        // url.searchParams.append("layer_on", "country boundaries");
        // url.searchParams.append("layer_on", "water");
        // url.searchParams.append("layer_on", "radar");
        // url.searchParams.append("layer_on", "track");
        const response = await getAeroAPI<FlightMap>(url);
        // Validate the response. Throws an error if the JSON structure is incorrect.
        const validatedData: FlightMap = flightMapSchema.parse(response);
        return validatedData;
    } else {
        throw new Error('Could not parse AeroAPI URL');
    }
}