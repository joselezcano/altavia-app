import { ThemedText } from "@/components/themed-text";
import { FlightPlan } from "@/types/pilot";
import { Control, FieldErrors } from "react-hook-form";
import {
    View
} from "react-native";
import { CustomInput } from "./custom-input";


export function FormStep4({
    control,
    errors
}: {
    control: Control<FlightPlan>;
    errors: FieldErrors<FlightPlan>;
}) {
    return (<View className="bg-brand-white rounded-2xl p-5 border border-slate-100 shadow-sm gap-4 mb-4">
        <ThemedText type="subtitle" className="text-brand-blue font-bold text-lg mb-2">
            4. Datos del Piloto
        </ThemedText>

        {/* Nombre Completo del Piloto */}
        <CustomInput
            control={control}
            label="Nombre Completo del Piloto"
            name="flight_plan.pilot.name"
            placeholder=""
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Información de contacto */}
        <CustomInput
            control={control}
            label="Contacto del Piloto (Teléfono)"
            name="flight_plan.pilot.contact_info"
            placeholder=""
            enableKeyboardSuggestions={false}
            errors={errors}
        />

        {/* Observaciones */}
        <CustomInput
            control={control}
            label="Observaciones"
            name="flight_plan.pilot.observations"
            placeholder="Agrega notas adicionales aquí..."
            multiline
            numberOfLines={4}
            enableKeyboardSuggestions={true}
            errors={errors}
        />
    </View>
    );
}