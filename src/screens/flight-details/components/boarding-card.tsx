import { BRAND_COLORS, BRAND_LOGO_ASPECT, BRAND_LOGOS, BRAND_RADII } from "@/constants/brand";
import { brandFont } from "@/utils/brand-fonts";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Cliente: acceso a los boarding pass de una reserva pagada. */
export function ClientBoardingPassCard({ passengerCount, onPress }: { passengerCount: number; onPress: () => void }) {
    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <Image
                    source={BRAND_LOGOS.isotipoNegative}
                    style={{ width: 30, height: 30 / BRAND_LOGO_ASPECT.isotipo }}
                    contentFit="contain"
                />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.eyebrow, brandFont(700)]}>LISTO PARA VOLAR</Text>
                    <Text style={[styles.title, brandFont(700)]}>Tu boarding pass</Text>
                    <Text style={[styles.subtitle, brandFont(400)]}>
                        {passengerCount > 0
                            ? `${passengerCount} ${passengerCount === 1 ? "pasajero" : "pasajeros"} · un QR por persona`
                            : "Cargá el manifiesto para emitir los pases"}
                    </Text>
                </View>
            </View>
            <TouchableOpacity onPress={onPress} style={styles.button} activeOpacity={0.85}>
                <MaterialCommunityIcons name="qrcode" size={18} color={BRAND_COLORS.white} />
                <Text style={[styles.buttonText, brandFont(700)]}>Ver boarding pass</Text>
                <Ionicons name="arrow-forward" size={16} color={BRAND_COLORS.white} />
            </TouchableOpacity>
        </View>
    );
}

/** Piloto asignado / owner / encargada: escáner de embarque. */
export function BoardingScannerCard({
    boarded,
    total,
    onPress,
}: {
    boarded: number;
    total: number;
    onPress: () => void;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <View style={styles.iconWrap}>
                    <MaterialCommunityIcons name="qrcode-scan" size={20} color={BRAND_COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.eyebrow, brandFont(700)]}>EMBARQUE</Text>
                    <Text style={[styles.title, brandFont(700)]}>
                        {boarded}/{total} embarcados
                    </Text>
                    <Text style={[styles.subtitle, brandFont(400)]}>Escaneá el QR del boarding pass de cada pasajero.</Text>
                </View>
            </View>
            <TouchableOpacity onPress={onPress} style={styles.button} activeOpacity={0.85}>
                <Ionicons name="scan-outline" size={18} color={BRAND_COLORS.white} />
                <Text style={[styles.buttonText, brandFont(700)]}>Escanear pasajeros</Text>
                <Ionicons name="arrow-forward" size={16} color={BRAND_COLORS.white} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: BRAND_COLORS.navy,
        borderRadius: BRAND_RADII.card,
        padding: 16,
        gap: 14,
        shadowColor: BRAND_COLORS.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BRAND_COLORS.azur,
        alignItems: "center",
        justifyContent: "center",
    },
    eyebrow: {
        color: BRAND_COLORS.crystal,
        fontSize: 10,
        letterSpacing: 1.5,
    },
    title: {
        color: BRAND_COLORS.white,
        fontSize: 17,
    },
    subtitle: {
        color: BRAND_COLORS.crystal,
        fontSize: 12,
        marginTop: 1,
    },
    button: {
        height: 48,
        borderRadius: BRAND_RADII.button,
        backgroundColor: BRAND_COLORS.azur,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    buttonText: {
        color: BRAND_COLORS.white,
        fontSize: 15,
    },
});
