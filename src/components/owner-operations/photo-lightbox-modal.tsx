import React from "react";
import {
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface PhotoLightboxModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
    /** Texto al pie. Por defecto, el del comprobante del plan de vuelo. */
    caption?: string;
}

export function PhotoLightboxModal({
    visible,
    imageUri,
    onClose,
    caption,
}: PhotoLightboxModalProps) {
    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={styles.backdrop}
            >
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
                </View>

                <Text style={styles.captionText}>
                    {caption ||
                        "Comprobante de Plan de Vuelo · Tocá en cualquier lugar para cerrar"}
                </Text>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(6, 16, 30, 0.94)",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
    },
    closeButton: {
        position: "absolute",
        top: 48,
        right: 20,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },
    closeButtonText: {
        color: "#FFFFFF",
        fontSize: 26,
        lineHeight: 28,
        fontFamily: "NotoSans_600SemiBold",
    },
    imageContainer: {
        width: "100%",
        height: "78%",
        alignItems: "center",
        justifyContent: "center",
    },
    fullImage: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
    },
    captionText: {
        fontFamily: "NotoSans_400Regular",
        color: "#93A3B6",
        fontSize: 13,
        marginTop: 14,
        textAlign: "center",
    },
});

