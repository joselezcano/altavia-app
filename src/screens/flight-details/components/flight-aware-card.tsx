/**
 * ID de vuelo de FlightAware (fa_flight_id) de una reserva confirmada.
 * Lo cargan o editan el owner, la encargada o el piloto asignado; el tracking lo usa para
 * consultar la posición y el mapa del vuelo.
 * Dentro del <Modal> solo se usan Text/View nativos con StyleSheet (regla NativeWind v4).
 */
import { useUpdateFaFlightId } from "@/hooks/useReservationEditing";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const FA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]*$/;

export function FlightAwareCard({
    reservationId,
    faFlightId,
}: {
    reservationId: string;
    faFlightId: string | null;
}) {
    const updateFaFlightId = useUpdateFaFlightId();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [draft, setDraft] = useState("");

    const openModal = () => {
        setDraft(faFlightId ?? "");
        setIsModalVisible(true);
    };

    const handleSave = async () => {
        const value = draft.trim();
        if (value !== "" && !FA_ID_PATTERN.test(value)) {
            Alert.alert(
                "ID inválido",
                "El ID de FlightAware no lleva espacios. Ejemplo: ZPBOC-1762430000-adhoc-0123."
            );
            return;
        }
        try {
            await updateFaFlightId.mutateAsync({ reservationId, faFlightId: value });
            setIsModalVisible(false);
        } catch (error: any) {
            Alert.alert("Error", error?.message || "No se pudo guardar el ID de FlightAware.");
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                    <Ionicons name="radio-outline" size={16} color="#030436" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>Seguimiento en vivo</Text>
                    <Text style={styles.title}>ID de vuelo FlightAware</Text>
                </View>
            </View>

            <Text style={faFlightId ? styles.idValue : styles.idEmpty} numberOfLines={1}>
                {faFlightId || "Todavía no se cargó el ID: el tracking no muestra datos."}
            </Text>

            <TouchableOpacity onPress={openModal} style={styles.actionButton} activeOpacity={0.8}>
                <Ionicons name={faFlightId ? "create-outline" : "add-circle-outline"} size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>{faFlightId ? "Editar ID" : "Cargar ID"}</Text>
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ID de vuelo FlightAware</Text>
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                style={styles.modalClose}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalHelp}>
                            Buscá el vuelo en flightaware.com y copiá el ID que aparece en la dirección después de
                            "/live/flight/id/". Ejemplo: ZPBOC-1762430000-adhoc-0123. Dejalo vacío para quitarlo.
                        </Text>
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="ZPBOC-1762430000-adhoc-0123"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                style={styles.cancelButton}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={updateFaFlightId.isPending}
                                style={styles.saveButton}
                            >
                                {updateFaFlightId.isPending ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Guardar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: "bold",
        color: "#0165FF",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1E293B",
    },
    idValue: {
        fontSize: 13,
        fontWeight: "600",
        color: "#030436",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
    },
    idEmpty: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 10,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "#030436",
        borderRadius: 12,
        paddingVertical: 10,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 32,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#030436",
    },
    modalClose: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: "#F1F5F9",
    },
    modalHelp: {
        fontSize: 12,
        color: "#64748B",
        lineHeight: 17,
        marginBottom: 12,
    },
    input: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: "#030436",
    },
    modalActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#64748B",
    },
    saveButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#030436",
        alignItems: "center",
    },
    saveButtonText: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
});
