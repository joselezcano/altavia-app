import { CustomDatePicker } from "@/components/custom-date-picker";
import { ScreenHeader } from "@/components/screen-header";
import { BRAND_COLORS, BRAND_RADII, BRAND_TYPE } from "@/constants/brand";
import { useAuth } from "@/hooks/useAuth";
import { usePilotOwnProfile, useSavePilotOwnProfile } from "@/hooks/usePilotOwnProfile";
import {
    PILOT_ID_TYPES,
    PILOT_LANGUAGES,
    PILOT_LICENCE_TYPES,
    PILOT_MEDICAL_CLASSES,
    PilotProfileForm,
    PilotProfileFormSchema,
} from "@/types/pilot";
import { brandFont } from "@/utils/brand-fonts";
import { showNotice } from "@/utils/dialogs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ReactNode, useMemo } from "react";
import { Controller, FieldError, useForm } from "react-hook-form";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

/**
 * "Mi perfil de piloto": el propio piloto carga su documento, su licencia (DINAC R61)
 * y otros datos. Se abre desde la hoja de cuenta (avatar).
 */
export default function PilotOwnProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, userData } = useAuth();
    const { data: profile, isLoading } = usePilotOwnProfile(user?.uid);
    const save = useSavePilotOwnProfile(user?.uid);

    // Valores iniciales: lo guardado o, si falta, lo que ya sabemos del usuario.
    const values = useMemo<PilotProfileForm>(
        () => ({
            basic: {
                id_first_name: profile?.basic?.id_first_name ?? userData?.firstName ?? "",
                id_last_name: profile?.basic?.id_last_name ?? userData?.lastName ?? "",
                id_type: profile?.basic?.id_type ?? "Documento de Identidad",
                id_number: profile?.basic?.id_number ?? "",
                id_country: profile?.basic?.id_country ?? "Paraguay",
                id_nationality: profile?.basic?.id_nationality ?? "Paraguaya",
                id_date_of_birth: profile?.basic?.id_date_of_birth as Date,
                telephone: profile?.basic?.telephone ?? (userData as any)?.phone ?? "",
            },
            aeronautical: {
                pilot_licence: profile?.aeronautical?.pilot_licence ?? "",
                licence_type: profile?.aeronautical?.licence_type as PilotProfileForm["aeronautical"]["licence_type"],
                licence_permits: profile?.aeronautical?.licence_permits ?? "",
                licence_issuer: profile?.aeronautical?.licence_issuer ?? "DINAC",
            },
            other_information: {
                aeronautical_medical_certificate: profile?.other_information
                    ?.aeronautical_medical_certificate as PilotProfileForm["other_information"]["aeronautical_medical_certificate"],
                languages: profile?.other_information?.languages ?? ["es"],
                flight_hours: profile?.other_information?.flight_hours as number,
            },
        }),
        [profile, userData]
    );

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<PilotProfileForm>({
        resolver: zodResolver(PilotProfileFormSchema),
        values,
        mode: "onSubmit",
    });

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/(pilot)/flights");
    };

    const onSubmit = async (data: PilotProfileForm) => {
        try {
            await save.mutateAsync(data);
            Toast.show({ type: "success", text1: "Perfil de piloto guardado" });
            goBack();
        } catch (e: any) {
            showNotice("No se pudo guardar", e?.message || "Intentá de nuevo.");
        }
    };

    const onInvalid = () => showNotice("Faltan datos", "Revisá los campos marcados en rojo.");

    if (isLoading) {
        return (
            <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator color={BRAND_COLORS.navy} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
            <View style={{ paddingHorizontal: 16 }}>
                <ScreenHeader title="Mi perfil de piloto" subtitle="Documento, licencia y experiencia" onBack={goBack} />
            </View>
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.intro, brandFont(400)]}>
                    Estos datos se usan para asignarte vuelos y para el manifiesto ante la DINAC. Cargalos tal como figuran en tus documentos.
                </Text>

                {/* DOCUMENTO */}
                <Section title="Documento de identidad">
                    <Field label="Nombres" error={errors.basic?.id_first_name}>
                        <Controller control={control} name="basic.id_first_name" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
                        )} />
                    </Field>
                    <Field label="Apellidos" error={errors.basic?.id_last_name}>
                        <Controller control={control} name="basic.id_last_name" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
                        )} />
                    </Field>
                    <Field label="Tipo de documento" error={errors.basic?.id_type}>
                        <Controller control={control} name="basic.id_type" render={({ field }) => (
                            <Chips options={PILOT_ID_TYPES.map((v) => ({ id: v, label: v }))} selected={[field.value]} onToggle={field.onChange} />
                        )} />
                    </Field>
                    <Field label="Número de documento" error={errors.basic?.id_number}>
                        <Controller control={control} name="basic.id_number" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} autoCapitalize="characters" />
                        )} />
                    </Field>
                    <View style={styles.row2}>
                        <View style={{ flex: 1 }}>
                            <Field label="País de expedición" error={errors.basic?.id_country}>
                                <Controller control={control} name="basic.id_country" render={({ field }) => (
                                    <Input value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Nacionalidad" error={errors.basic?.id_nationality}>
                                <Controller control={control} name="basic.id_nationality" render={({ field }) => (
                                    <Input value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
                                )} />
                            </Field>
                        </View>
                    </View>
                    <Field label="Fecha de nacimiento" error={errors.basic?.id_date_of_birth as FieldError | undefined}>
                        <Controller control={control} name="basic.id_date_of_birth" render={({ field }) => (
                            <CustomDatePicker value={field.value ?? null} onChange={field.onChange} placeholder="Elegir fecha" />
                        )} />
                    </Field>
                    <Field label="Teléfono" error={errors.basic?.telephone}>
                        <Controller control={control} name="basic.telephone" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" placeholder="0981 123 456" />
                        )} />
                    </Field>
                </Section>

                {/* LICENCIA */}
                <Section title="Licencia (DINAC R61)">
                    <Field label="Número de licencia" error={errors.aeronautical?.pilot_licence}>
                        <Controller control={control} name="aeronautical.pilot_licence" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} autoCapitalize="characters" />
                        )} />
                    </Field>
                    <Field label="Tipo de licencia" error={errors.aeronautical?.licence_type}>
                        <Controller control={control} name="aeronautical.licence_type" render={({ field }) => (
                            <Chips
                                options={PILOT_LICENCE_TYPES.map((v) => ({ id: v, label: v }))}
                                selected={field.value ? [field.value] : []}
                                onToggle={field.onChange}
                            />
                        )} />
                    </Field>
                    <Field label="Habilitaciones" error={errors.aeronautical?.licence_permits}>
                        <Controller control={control} name="aeronautical.licence_permits" render={({ field }) => (
                            <Input
                                value={field.value}
                                onChangeText={field.onChange}
                                multiline
                                placeholder="Ej.: Avión multimotor terrestre, vuelo por instrumentos"
                            />
                        )} />
                    </Field>
                    <Field label="Emisor de la licencia" error={errors.aeronautical?.licence_issuer}>
                        <Controller control={control} name="aeronautical.licence_issuer" render={({ field }) => (
                            <Input value={field.value} onChangeText={field.onChange} autoCapitalize="characters" />
                        )} />
                    </Field>
                </Section>

                {/* OTROS */}
                <Section title="Experiencia y certificado médico">
                    <Field label="Certificado médico aeronáutico" error={errors.other_information?.aeronautical_medical_certificate}>
                        <Controller control={control} name="other_information.aeronautical_medical_certificate" render={({ field }) => (
                            <Chips
                                options={PILOT_MEDICAL_CLASSES.map((v) => ({ id: v, label: v }))}
                                selected={field.value ? [field.value] : []}
                                onToggle={field.onChange}
                            />
                        )} />
                    </Field>
                    <Field label="Idiomas" error={errors.other_information?.languages as FieldError | undefined}>
                        <Controller control={control} name="other_information.languages" render={({ field }) => (
                            <Chips
                                options={PILOT_LANGUAGES.map((l) => ({ id: l.id, label: l.label }))}
                                selected={field.value ?? []}
                                onToggle={(id) => {
                                    const current = field.value ?? [];
                                    field.onChange(
                                        current.includes(id as any) ? current.filter((x) => x !== id) : [...current, id]
                                    );
                                }}
                            />
                        )} />
                    </Field>
                    <Field label="Horas de vuelo totales" error={errors.other_information?.flight_hours}>
                        <Controller control={control} name="other_information.flight_hours" render={({ field }) => (
                            <Input
                                value={field.value === undefined || field.value === null || isNaN(field.value) ? "" : String(field.value)}
                                onChangeText={(t) => {
                                    const digits = t.replace(/\D/g, "");
                                    field.onChange(digits === "" ? undefined : parseInt(digits, 10));
                                }}
                                keyboardType="number-pad"
                                placeholder="Ej.: 1200"
                            />
                        )} />
                    </Field>
                </Section>

                <TouchableOpacity
                    onPress={handleSubmit(onSubmit, onInvalid)}
                    disabled={save.isPending}
                    style={[styles.saveButton, save.isPending ? { opacity: 0.7 } : null]}
                    activeOpacity={0.85}
                >
                    {save.isPending ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={[styles.saveText, brandFont(700)]}>Guardar perfil</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={{ marginBottom: 18 }}>
            <Text style={[styles.sectionTitle, brandFont(700)]}>{title}</Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
}

