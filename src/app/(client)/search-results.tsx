import { useAvailableAircrafts } from "@/hooks/useAvailableAircrafts";
import { describeQuote } from "@/utils/flight-pricing";
import { FlightSearchForm } from "@/types/client";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ searchData?: string }>();

  const activeSearch = useMemo<FlightSearchForm | null>(() => {
    if (!params.searchData) return null;
    try {
      const parsed = JSON.parse(params.searchData);
      if (!parsed || typeof parsed !== "object" || !parsed.trip || !parsed.schedule) {
        return null;
      }
      return {
        ...parsed,
        schedule: {
          ...parsed.schedule,
          outbound_flight_datetime_utc: parsed.schedule?.outbound_flight_datetime_utc
            ? new Date(parsed.schedule.outbound_flight_datetime_utc)
            : null,
          return_flight_datetime_utc: parsed.schedule?.return_flight_datetime_utc
            ? new Date(parsed.schedule.return_flight_datetime_utc)
            : null,
        },
      };
    } catch (error) {
      console.error("Error al deserializar parámetros de búsqueda:", error);
      return null;
    }
  }, [params.searchData]);

  const {
    data: searchResults = [],
    isLoading: isSearching,
    isFetched: isSearchFetched,
  } = useAvailableAircrafts(activeSearch);

  return (
    <View style={styles.screenContainer}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/(client)/book");
            }
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#030436" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>
          Resultados de Búsqueda
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Search Parameters Summary Card */}
        {activeSearch && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                {/* Origin Airport */}
                <View style={styles.airportRow}>
                  <MaterialCommunityIcons name="airplane-takeoff" size={16} color="#030436" />
                  <Text style={styles.airportName} numberOfLines={1}>
                    {activeSearch.trip.origin_airport?.name || activeSearch.trip.origin_airport_ident}
                  </Text>
                </View>

                {/* Destination Airport */}
                <View style={styles.airportRow}>
                  <MaterialCommunityIcons name="airplane-landing" size={16} color="#030436" />
                  <Text style={styles.airportName} numberOfLines={1}>
                    {activeSearch.trip.destination_airport?.name || activeSearch.trip.destination_airport_ident}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryFooter}>
              <View style={styles.paxBadge}>
                <MaterialCommunityIcons name="seat-passenger" size={14} color="#030436" />
                <Text style={styles.paxText}>
                  {activeSearch.capacity.passangers}
                </Text>
              </View>
              <Text style={styles.dateText}>
                Ida: {activeSearch.schedule.outbound_flight_datetime_utc ? new Date(activeSearch.schedule.outbound_flight_datetime_utc).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) + ' hs' : "N/A"}
              </Text>
              {activeSearch.schedule.roundtrip && (
                <Text style={styles.dateText}>
                  Vuelta: {activeSearch.schedule.return_flight_datetime_utc ? new Date(activeSearch.schedule.return_flight_datetime_utc).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) + ' hs' : "N/A"}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Search Loading Indicator */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#030436" />
            <Text style={styles.loadingText}>
              Buscando aeronaves disponibles y verificando itinerarios...
            </Text>
          </View>
        )}

        {/* Search Results List */}
        {!isSearching && isSearchFetched && (
          <View style={{ marginBottom: 40 }}>
            {searchResults.length > 0 && (
              <View style={styles.resultsHeaderRow}>
                <TouchableOpacity
                  onPress={() => {
                    // if (router.canGoBack()) {
                    //   router.back();
                    // } else {
                    router.push("/(client)/book");
                    // }
                  }}
                  style={styles.newSearchButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.newSearchText}>Nueva Búsqueda</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 }}>
              <Text style={styles.resultsCountTitle}>
                Aeronaves Disponibles ({searchResults.length})
              </Text>
            </View>

            {searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="airplane-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>
                  No hay aeronaves disponibles
                </Text>
                <Text style={styles.emptySubtitle}>
                  No encontramos aeronaves en el aeropuerto de origen con la capacidad y disponibilidad requerida para estas fechas.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.push("/(client)/book");
                    }
                  }}
                  style={styles.emptyActionButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>Nueva Búsqueda</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultsContainer}>
                {searchResults.map(({ aircraft, flightDurationHours, distanceNm, estimatedPrice, quote }) => {
                  const coverPhoto = aircraft.profile_photo || (aircraft.photos && aircraft.photos.length > 0 ? aircraft.photos[0] : null);
                  return (
                    <View
                      key={aircraft.id}
                      style={styles.card}
                    >
                      {/* Cover Photo Banner */}
                      <View style={styles.bannerContainer}>
                        {coverPhoto ? (
                          <Image
                            source={{ uri: coverPhoto }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.placeholderBanner}>
                            <View style={styles.placeholderIconCircle}>
                              <Ionicons name="airplane" size={32} color="#0165FF" />
                            </View>
                          </View>
                        )}

                        {/* Type Badge Pill */}
                        {aircraft.basic_specs.type && (
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>
                              {aircraft.basic_specs.type}
                            </Text>
                          </View>
                        )}

                        {/* Price Badge on photo */}
                        {estimatedPrice !== null && (
                          <View style={styles.priceBadge}>
                            <Text style={styles.priceBadgeText}>
                              USD ${estimatedPrice.toLocaleString("en-US")}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Card Content Details */}
                      <View style={{ padding: 16 }}>
                        {/* Card Top Header */}
                        <View style={styles.cardHeader}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.aircraftModel}>
                              {aircraft.basic_specs.model}
                            </Text>
                            <Text style={styles.aircraftRegistration}>
                              Matrícula: {aircraft.basic_specs.registration}
                            </Text>
                          </View>
                          {estimatedPrice !== null ? (
                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={styles.priceLabel}>
                                Total Estimado
                              </Text>
                              <Text style={styles.priceValue}>
                                USD ${estimatedPrice.toLocaleString("en-US")}
                              </Text>
                              <Text style={styles.priceBreakdown}>
                                {describeQuote(quote)}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.quoteBadge}>
                              <Text style={styles.quoteBadgeText}>
                                A cotizar
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Specs Summary Grid */}
                        <View style={styles.specsRow}>
                          <View style={{ width: "48%" }}>
                            <Text style={styles.specLabel}>Capacidad</Text>
                            <Text style={styles.specValue}>
                              {aircraft.basic_specs.pax_count} personas
                            </Text>
                          </View>

                          <View style={{ width: "48%" }}>
                            <Text style={styles.specLabel}>Tiempo de Vuelo</Text>
                            <Text style={styles.specDurationValue}>
                              {flightDurationHours < 1
                                ? `${Math.round(flightDurationHours * 60)} minutos`
                                : `${flightDurationHours.toFixed(1)} horas`}
                            </Text>
                          </View>
                        </View>

                        {/* Detail Screen Button */}
                        <TouchableOpacity
                          onPress={() => {
                            router.push({
                              pathname: "/(client)/aircraft-details",
                              params: {
                                aircraftJson: JSON.stringify(aircraft),
                                searchData: params.searchData,
                                flightDurationHours: JSON.stringify(flightDurationHours),
                                distanceNm: JSON.stringify(distanceNm),
                                estimatedPrice: estimatedPrice !== null ? JSON.stringify(estimatedPrice) : undefined,
                                quoteJson: JSON.stringify(quote),
                              },
                            });
                          }}
                          style={styles.actionButton}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.actionButtonText}>Ver Información y Reservar</Text>
                          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  screenTitle: {
    color: "#030436",
    fontWeight: "bold",
    fontSize: 18,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  airportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  airportName: {
    fontWeight: "bold",
    color: "#030436",
    fontSize: 14,
    flex: 1,
  },
  summaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  paxBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paxText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#334155",
  },
  dateText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  loadingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  loadingText: {
    color: "#475569",
    fontWeight: "500",
    marginTop: 12,
    textAlign: "center",
    fontSize: 14,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  newSearchButton: {
    backgroundColor: "#0165FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newSearchText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  resultsCountTitle: {
    color: "#030436",
    fontWeight: "bold",
    fontSize: 18,
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    textAlign: "center",
    color: "#334155",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  emptyActionButton: {
    backgroundColor: "#0165FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  resultsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  bannerContainer: {
    height: 160,
    width: "100%",
    backgroundColor: "#0F172A",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  placeholderBanner: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(3, 4, 54, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  priceBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(3, 4, 54, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(218, 165, 32, 0.4)",
  },
  priceBadgeText: {
    color: "#0165FF",
    fontWeight: "bold",
    fontSize: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  aircraftModel: {
    color: "#030436",
    fontWeight: "bold",
    fontSize: 18,
  },
  aircraftRegistration: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#94A3B8",
  },
  priceBreakdown: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    textAlign: "right",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#030436",
  },
  quoteBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quoteBadgeText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  specsRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  specLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  specValue: {
    fontWeight: "bold",
    color: "#1E293B",
    fontSize: 14,
  },
  specDurationValue: {
    fontWeight: "bold",
    color: "#0165FF",
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: "#030436",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
