import { CustomInput } from "@/components/custom-input";
import { ThemedText } from "@/components/themed-text";
import { FlightPlan } from "@/types/pilot";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";


export const fieldsToValidate2 = [
    "flight_plan.departure.icao",
    "flight_plan.departure.datetime_utc",
    "flight_plan.departure.off_block_time",
    "flight_plan.arrival.icao",
    "flight_plan.arrival.datetime_utc",
    "flight_plan.arrival.alternate_icao",
    "flight_plan.route.cruising_speed_knots",
    "flight_plan.route.cruising_altitude_feet",
    "flight_plan.route.waypoints",
    "flight_plan.route.encoded_route",
];


export function FormStep2({
    control,
    errors
}: {
    control: Control<FlightPlan>;
    errors: FieldErrors<FlightPlan>;
}) {
    return (<View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
            2. Ruta y Aeródromos
        </ThemedText>

        {/* Origen OACI */}
        <CustomInput
            control={control}
            label="Origen [OACI]"
            name="flight_plan.departure.icao"
            uppercase={true}
            placeholder="ej. SGAS"
            maxLength={4}
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Fecha / Hora Salida */}
        <CustomInput
            control={control}
            label="Fecha / Hora de Salida (UTC)"
            name="flight_plan.departure.datetime_utc"
            placeholder="AAAA-MM-DDTHH:MM:SSZ"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Off Block Time (HHMM) */}
        <CustomInput
            control={control}
            label="Hora Fuera de Calzos (HHMM)"
            name="flight_plan.departure.off_block_time"
            placeholder=""
            maxLength={4}
            keyboardType="numeric"
            errors={errors}
        />

        {/* Destino OACI */}
        <CustomInput
            control={control}
            label="Destino [OACI]"
            name="flight_plan.arrival.icao"
            uppercase={true}
            placeholder="ej. SGES"
            maxLength={4}
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Fecha / Hora Llegada */}
        <CustomInput
            control={control}
            label="Fecha / Hora de Llegada (UTC)"
            name="flight_plan.arrival.datetime_utc"
            placeholder="AAAA-MM-DDTHH:MM:SSZ"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Aeródromo Alternativo OACI (Opcional) */}
        <CustomInput
            control={control}
            label="Aeródromo Alternativo [OACI] (Opcional)"
            name="flight_plan.arrival.alternate_icao"
            uppercase={true}
            placeholder=""
            maxLength={4}
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Velocidad de Crucero (Nudos) */}
        <CustomInput
            control={control}
            label="Velocidad de Crucero (Nudos)"
            name="flight_plan.route.cruising_speed_knots"
            integer={true}
            placeholder=""
            keyboardType="numeric"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Altitud de Crucero (Pies) */}
        <CustomInput
            control={control}
            label="Altitud de Crucero (Pies)"
            name="flight_plan.route.cruising_altitude_feet"
            integer={true}
            placeholder=""
            keyboardType="numeric"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Puntos de Ruta */}
        <CustomInput
            control={control}
            label="Puntos de Ruta (separados por espacios)"
            name="flight_plan.route.waypoints"
            route={true}
            placeholder="ej. SGOV SGVR"
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Ruta Codificada Completa */}
        <CustomInput
            control={control}
            label="Ruta Codificada Completa"
            name="flight_plan.route.encoded_route"
            route={true}
            placeholder="ej. SGAS SGOV SGVR SGES"
            enableKeyboardSuggestions={false}
            errors={errors}
        />
    </View>
    );
}