function Field({ label, error, children }: { label: string; error?: FieldError; children: ReactNode }) {
    return (
        <View style={{ gap: 6 }}>
            <Text style={[styles.label, brandFont(600)]}>{label}</Text>
            {children}
            {!!error?.message && <Text style={[styles.error, brandFont(500)]}>{error.message}</Text>}
        </View>
    );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
    return (
        <TextInput
            placeholderTextColor="#8A8CA3"
            {...props}
            style={[styles.input, brandFont(400), props.multiline ? { minHeight: 80, textAlignVertical: "top" } : null]}
        />
    );
}

function Chips({
    options,
    selected,
    onToggle,
}: {
    options: { id: string; label: string }[];
    selected: string[];
    onToggle: (id: string) => void;
}) {
    return (
        <View style={styles.chips}>
            {options.map((o) => {
                const on = selected.includes(o.id);
                return (
                    <TouchableOpacity
                        key={o.id}
                        onPress={() => onToggle(o.id)}
                        style={[styles.chip, on ? styles.chipOn : null]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                    >
                        <Text style={[styles.chipText, brandFont(600), on ? styles.chipTextOn : null]}>{o.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BRAND_COLORS.backgroundAlt },
    intro: { fontFamily: "NotoSans_400Regular", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.textMuted, lineHeight: 20, marginBottom: 16 },
    sectionTitle: {
        fontFamily: "NotoSans_700Bold",
        fontSize: BRAND_TYPE.secondary,
        color: BRAND_COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 8,
        paddingLeft: 4,
    },
    card: {
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.card,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        padding: 16,
        gap: 14,
    },
    row2: { flexDirection: "row", gap: 10 },
    label: { fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.navy },
    input: {
        fontFamily: "NotoSans_400Regular",
        fontSize: BRAND_TYPE.body,
        color: BRAND_COLORS.navy,
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        borderRadius: BRAND_RADII.input,
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: BRAND_COLORS.white,
    },
    error: { fontFamily: "NotoSans_500Medium", fontSize: BRAND_TYPE.label + 1, color: "#BE123C" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        borderWidth: 1,
        borderColor: BRAND_COLORS.border,
        backgroundColor: BRAND_COLORS.white,
        borderRadius: BRAND_RADII.pill,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    chipOn: { backgroundColor: BRAND_COLORS.navy, borderColor: BRAND_COLORS.navy },
    chipText: { fontFamily: "NotoSans_600SemiBold", fontSize: BRAND_TYPE.secondary + 1, color: BRAND_COLORS.navy },
    chipTextOn: { color: BRAND_COLORS.white },
    saveButton: { backgroundColor: BRAND_COLORS.azur, borderRadius: BRAND_RADII.input, paddingVertical: 15, alignItems: "center", marginTop: 4 },
    saveText: { fontFamily: "NotoSans_700Bold", fontSize: BRAND_TYPE.body, color: BRAND_COLORS.white },
});
