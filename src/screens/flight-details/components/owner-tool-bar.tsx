import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/useAuth";
import { ClientReservationItem } from "@/types/all-roles";
import { roleFlightRoute, toHref } from "@/utils/role-routes";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

export function OwnerToolBar({
    reservation,
    outboundFlightPlanId,
    returnFlightPlanId,
    aircraftModel,
    onOpenManifest,
    onEditReservation,
    editLabel,
    onDeleteReservation,
    isDeleting = false,
}: {
    reservation: ClientReservationItem;
    outboundFlightPlanId?: string;
    returnFlightPlanId?: string;
    aircraftModel?: string;
    onOpenManifest?: () => void;
    /** Editar (sin pagar) o reprogramar (pagada). Sin callback no se muestra. */
    onEditReservation?: () => void;
    editLabel?: string;
    /** Eliminar: solo se pasa para reservas sin pagar. */
    onDeleteReservation?: () => void;
    isDeleting?: boolean;
}) {
    const router = useRouter();
    const { role } = useAuth();

    const handleOutboundFpl = () => {
        if (outboundFlightPlanId) {
            router.push({
                pathname: "./view-flight-plan",
                params: {
                    flightPlanId: outboundFlightPlanId,
                    aircraftModel: aircraftModel,
                },
            });
        } else {
            const originIdent = reservation.trip?.origin_airport_ident || "";
            const destIdent = reservation.trip?.destination_airport_ident || "";
            const originIcao = reservation.originAirport?.icao_code || originIdent;
            const destIcao = reservation.destinationAirport?.icao_code || destIdent;
            const depTime = reservation.schedule?.outbound_flight_departure_time
                ? (reservation.schedule.outbound_flight_departure_time instanceof Date
                    ? reservation.schedule.outbound_flight_departure_time.toISOString()
                    : new Date(reservation.schedule.outbound_flight_departure_time).toISOString())
                : new Date().toISOString();

            const paxCount = reservation.passengers && reservation.passengers.length > 0
                ? String(reservation.passengers.length)
                : String(reservation.capacity?.passangers || 1);

            const fplParams = {
                reservationId: reservation.id,
                legType: "outbound",
                originIdent,
                destinationIdent: destIdent,
                originIcaoCode: originIcao,
                destinationIcaoCode: destIcao,
                departureTime: depTime,
                aircraftId: reservation.aircraftId || "",
                paxCount,
            };
            // Ruta del grupo del rol activo: owner → (owner)/flights, encargada → (pilot)/flights.
            router.push(
                toHref(
                    roleFlightRoute(role, "create-flight-plan", fplParams) ?? {
                        pathname: "/flights/create-flight-plan",
                        params: fplParams,
                    }
                )
            );
        }
    };

    const handleReturnFpl = () => {
        if (returnFlightPlanId) {
            router.push({
                pathname: "./view-flight-plan",
                params: {
                    flightPlanId: returnFlightPlanId,
                    aircraftModel: aircraftModel,
                },
            });
        } else {
            const originIdent = reservation.trip?.destination_airport_ident || "";
            const destIdent = reservation.trip?.origin_airport_ident || "";
            const originIcao = reservation.destinationAirport?.icao_code || originIdent;
            const destIcao = reservation.originAirport?.icao_code || destIdent;
            const depTime = reservation.schedule?.return_flight_departure_time
                ? (reservation.schedule.return_flight_departure_time instanceof Date
                    ? reservation.schedule.return_flight_departure_time.toISOString()
                    : new Date(reservation.schedule.return_flight_departure_time).toISOString())
                : new Date().toISOString();

            const paxCount = reservation.passengers && reservation.passengers.length > 0
                ? String(reservation.passengers.length)
                : String(reservation.capacity?.passangers || 1);

            const fplParams = {
                reservationId: reservation.id,
                legType: "return",
                originIdent,
                destinationIdent: destIdent,
                originIcaoCode: originIcao,
                destinationIcaoCode: destIcao,
                departureTime: depTime,
                aircraftId: reservation.aircraftId || "",
                paxCount,
            };
            // Ruta del grupo del rol activo: owner → (owner)/flights, encargada → (pilot)/flights.
            router.push(
                toHref(
                    roleFlightRoute(role, "create-flight-plan", fplParams) ?? {
                        pathname: "/flights/create-flight-plan",
                        params: fplParams,
                    }
                )
            );
        }
    };

    const passengerCount = reservation.passengers?.length || 0;

    return (
        <View className="flex-col gap-2">
            <View className="flex-row items-center gap-3 mb-1">
                {/* Tripulación Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./assign-pilots",
                            params: {
                                reservationId: reservation.id,
                            },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="account-tie-hat" size={18} color="#FFFFFF" />
                    <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                        Tripulación{reservation.pilot_ids && reservation.pilot_ids.length > 0 ? ` (${reservation.pilot_ids.length})` : ""}
                    </ThemedText>
                </TouchableOpacity>

                {/* Manifiesto Pasajeros DINAC Button */}
                {onOpenManifest && (
                    <TouchableOpacity
                        onPress={onOpenManifest}
                        className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                        activeOpacity={0.8}
                    >
                        <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                        <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                            Manifiesto{passengerCount > 0 ? ` (${passengerCount})` : ""}
                        </ThemedText>
                    </TouchableOpacity>
                )}

                {/* Tracking de Vuelo Button */}
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "./flight-tracker",
                            params: { fa_flight_id: reservation.fa_flight_id ?? "" },
                        })
                    }
                    className="flex-1 bg-brand-blue py-3 px-1 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <Ionicons name="location-outline" size={18} color="#FFFFFF" />
                    <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                        Tracking
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {/* Flight Plan Buttons */}
            <View className="flex-row items-center gap-3 mb-2">
                {/* Plan de Vuelo (Ida) */}
                <TouchableOpacity
                    onPress={handleOutboundFpl}
                    className="flex-1 bg-brand-blue py-3 px-2 rounded-xl items-center justify-center gap-1 shadow-sm"
                    activeOpacity={0.8}
                >
                    <View className="flex-row items-center">
                        <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
                        {outboundFlightPlanId && (
                            <View className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
                        )}
                    </View>
                    <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                        {outboundFlightPlanId ? "Ver FPL (Ida)" : "Crear FPL (Ida)"}
                    </ThemedText>
                </TouchableOpacity>

                {/* Plan de Vuelo (Vuelta) if roundtrip */}
                {reservation.schedule?.roundtrip && (
                    <TouchableOpacity
                        onPress={handleReturnFpl}
                        className="flex-1 bg-brand-blue py-3 px-2 rounded-xl items-center justify-center gap-1 shadow-sm"
                        activeOpacity={0.8}
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
                            {returnFlightPlanId && (
                                <View className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
                            )}
                        </View>
                        <ThemedText className="text-xs font-bold text-white text-center" numberOfLines={1}>
                            {returnFlightPlanId ? "Ver FPL (Vuelta)" : "Crear FPL (Vuelta)"}
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {/* Editar / Eliminar reserva */}
            {(onEditReservation || onDeleteReservation) && (
                <View style={styles.manageRow}>
                    {onEditReservation && (
                        <TouchableOpacity onPress={onEditReservation} style={styles.editButton} activeOpacity={0.8}>
                            <Ionicons name="create-outline" size={17} color="#030436" />
                            <Text style={styles.editButtonText} numberOfLines={1}>
                                {editLabel || "Editar Reserva"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {onDeleteReservation && (
                        <TouchableOpacity
                            onPress={onDeleteReservation}
                            disabled={isDeleting}
                            style={styles.deleteButton}
                            activeOpacity={0.8}
                        >
                            {isDeleting ? (
                                <ActivityIndicator size="small" color="#B91C1C" />
                            ) : (
                                <Ionicons name="trash-outline" size={17} color="#B91C1C" />
                            )}
                            <Text style={styles.deleteButtonText} numberOfLines={1}>
                                Eliminar
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    manageRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
    },
    editButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#0165FF",
        backgroundColor: "#FFFFFF",
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#030436",
    },
    deleteButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
        backgroundColor: "#FEF2F2",
    },
    deleteButtonText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#B91C1C",
    },
});