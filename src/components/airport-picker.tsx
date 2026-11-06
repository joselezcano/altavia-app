import { db } from "@/config/firebase";
import { Airport } from '@/types/all-roles';
import { buildSearchTags, getSearchableFields, getSearchKeywords } from "@/utils/search-airport";
import {
    collection,
    DocumentData,
    getDocs,
    limit,
    query,
    Query,
    QueryDocumentSnapshot,
    startAfter,
    where
} from "firebase/firestore";
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet, Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from "./themed-text";


// Define props to match what React Hook Form provides
interface AirportPickerProps {
    value: Airport | undefined;
    onChange: (airport: Airport | null) => void;
    error?: string;
    allowedTypes?: string[];
    title?: string;
}

// Build search result string for display in input
const formatSearchResult = (airport: Airport | undefined): string => {
    if (!airport) return '';
    let matchedAirportCode = '';
    if (airport.iata_code) {
        matchedAirportCode = `(${airport.iata_code})`;
    } else if (airport.icao_code) {
        matchedAirportCode = `(${airport.icao_code})`;
    } else if (airport.gps_code) {
        matchedAirportCode = `(${airport.gps_code})`;
    }

    let searchResult = '';
    if (airport.municipality) {
        searchResult += airport.municipality;
        searchResult += ', ' + airport.country;
        searchResult += ' ' + matchedAirportCode;
    } else {
        searchResult += airport.name;
        searchResult += ', ' + airport.country;
        searchResult += ' ' + matchedAirportCode;
    }
    return searchResult;
};

// Helper to sort airports: Paraguay first, then by type and matchingScore
const isParaguayAirport = (a: Airport): boolean => {
    return (
        a.country?.trim().toLowerCase() === 'paraguay' ||
        a.region?.trim().toLowerCase().includes('paraguay') ||
        a.ident?.toUpperCase().startsWith('SG')
    );
};

const orderAirports = (items: Airport[]): Airport[] => {
    const pyAirports = items.filter(isParaguayAirport);
    const otherAirports = items.filter(a => !isParaguayAirport(a));

    const sortGroup = (list: Airport[]) => {
        const largeAirports = list.filter(airport => airport.type === 'large_airport');
        const mediumAirports = list.filter(airport => airport.type === 'medium_airport');
        const smallAirports = list.filter(airport => airport.type === 'small_airport');
        const heliports = list.filter(airport => airport.type === 'heliport');
        const closedAirports = list.filter(airport => airport.type === 'closed');

        const sortByScore = (a: Airport, b: Airport) => (b.matchingScore || 0) - (a.matchingScore || 0);

        largeAirports.sort(sortByScore);
        mediumAirports.sort(sortByScore);
        smallAirports.sort(sortByScore);
        heliports.sort(sortByScore);
        closedAirports.sort(sortByScore);

        return [...largeAirports, ...mediumAirports, ...smallAirports, ...heliports, ...closedAirports];
    };

    return [...sortGroup(pyAirports), ...sortGroup(otherAirports)];
};

// In-memory cache for all Paraguayan airports (~122 in Firestore)
let cachedParaguayAirports: Airport[] | null = null;
let pyFetchPromise: Promise<Airport[]> | null = null;

async function getParaguayAirports(): Promise<Airport[]> {
    if (cachedParaguayAirports) return cachedParaguayAirports;
    if (pyFetchPromise) return pyFetchPromise;

    pyFetchPromise = (async () => {
        try {
            const q = query(
                collection(db, 'airports'),
                where('country', '==', 'Paraguay')
            );
            const snapshot = await getDocs(q);
            const list: Airport[] = snapshot.docs.map(doc => doc.data() as Airport);
            cachedParaguayAirports = list;
            return list;
        } catch (err) {
            console.error('Error prefetching Paraguay airports:', err);
            return [];
        } finally {
            pyFetchPromise = null;
        }
    })();

    return pyFetchPromise;
}

