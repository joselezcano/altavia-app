import { PhotoLightboxModal } from "@/components/owner-operations/photo-lightbox-modal";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Foto del plan de vuelo presentado (si se adjuntó al crear o editar el plan). */
export const FlightPlanPhotoCard = ({ photoUrl }: { photoUrl?: string | null }) => {
    const [isLightboxVisible, setIsLightboxVisible] = useState(false);

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Ionicons name="camera-outline" size={20} color="#0f1e3d" />
                <Text style={styles.title}>Foto del Plan Presentado</Text>
            </View>
            {photoUrl ? (
                <>
                    <TouchableOpacity onPress={() => setIsLightboxVisible(true)} activeOpacity={0.85}>
                        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                    </TouchableOpacity>
                    <Text style={styles.hint}>Tocá la foto para verla en grande.</Text>
                    <PhotoLightboxModal
                        visible={isLightboxVisible}
                        imageUri={photoUrl}
                        onClose={() => setIsLightboxVisible(false)}
                    />
                </>
            ) : (
                <Text style={styles.hint}>No se adjuntó la foto del plan presentado.</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 20,
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
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0f1e3d",
    },
    photo: {
        width: "100%",
        height: 220,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
    },
    hint: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 8,
    },
});
