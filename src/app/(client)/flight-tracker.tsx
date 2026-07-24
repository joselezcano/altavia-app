import { Card } from "@/components/card";
import { db } from "@/config/firebase";
import { FlightCurrentPosition, FlightMapWithID } from '@/types/aeroapi';
import { Column, Host, RNHostView, ScrollView } from '@expo/ui';
import { Image } from 'expo-image';
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { cssInterop } from 'nativewind';
import { useEffect, useState } from "react";
import { View } from "react-native";


export default function FlightTrackerTab() {
    const [mapBase64Image, setMapBase64Image] = useState('');
    const [flightDetails, setFlightDetails] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [lastPosition, setLastPosition] = useState('');

    cssInterop(Image, { className: 'style' }); // Adds Nativewind classes to Expo UI component
    const blurhash = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

    const fa_flight_id = process.env.EXPO_PUBLIC_FA_FLIGHT_ID ?? '';

    useEffect(() => {
        getDocs(
            query(
                collection(db, 'flight-maps'),
                where('fa_flight_id', '==', fa_flight_id)
            )
        ).then(querySnapshot => {
            querySnapshot.forEach(documentSnapshot => {
                const flightMap = documentSnapshot.data() as FlightMapWithID;
                setMapBase64Image(flightMap.map);
            });
        });

        getDocs(
            query(
                collection(db, 'flight-current-position'),
                where('fa_flight_id', '==', fa_flight_id),
                orderBy('last_position.timestamp', 'desc'),
                limit(1)
            )
        ).then(querySnapshot => {
            querySnapshot.forEach(documentSnapshot => {
                const fp = documentSnapshot.data() as FlightCurrentPosition;
                const scheduledDepartureTime = ""; // TODO: Obtain from flight plan
                let flightStatus = "scheduled"
                let departureTime = scheduledDepartureTime;
                let arrivalTime = "";
                let elapsedTime = "";
                if (fp.actual_off) {
                    const timestamp_off = (fp.actual_off as Timestamp);
                    if (fp.origin?.timezone) {
                        departureTime = timestamp_off.toDate().toLocaleString('en-US', { timeZone: fp.origin.timezone });
                    } else {
                        departureTime = timestamp_off.toDate().toLocaleString() + " (local)";
                    }
                    if (fp.actual_on) {
                        if (fp.actual_on !== fp.actual_off) {
                            flightStatus = "arrived";
                            const timestamp_on = (fp.actual_on as Timestamp);
                            if (fp.destination?.timezone) {
                                arrivalTime = timestamp_on.toDate().toLocaleString('en-US', { timeZone: fp.destination.timezone });
                            } else {
                                arrivalTime = timestamp_on.toDate().toLocaleString() + " (local)";
                            }
                            arrivalTime = `\nArrival time:\t\t ${arrivalTime}`;
                        } else {
                            flightStatus = "to be confirmed";
                        }
                    } else {
                        // TODO: Elapsed time could update every one minute in the UI
                        elapsedTime = `\nElapsed time:\t\t ${formatTimeDifference(Date.now() - timestamp_off.toDate().getTime())}`;
                        flightStatus = "en route";
                    }
                }
                const flightDetailsText = `Number:\t\t\t ${fp.ident_icao} / ${fp.ident_iata}\nAircraft type:\t\t ${fp.aircraft_type}\nStatus:\t\t\t ${flightStatus}${elapsedTime}`;
                const originText = `Airport:\t\t\t ${fp.origin?.name} (${fp.origin?.code_iata})\nCity:\t\t\t\t ${fp.origin?.city}\nDeparture time:\t ${departureTime}`;
                const destinationText = `Airport:\t\t\t ${fp.destination?.name} (${fp.destination?.code_iata})\nCity:\t\t\t\t ${fp.destination?.city}${arrivalTime}`;
                const latitude = convertToDMS(fp.last_position.latitude, true);
                const longitude = convertToDMS(fp.last_position.longitude, false);
                const lastPositionText = `Latitude:\t\t\t ${latitude}\nLongitude:\t\t ${longitude}\nAltitude:\t\t\t ${fp.last_position.altitude * 100} ft\nGroundspeed:\t\t ${fp.last_position.groundspeed} knots\nHeading:\t\t\t ${fp.last_position.heading}°`;
                setFlightDetails(flightDetailsText);
                setOrigin(originText);
                setDestination(destinationText);
                setLastPosition(lastPositionText);
            });
        });
    }, []);

    return (
        <Host style={{ flex: 1 }}>
            <ScrollView>
                <Column spacing={8}>
                    <RNHostView matchContents>
                        <View className="gap-4 px-4 bg-white dark:bg-gray-950">
                            <View className="w-full">
                                <Image
                                    className="w-full aspect-[4/3]"
                                    source={{ uri: `data:image/png;base64,${mapBase64Image}` }}
                                    placeholder={{ blurhash }}
                                    contentFit="cover"
                                    transition={1000}
                                />
                            </View>
                            <Card title="Flight" content={flightDetails} />
                            <Card title="Origin" content={origin} />
                            <Card title="Destination" content={destination} />
                            <Card title="Position" content={lastPosition} />
                        </View>
                    </RNHostView>
                </Column>
            </ScrollView>
        </Host>
    );
}


function formatTimeDifference(diffInMs: number) {
    // Calculate total hours and the remaining minutes
    const totalHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${totalHours}h ${remainingMinutes}m`;
}


function convertToDMS(coordinate: number, isLat: boolean) {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);

    // Multiply remaining decimal by 60 to get minutes
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);

    // Multiply remaining decimal by 60 to get seconds (round to 2 decimal places)
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

    // Determine the cardinal direction hemisphere letter
    let direction = "";
    if (isLat) {
        direction = coordinate >= 0 ? "N" : "S";
    } else {
        direction = coordinate >= 0 ? "E" : "W";
    }

    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}