import { FormNavigationButtons } from "@/components/form-navigation-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { FormStep1, fieldsToValidate1 } from "@/screens/create-flight-plan/components/form-step-1";
import { FormStep2, fieldsToValidate2 } from "@/screens/create-flight-plan/components/form-step-2";
import { FormStep3, fieldsToValidate3 } from "@/screens/create-flight-plan/components/form-step-3";
import { FormStep4 } from "@/screens/create-flight-plan/components/form-step-4";
import { AircraftSpecs } from "@/types/owner";
import { FlightPlan, flightPlanSchema } from "@/types/pilot";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";


const normalizeArray = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim() !== "") return val.split(/[\s,]+/).filter(Boolean);
    return [];
};


export default function CreateFlightPlanScreen() {
    const { user, userData, profileData } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{
        flightPlanId?: string;
        reservationId?: string;
        legType?: string;
        originIdent?: string;
        destinationIdent?: string;
        originIcaoCode?: string;
        destinationIcaoCode?: string;
        departureTime?: string;
        aircraftId?: string;
        paxCount?: string;
    }>();

    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Default values matching the Zod schema structure with empty route/performance fields
    const defaultValues: FlightPlan = {
        flight_plan: {
            aircraft: {
                registration: "",
                type: "",
                wake_turbulence: "L",
                equipment: [],
                transponder: "",
            },
            flight_details: {
                callsign: "",
                flight_rules: "IFR",
                flight_type: "N",
            },
            departure: {
                icao: params.originIcaoCode || "",
                datetime_utc: params.departureTime || (new Date().toISOString().split('.')[0] + 'Z'),
                off_block_time: "", // ejemplo: "0000",
            },
            arrival: {
                icao: params.destinationIcaoCode || "",
                datetime_utc: "",
                alternate_icao: "",
            },
            route: {
                cruising_speed_knots: 0,
                cruising_altitude_feet: 0,
                waypoints: [], // ejemplo: ["SGOV", "SGVR"]
                encoded_route: [], // ejemplo: ["SGAS", "SGOV", "SGVR", "SGES"],
            },
            performance: {
                eet_hours: 0,
                eet_minutes: 0,
                fuel_hours: 0,
                fuel_minutes: 0,
            },
            emergency: {
                pax_count: params.paxCount ? parseInt(params.paxCount, 10) : 1,
                radio_equipment: [],
                survival_equipment: [],
                life_jacket_equipment: [],
                dinghies_capacity: {
                    carried: false,
                    number: 0,
                    total_capacity: 0,
                    covered: false,
                    color: "",
                },
            },
            pilot: {
                name: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || "",
                contact_info: profileData?.basic.telephone || "",
                observations: "",
            },
        },
        aircraft_reservation_id: params.reservationId || undefined,
        airports: {
            origin_ident: params.originIdent || "",
            destination_ident: params.destinationIdent || "",
        },
    };

    const {
        control,
        handleSubmit,
        formState: { errors },
        trigger,
        reset,
        watch
    } = useForm<FlightPlan>({
        resolver: zodResolver(flightPlanSchema) as any,
        defaultValues,
        mode: "onChange",
    });

    useEffect(() => {
        let isMounted = true;

        async function populateFromExistingPlan() {
            if (!params.flightPlanId) return;
            try {
                const docRef = doc(db, "flight-plans", params.flightPlanId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && isMounted) {
                    const data = docSnap.data();
                    if (data.flight_plan) {
                        const fp = data.flight_plan;
                        reset({
                            flight_plan: {
                                ...fp,
                                aircraft: {
                                    ...fp.aircraft,
                                    equipment: normalizeArray(fp.aircraft?.equipment),
                                },
                                route: {
                                    ...fp.route,
                                    waypoints: normalizeArray(fp.route?.waypoints),
                                    encoded_route: normalizeArray(fp.route?.encoded_route),
                                },
                                emergency: {
                                    ...fp.emergency,
                                    radio_equipment: normalizeArray(fp.emergency?.radio_equipment),
                                    survival_equipment: normalizeArray(fp.emergency?.survival_equipment),
                                    life_jacket_equipment: normalizeArray(fp.emergency?.life_jacket_equipment),
                                },
                            },
                            aircraft_reservation_id: data.aircraft_reservation_id || params.reservationId || undefined,
                        });
                        return;
                    }
                }
            } catch (e) {
                console.error("Error fetching existing flight plan for edit:", e);
            }
        }

        async function populateFromParams() {
            const pilotName =
                `${profileData?.basic?.id_first_name || ''} ${profileData?.basic?.id_last_name || ''}`.trim() ||
                `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
                "";
            const pilotContact = profileData?.basic?.telephone || "";

            let aircraftSpecs: AircraftSpecs | null = null;
            if (params.aircraftId) {
                try {
                    const specDocRef = doc(db, "AircraftSpecs", params.aircraftId);
                    const specSnap = await getDoc(specDocRef);
                    if (specSnap.exists()) {
                        aircraftSpecs = specSnap.data() as AircraftSpecs;
                    }
                } catch (e) {
                    console.error("Error al obtener especificaciones de la aeronave para el plan de vuelo:", e);
                }
            }

            const depIdent = params.originIcaoCode || "";
            const arrIdent = params.destinationIcaoCode || "";
            const depDateUtc = params.departureTime?.split('.')[0] + 'Z' || "";
            const depDateObj = new Date(depDateUtc);
            const offBlockTime = !isNaN(depDateObj.getTime())
                ? String(depDateObj.getUTCHours()).padStart(2, "0") + String(depDateObj.getUTCMinutes()).padStart(2, "0")
                : "";

            const registration = aircraftSpecs?.basic_specs.registration || "";
            const type = aircraftSpecs?.basic_specs.type || "";
            const wake_turbulence = aircraftSpecs?.technical_specs.wake_turbulence_category ?? "L";
            const equipment = aircraftSpecs?.technical_specs.equipment || [];
            const transponder = aircraftSpecs?.technical_specs.transponder ?? "";
            const flight_rules = aircraftSpecs?.technical_specs.flight_rules ?? "IFR";

            const pax_count = params.paxCount
                ? parseInt(params.paxCount, 10)
                : aircraftSpecs?.basic_specs?.pax_count || 1; // Requested seats by the client

            const populatedValues: FlightPlan = {
                flight_plan: {
                    aircraft: {
                        registration,
                        type,
                        wake_turbulence,
                        equipment,
                        transponder,
                    },
                    flight_details: {
                        callsign: registration,
                        flight_rules,
                        flight_type: "N",
                    },
                    departure: {
                        icao: depIdent,
                        datetime_utc: depDateUtc,
                        off_block_time: offBlockTime,
                    },
                    arrival: {
                        icao: arrIdent,
                        datetime_utc: "",
                        alternate_icao: "",
                    },
                    route: {
                        cruising_speed_knots: 0,
                        cruising_altitude_feet: 0,
                        waypoints: [],
                        encoded_route: [],
                    },
                    performance: {
                        eet_hours: 0,
                        eet_minutes: 0,
                        fuel_hours: 0,
                        fuel_minutes: 0,
                    },
                    emergency: {
                        pax_count: isNaN(pax_count) ? 1 : pax_count,
                        radio_equipment: aircraftSpecs?.emergency.radio_equipment || [],
                        survival_equipment: aircraftSpecs?.emergency.survival_equipment || [],
                        life_jacket_equipment: aircraftSpecs?.emergency.life_jacket_equipment || [],
                        dinghies_capacity: aircraftSpecs?.emergency.dinghies_capacity || {
                            carried: false,
                            number: 0,
                            total_capacity: 0,
                            covered: false,
                            color: "",
                        },
                    },
                    pilot: {
                        name: pilotName,
                        contact_info: pilotContact,
                        observations: "",
                    },
                },
                aircraft_reservation_id: params.reservationId || undefined,
                airports: {
                    origin_ident: params.originIdent || "",
                    destination_ident: params.destinationIdent || "",
                },
            };

            if (isMounted) {
                reset(populatedValues);
            }
        }

        if (params.flightPlanId) {
            populateFromExistingPlan();
        } else {
            populateFromParams();
        }

        return () => {
            isMounted = false;
        };
    }, [params.flightPlanId, params.reservationId, params.aircraftId, params.originIcaoCode, params.destinationIcaoCode, params.departureTime, params.paxCount]);

    const onSubmit = async (data: FlightPlan) => {
        if (!user) {
            Alert.alert("Error", "No tienes una sesión activa.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (params.flightPlanId) {
                const docRef = doc(db, "flight-plans", params.flightPlanId);
                await updateDoc(docRef, {
                    ...data,
                    pilot_id: user.uid,
                    updated_at: serverTimestamp(),
                    status: "Updated",
                });

                await queryClient.invalidateQueries({ queryKey: ["pilot-flight-plans", user.uid] });
                await queryClient.invalidateQueries({ queryKey: ["flight-plan-details", params.flightPlanId] });
                const resId = params.reservationId || data.aircraft_reservation_id;
                if (resId) {
                    await queryClient.invalidateQueries({ queryKey: ["flight-plan-reservation", resId] });
                }

                Toast.show({
                    type: "success",
                    text1: "Plan de Vuelo Actualizado",
                    text2: `ID: ${params.flightPlanId.slice(0, 8)}...`,
                });

                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.push("/(pilot)/plans");
                }
            } else {
                const docRef = await addDoc(collection(db, "flight-plans"), {
                    ...data,
                    pilot_id: user.uid,
                    updated_at: serverTimestamp(),
                    created_at: serverTimestamp(),
                    status: "New",
                });

                await queryClient.invalidateQueries({ queryKey: ["pilot-flight-plans", user.uid] });
                const resId = params.reservationId || data.aircraft_reservation_id;
                if (resId) {
                    await queryClient.invalidateQueries({ queryKey: ["flight-plan-reservation", resId] });
                }

                Toast.show({
                    type: "success",
                    text1: "Plan de Vuelo Creado",
                    text2: `ID: ${docRef.id.slice(0, 8)}...`,
                });

                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.push("/(pilot)/plans");
                }
            }
        } catch (error: any) {
            console.error("Error saving flight plan:", error);
            Alert.alert("Error", error.message || "No se pudo guardar el plan de vuelo.");
        } finally {
            setIsSubmitting(false);
        }
    };


    // Always fill fieldsToValidate for all steps, except the last one.
    // Verify that fieldsToValidate.length + 1 = number of form steps
    const fieldsToValidate = [fieldsToValidate1, fieldsToValidate2, fieldsToValidate3];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 bg-brand-light"
            style={{ paddingTop: insets.top }}
        >
            <ThemedView className="flex-1 px-4">
                {/* Cabecera con botón de retroceso */}
                <View className="flex-row items-center justify-between mb-4 mt-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="flex-row items-center p-1"
                    >
                        <Ionicons name="arrow-back" size={24} color="#0f1e3d" />
                        <ThemedText className="font-semibold text-brand-blue ml-1">
                            Atrás
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText className="font-bold text-brand-blue text-lg">
                        {params.flightPlanId ? "Editar Plan de Vuelo" : "Nuevo Plan de Vuelo"}
                    </ThemedText>
                    <View style={{ width: 60 }} />
                </View>

                {/* Indicador de Pasos */}
                <View className="flex-row justify-between mb-6 px-2">
                    {[1, 2, 3, 4].map((step) => (
                        <View key={step} className="items-center flex-1">
                            <View
                                className={`w-8 h-8 rounded-full items-center justify-center font-bold ${currentStep === step
                                    ? "bg-brand-blue"
                                    : currentStep > step
                                        ? "bg-brand-gold"
                                        : "bg-slate-200"
                                    }`}
                            >
                                <ThemedText
                                    className={`text-sm font-bold ${currentStep >= step ? "text-white" : "text-slate-500"
                                        }`}
                                >
                                    {step}
                                </ThemedText>
                            </View>
                            <ThemedText className="text-[10px] text-slate-500 mt-1">
                                {step === 1 ? "Aeronave" : step === 2 ? "Ruta" : step === 3 ? "Rendimiento" : "Contacto"}
                            </ThemedText>
                        </View>
                    ))}
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                    {/* PASO 1: Aeronave y Detalles de Vuelo */}
                    {currentStep === 1 && <FormStep1 control={control} errors={errors} />}

                    {/* PASO 2: Salida, Llegada y Ruta */}
                    {currentStep === 2 && <FormStep2 control={control} errors={errors} />}

                    {/* PASO 3: Rendimiento y Equipamiento de Emergencia */}
                    {currentStep === 3 && <FormStep3 control={control} errors={errors} />}

                    {/* PASO 4: Datos del Piloto y Envío */}
                    {currentStep === 4 && <FormStep4 control={control} errors={errors} />}

                    {/* Botones de Navegación del Formulario */}
                    <FormNavigationButtons
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        isSubmitting={isSubmitting}
                        handleSubmit={handleSubmit(onSubmit)}
                        submitLabel={params.flightPlanId ? "Guardar Cambios" : "Enviar Plan"}
                        submitIcon="cloud-upload"
                        fieldsToValidate={fieldsToValidate}
                        trigger={trigger}
                    />
                </ScrollView>
            </ThemedView>
        </KeyboardAvoidingView>
    );
}
