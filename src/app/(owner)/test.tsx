import { ThemedText } from "@/components/themed-text";
import { db } from "@/config/firebase";
import { flightCurrentPositionSample } from "@/utils/sample-data";
import { addDoc, collection, doc, Firestore, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useState } from "react";
import { Text, TouchableOpacity, View } from 'react-native';


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


import { FlightCurrentPosition, flightCurrentPositionSchema, FlightMap, flightMapSchema, FlightMapWithID, FlightSearchResult, flightSearchResultSchema } from "@/types/aeroapi";

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