function scoreAndFilterParaguayAirports(
    paraguayAirports: Airport[],
    queryStr: string,
    searchKeywords: string[],
    effectiveAllowedTypes: string[]
): Airport[] {
    const cleanQuery = queryStr.toLowerCase().trim();
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);

    const matches: Airport[] = [];

    for (const airport of paraguayAirports) {
        if (!effectiveAllowedTypes.includes(airport.type)) continue;

        let score = 0;
        const name = (airport.name || '').toLowerCase();
        const municipality = (airport.municipality || '').toLowerCase();
        const iata = (airport.iata_code || '').toLowerCase();
        const icao = (airport.icao_code || '').toLowerCase();
        const gps = (airport.gps_code || '').toLowerCase();
        const ident = (airport.ident || '').toLowerCase();

        // Exact airport code match
        if (iata && cleanQuery === iata) score += 400;
        if (icao && cleanQuery === icao) score += 400;

        // Code contains query or query contains code
        if (iata && (cleanQuery.includes(iata) || iata.includes(cleanQuery))) score += 200;
        if (icao && (cleanQuery.includes(icao) || icao.includes(cleanQuery))) score += 200;
        if (gps && (cleanQuery.includes(gps) || gps.includes(cleanQuery))) score += 150;
        if (ident && (cleanQuery.includes(ident) || ident.includes(cleanQuery))) score += 150;

        // Substring match in municipality or name
        if (municipality.includes(cleanQuery)) score += 300;
        if (name.includes(cleanQuery)) score += 250;

        // Words match: all query words present in airport data
        const allWordsPresent = queryWords.length > 0 && queryWords.every(word =>
            municipality.includes(word) ||
            name.includes(word) ||
            iata.includes(word) ||
            icao.includes(word) ||
            (airport.search_tags && airport.search_tags.some(tag => tag.includes(word)))
        );
        if (allWordsPresent) score += 200;

        // Keyword matches
        const searchableFields = getSearchableFields(airport);
        const tags = buildSearchTags(searchableFields);
        searchKeywords.forEach(keyword => {
            if (tags.includes(keyword)) score += 10;
            if (municipality.includes(keyword)) score += 20;
            if (name.includes(keyword)) score += 15;
        });

        if (score > 0) {
            matches.push({
                ...airport,
                matchingScore: score + 1000, // Guarantee Paraguayan airports rank at the absolute top
            });
        }
    }

    return matches;
}

const DEFAULT_ALLOWED_TYPES = ['large_airport', 'medium_airport', 'small_airport'];

