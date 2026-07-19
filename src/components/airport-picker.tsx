import { db } from "@/config/firebase";
import { Airport } from '@/types/all-roles';
import { buildSearchTags, getSearchableFields, getSearchKeywords } from "@/utils/search-airport";
import {
    collection,
    DocumentData,
    getDocs,
    limit,
    query,
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
import { SafeAreaView } from 'react-native-safe-area-context';


// Define props to match what React Hook Form provides
interface AirportPickerProps {
    value: Airport | undefined;
    onChange: (airport: Airport | null) => void;
    error?: string;
    allowedTypes?: string[];
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


export default function AirportPicker({ value, onChange, error, allowedTypes }: AirportPickerProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [airports, setAirports] = useState<Airport[]>([]);
    const [searchResult, setSearchResult] = useState(formatSearchResult(value));
    const [airportTimezone, setAirportTimezone] = useState(value?.timezone?.replaceAll("_", " "));
    const [secondaryAirportInfo, setSecondaryAirportInfo] = useState(value?.municipality ? value?.name : "");

    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData, DocumentData> | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const LIMIT = 20;

    const fetchInitialAirports = useCallback(async (queryStr: string) => {
        const formattedQuery = queryStr.trim().toLowerCase();
        if (formattedQuery.length < 2) {
            setAirports([]);
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
            const q = query(
                collection(db, 'airports'),
                where('search_tags', 'array-contains-any', searchKeywords),
                limit(LIMIT)
            );
            const snapshot = await getDocs(q);

            const items: Airport[] = snapshot.docs.map(doc => {
                const data = doc.data() as Airport;
                // Re-order here based on multi-term matching score
                const searchableFields = getSearchableFields(data);
                const search_tags = buildSearchTags(searchableFields);
                // Count the number of elements in searchKeywords that are present in search_tags
                let matchingScore = 0;
                searchKeywords.forEach(keyword => {
                    if (search_tags.includes(keyword)) {
                        matchingScore++;
                    }
                });
                data.matchingScore = matchingScore;
                return data;
            });

            let filteredItems = items;
            if (allowedTypes && allowedTypes.length > 0) {
                filteredItems = items.filter(airport => allowedTypes.includes(airport.type));
            }

            // Order by airport type first, then by matchingScore in descending order
            const largeAirports = filteredItems.filter(airport => airport.type === 'large_airport');
            const mediumAirports = filteredItems.filter(airport => airport.type === 'medium_airport');
            const smallAirports = filteredItems.filter(airport => airport.type === 'small_airport');
            const heliports = filteredItems.filter(airport => airport.type === 'heliport');
            const closedAirports = filteredItems.filter(airport => airport.type === 'closed');
            largeAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            mediumAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            smallAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            heliports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            closedAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

            const orderedItems = [...largeAirports, ...mediumAirports, ...smallAirports, ...heliports, ...closedAirports];
            setAirports(orderedItems);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
            if (snapshot.docs.length < LIMIT) setHasMore(false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [allowedTypes]);

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
            const q = query(
                collection(db, 'airports'),
                where('search_tags', 'array-contains-any', searchKeywords),
                startAfter(lastVisible),
                limit(LIMIT)
            );
            const snapshot = await getDocs(q);

            if (snapshot.docs.length === 0) {
                setHasMore(false);
                return;
            }

            const newItems: Airport[] = snapshot.docs.map(doc => {
                const data = doc.data() as Airport;
                // Re-order here based on multi-term matching score
                const searchableFields = getSearchableFields(data);
                const search_tags = buildSearchTags(searchableFields);
                // Count the number of elements in searchKeywords that are present in search_tags
                let matchingScore = 0;
                searchKeywords.forEach(keyword => {
                    if (search_tags.includes(keyword)) {
                        matchingScore++;
                    }
                });
                data.matchingScore = matchingScore;
                return data;
            });

            let filteredNewItems = newItems;
            if (allowedTypes && allowedTypes.length > 0) {
                filteredNewItems = newItems.filter(airport => allowedTypes.includes(airport.type));
            }

            // // Order by matchingScore in descending order
            // filteredNewItems.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

            const aggregatedItems = [...airports, ...filteredNewItems];

            // Order by airport type first, then by matchingScore in descending order
            const largeAirports = aggregatedItems.filter(airport => airport.type === 'large_airport');
            const mediumAirports = aggregatedItems.filter(airport => airport.type === 'medium_airport');
            const smallAirports = aggregatedItems.filter(airport => airport.type === 'small_airport');
            const heliports = aggregatedItems.filter(airport => airport.type === 'heliport');
            const closedAirports = aggregatedItems.filter(airport => airport.type === 'closed');
            largeAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            mediumAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            smallAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            heliports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
            closedAirports.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

            const orderedItems = [...largeAirports, ...mediumAirports, ...smallAirports, ...heliports, ...closedAirports];

            setAirports(orderedItems);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            if (snapshot.docs.length < LIMIT) setHasMore(false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };

    const renderItem = useCallback(({ item }: { item: Airport }) => (
        <TouchableOpacity
            style={styles.itemRow}
            onPress={() => {
                onChange(item); // Pass data up to React Hook Form
                setModalVisible(false);
                setSearchResult(formatSearchResult(item));
                setAirportTimezone(item.timezone?.replaceAll("_", " "));
                setSecondaryAirportInfo(item.municipality ? item.name : "");
            }}
        >
            <Text style={styles.itemCode}>{item.iata_code}</Text>
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCity}>{item.municipality}</Text>
            </View>
        </TouchableOpacity>
    ), [onChange]);

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
                <SafeAreaView style={styles.modalContainer}>
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
    itemRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
    itemCode: { fontWeight: 'bold', fontSize: 16, width: 60, color: '#007AFF' },
    itemTextContainer: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '500', color: '#222' },
    itemCity: { fontSize: 13, color: '#666', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
});
