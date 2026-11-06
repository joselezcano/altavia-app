/**
 * Foto del plan de vuelo presentado (cámara o galería), como el comprobante de GIO.
 * Se sube a Storage al guardar el plan (ver uploadFlightPlanPhoto).
 */
import { PhotoLightboxModal } from "@/components/owner-operations/photo-lightbox-modal";
import { pickFlightPlanImage } from "@/hooks/useAircraftOperations";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function FlightPlanPhotoPicker({
    photoUri,
    onChange,
}: {
    photoUri: string | null;
    onChange: (uri: string | null) => void;
}) {
    const [isPicking, setIsPicking] = useState(false);
    const [isLightboxVisible, setIsLightboxVisible] = useState(false);

    const handlePick = async (source: "library" | "camera") => {
        try {
            setIsPicking(true);
            const uri = await pickFlightPlanImage(source, { fileUriOnly: true });
            if (uri) onChange(uri);
        } catch (error: any) {
            Alert.alert("Foto del plan de vuelo", error?.message || "No se pudo seleccionar la imagen.");
        } finally {
            setIsPicking(false);
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Ionicons name="camera-outline" size={20} color="#0f1e3d" />
                <Text style={styles.title}>Foto del plan presentado</Text>
            </View>
            <Text style={styles.hint}>
                Opcional. Adjuntá una foto del plan de vuelo presentado ante DINAC para este tramo.
            </Text>

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    onPress={() => handlePick("library")}
                    disabled={isPicking}
                    style={styles.pickerButton}
                    activeOpacity={0.8}
                >
                    <Ionicons name="image-outline" size={18} color="#0f1e3d" />
                    <Text style={styles.pickerButtonText}>{isPicking ? "Cargando…" : "Galería"}</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && (
                    <TouchableOpacity
                        onPress={() => handlePick("camera")}
                        disabled={isPicking}
                        style={styles.pickerButton}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="camera-outline" size={18} color="#0f1e3d" />
                        <Text style={styles.pickerButtonText}>Cámara</Text>
                    </TouchableOpacity>
                )}
            </View>

            {photoUri ? (
                <View style={{ marginTop: 12 }}>
                    <TouchableOpacity onPress={() => setIsLightboxVisible(true)} activeOpacity={0.85}>
                        <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
                    </TouchableOpacity>
                    <View style={styles.footerRow}>
                        <Text style={styles.hint}>Tocá la foto para verla en grande.</Text>
                        <TouchableOpacity onPress={() => onChange(null)}>
                            <Text style={styles.removeText}>Quitar la foto</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            <PhotoLightboxModal
                visible={isLightboxVisible}
                imageUri={photoUri}
                onClose={() => setIsLightboxVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 12,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
    },
    title: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#0f1e3d",
    },
    hint: {
        fontSize: 12,
        color: "#64748B",
        flexShrink: 1,
    },
    actionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 12,
    },
    pickerButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#C5A059",
        backgroundColor: "#FFFFFF",
    },
    pickerButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#0f1e3d",
    },
    thumb: {
        width: "100%",
        height: 200,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
    },
    footerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 8,
    },
    removeText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#B91C1C",
    },
});