export default function AirportPicker({ value, onChange, error, allowedTypes, title }: AirportPickerProps) {
    const effectiveAllowedTypes = allowedTypes && allowedTypes.length > 0 ? allowedTypes : DEFAULT_ALLOWED_TYPES;
    const insets = useSafeAreaInsets();
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [airports, setAirports] = useState<Airport[]>([]);
    const [searchResult, setSearchResult] = useState(formatSearchResult(value));
    const [airportTimezone, setAirportTimezone] = useState(value?.timezone?.replaceAll("_", " "));
    const [secondaryAirportInfo, setSecondaryAirportInfo] = useState(value?.municipality ? value?.name : "");

    // Preload Paraguayan airports on mount
    useEffect(() => {
        getParaguayAirports().catch(() => {});
    }, []);

    useEffect(() => {
        setSearchResult(formatSearchResult(value));
        setAirportTimezone(value?.timezone?.replaceAll("_", " "));
        setSecondaryAirportInfo(value?.municipality ? value?.name : "");
    }, [value]);

    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData, DocumentData> | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 20;

    const fetchInitialAirports = useCallback(async (queryStr: string) => {
        const formattedQuery = queryStr.trim().toLowerCase();
        if (formattedQuery.length < 2) {
            // When query is empty or 1 char, show primary Paraguayan airports by default
            try {
                const pyList = await getParaguayAirports();
                const defaultPy = pyList.filter(a => effectiveAllowedTypes.includes(a.type));
                setAirports(orderAirports(defaultPy));
            } catch {
                setAirports([]);
            }
            setLastVisible(null);
            setHasMore(false);
            return;
        }

        const searchKeywords = getSearchKeywords(formattedQuery);
        if (searchKeywords.length === 0) {
            setAirports([]);
            setLastVisible(null);
            setHasMore(false);
            return;
        }

        setLoading(true);
        setHasMore(true);

        try {
            // 1. Instant in-memory search across Paraguayan airports
            const pyList = await getParaguayAirports();
            const pyMatches = scoreAndFilterParaguayAirports(
                pyList,
                formattedQuery,
                searchKeywords,
                effectiveAllowedTypes
            );

            const pyIdents = new Set(pyMatches.map(a => a.ident));

            // 2. Fetch international airports from Firestore
            let tempLastVisible: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null;
            let tempHasMore = true;
            let accumulatedFiltered: Airport[] = [];

            while (accumulatedFiltered.length < LIMIT && tempHasMore) {
                const q: Query<DocumentData, DocumentData> = tempLastVisible
                    ? query(
                        collection(db, 'airports'),
                        where('search_tags', 'array-contains-any', searchKeywords),
                        startAfter(tempLastVisible),
                        limit(LIMIT)
                    )
                    : query(
                        collection(db, 'airports'),
                        where('search_tags', 'array-contains-any', searchKeywords),
                        limit(LIMIT)
                    );

                const snapshot = await getDocs(q);
                if (snapshot.docs.length === 0) {
                    tempHasMore = false;
                    break;
                }

                const items: Airport[] = snapshot.docs.map(doc => {
                    const data = doc.data() as Airport;
                    const searchableFields = getSearchableFields(data);
                    const search_tags = buildSearchTags(searchableFields);
                    let matchingScore = 0;
                    searchKeywords.forEach(keyword => {
                        if (search_tags.includes(keyword)) {
                            matchingScore++;
                        }
                        if (data.municipality && data.municipality.toLowerCase().includes(keyword)) {
                            matchingScore += 3;
                        }
                    });
                    data.matchingScore = matchingScore;
                    return data;
                });

                // Filter allowed types and exclude airports already included from Paraguay in-memory search
                const filteredItems = items.filter(
                    airport => effectiveAllowedTypes.includes(airport.type) && !pyIdents.has(airport.ident)
                );

                accumulatedFiltered = [...accumulatedFiltered, ...filteredItems];
                tempLastVisible = snapshot.docs[snapshot.docs.length - 1];

                if (snapshot.docs.length < LIMIT) {
                    tempHasMore = false;
                }
            }

            // Combine Paraguayan matches (ranked highest) + foreign airports
            const combinedResults = [...pyMatches, ...accumulatedFiltered];
            const orderedItems = orderAirports(combinedResults);

            setAirports(orderedItems);
            setLastVisible(tempLastVisible);
            setHasMore(tempHasMore);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [effectiveAllowedTypes]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchInitialAirports(searchQuery);
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, fetchInitialAirports]);

    const fetchMoreAirports = async () => {
        if (loadingMore || !hasMore || !lastVisible) return;
        setLoadingMore(true);
        const formattedQuery = searchQuery.trim().toLowerCase();
        const searchKeywords = getSearchKeywords(formattedQuery);

        try {
            let tempLastVisible = lastVisible;
            let tempHasMore = true;
            let accumulatedFiltered: Airport[] = [];

            while (accumulatedFiltered.length < LIMIT && tempHasMore) {
                const q: Query<DocumentData, DocumentData> = query(
                    collection(db, 'airports'),
                    where('search_tags', 'array-contains-any', searchKeywords),
                    startAfter(tempLastVisible),
                    limit(LIMIT)
                );
                const snapshot = await getDocs(q);

                if (snapshot.docs.length === 0) {
                    tempHasMore = false;
                    break;
                }

                const newItems: Airport[] = snapshot.docs.map(doc => {
                    const data = doc.data() as Airport;
                    const searchableFields = getSearchableFields(data);
                    const search_tags = buildSearchTags(searchableFields);
                    let matchingScore = 0;
                    searchKeywords.forEach(keyword => {
                        if (search_tags.includes(keyword)) {
                            matchingScore++;
                        }
                        if (data.municipality && data.municipality.toLowerCase().includes(keyword)) {
                            matchingScore += 3;
                        }
                    });
                    data.matchingScore = matchingScore;
                    return data;
                });

                const existingIdents = new Set(airports.map(a => a.ident));
                const filteredNewItems = newItems.filter(
                    airport => effectiveAllowedTypes.includes(airport.type) && !existingIdents.has(airport.ident)
                );

                accumulatedFiltered = [...accumulatedFiltered, ...filteredNewItems];
                tempLastVisible = snapshot.docs[snapshot.docs.length - 1];

                if (snapshot.docs.length < LIMIT) {
                    tempHasMore = false;
                }
            }

            if (accumulatedFiltered.length > 0) {
                const aggregatedItems = [...airports, ...accumulatedFiltered];
                const orderedItems = orderAirports(aggregatedItems);
                setAirports(orderedItems);
            }
            setLastVisible(tempLastVisible);
            setHasMore(tempHasMore);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };

    const renderItem = useCallback(({ item }: { item: Airport }) => {
        const displayCode = item.iata_code || item.icao_code || item.gps_code || item.ident;
        return (
            <TouchableOpacity
                style={styles.itemRow}
                onPress={() => {
                    onChange(item);
                    setModalVisible(false);
                    setSearchResult(formatSearchResult(item));
                    setAirportTimezone(item.timezone?.replaceAll("_", " "));
                    setSecondaryAirportInfo(item.municipality ? item.name : "");
                }}
            >
                <View style={styles.codeBadge}>
                    <Text style={styles.itemCode}>{displayCode}</Text>
                </View>
                <View style={styles.itemTextContainer}>
                    <Text style={styles.itemCity}>
                        {item.municipality ? `${item.municipality}, ${item.country}` : item.country}
                    </Text>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                </View>
            </TouchableOpacity>
        );
    }, [onChange]);

    return (
        <View style={styles.container}>
            {/* Dynamic styling for errors */}
            <TouchableOpacity
                // className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-brand-text font-medium"
                style={[styles.pickerButton, error ? styles.errorBorder : null]}
                onPress={() => setModalVisible(true)}
            >
                <Text
                    style={styles.pickerButtonText}
                >
                    {searchResult || "Seleccione un aeropuerto..."}
                </Text>
            </TouchableOpacity>

            {secondaryAirportInfo && <Text style={styles.secondaryAirportText}>{secondaryAirportInfo}</Text>}
            {airportTimezone && <Text style={styles.airportTimezoneText}>{airportTimezone}</Text>}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={modalVisible} animationType="slide" transparent={false}>
                <Text style={{ paddingTop: insets.top + 8, fontWeight: '700', marginLeft: 16, fontSize: 13, color: '#0F172A' }}>
                    {title || "Seleccione un Aeropuerto"}
                </Text>
                <SafeAreaView style={[styles.modalContainer]}>

                    <View style={styles.header}>

                        <TextInput
                            autoComplete="off"
                            autoCorrect={false}
                            spellCheck={false}
                            importantForAutofill="no"
                            textContentType="none"
                            style={styles.searchInput}
                            placeholder="Aeropuerto, ciudad o código..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            // autoFocus
                            clearButtonMode="while-editing"
                        />
                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                            <Text style={styles.closeButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={airports}
                            keyExtractor={(item) => item.ident}
                            renderItem={renderItem}
                            onEndReached={fetchMoreAirports}
                            onEndReachedThreshold={0.3}
                            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" style={{ marginVertical: 15 }} /> : null}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    {searchQuery.trim().length >= 2 ? "No se encontraron aeropuertos." : "Escribe al menos 3 letras."}
                                </Text>
                            }
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginVertical: 8 },
    pickerButton: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, backgroundColor: '#fff' },
    errorBorder: { borderColor: '#FF3B30' },
    errorText: { color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 4 },
    pickerButtonText: { fontSize: 16, color: '#333' },
    secondaryAirportText: { fontSize: 12, color: '#666', marginTop: 12 },
    airportTimezoneText: { fontSize: 12, color: '#999', marginTop: 6 },
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
    searchInput: { flex: 1, height: 40, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#f9f9f9' },
    closeButton: { marginLeft: 12, padding: 8 },
    closeButtonText: { color: '#007AFF', fontSize: 16 },
    itemRow: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
    codeBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minWidth: 62, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    itemCode: { fontWeight: 'bold', fontSize: 13, color: '#007AFF' },
    itemTextContainer: { flex: 1 },
    itemCity: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    itemName: { fontSize: 13, color: '#64748B', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
});
