import { ThemedText } from "@/components/themed-text";
import { AircraftTemplateDoc } from "@/hooks/useAircraftTemplates";
import { AircraftSpecs } from "@/types/owner";
import { Ionicons } from "@expo/vector-icons";
import { Dispatch, SetStateAction } from "react";
import { UseFormSetValue } from "react-hook-form";
import {
    ScrollView,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import Toast from "react-native-toast-message";


export function AircraftTypeSuggestions({
    searchQuery,
    setSearchQuery,
    showSuggestions,
    setShowSuggestions,
    setIsManualInput,
    setValue,
    templates,
    setSelectedTemplateName,
}: {
    searchQuery: string;
    setSearchQuery: Dispatch<SetStateAction<string>>;
    showSuggestions: boolean;
    setShowSuggestions: Dispatch<SetStateAction<boolean>>;
    setIsManualInput: Dispatch<SetStateAction<boolean>>;
    setValue: UseFormSetValue<AircraftSpecs>;
    templates: AircraftTemplateDoc[];
    setSelectedTemplateName: Dispatch<SetStateAction<string>>;
}) {
    return (

        <View className="bg-brand-white rounded-2xl p-5 border border-slate-100 gap-4 mb-4">
            <ThemedText className="font-semibold text-brand-blue text-sm">
                Buscar tipo de avión por código OACI
            </ThemedText>

            <View >
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                    <Ionicons name="search-outline" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                        className="text-brand-text font-medium text-base"
                        style={{ flex: 1, height: 40, paddingVertical: 0 }}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            setShowSuggestions(text.trim().length > 0);
                            if (!text) {
                                setSelectedTemplateName("");
                            }
                        }}
                        onFocus={() => {
                            if (searchQuery.trim().length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery("");
                                setSelectedTemplateName("");
                                setShowSuggestions(false);
                                setIsManualInput(false);
                                setValue("basic_specs.model", "");
                                setValue("basic_specs.type", "");
                                setValue("basic_specs.pax_count", undefined as any);
                                setValue("basic_specs.registration", "");
                            }}
                        >
                            <Ionicons name="close-circle" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && (
                    <View className="absolute top-[52px] left-0 right-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg max-h-48 z-50">
                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                            {templates
                                .filter(
                                    (tpl) =>
                                        tpl.template_info.name
                                            .toLowerCase()
                                            .includes(searchQuery.toLowerCase()) ||
                                        tpl.template_info.type
                                            .toLowerCase()
                                            .includes(searchQuery.toLowerCase())
                                )
                                .map((tpl) => (
                                    <TouchableOpacity
                                        key={tpl.id}
                                        onPress={() => {
                                            setValue("basic_specs.model", tpl.template_info.model);
                                            setValue("basic_specs.type", tpl.template_info.type);
                                            setValue("basic_specs.pax_count", tpl.template_info.default_pax_count);
                                            setValue("technical_specs", tpl.technical_specs);
                                            setValue("operating_specs", tpl.operating_specs);
                                            setValue("emergency", tpl.emergency);
                                            setSelectedTemplateName(tpl.template_info.name);
                                            setSearchQuery(tpl.template_info.name);
                                            setIsManualInput(false);
                                            setShowSuggestions(false);
                                            Toast.show({
                                                type: "info",
                                                text1: "Plantilla aplicada",
                                                text2: `${tpl.template_info.name} cargado correctamente.`,
                                            });
                                        }}
                                        className="px-4 py-3 border-b border-slate-100 flex-row justify-between items-center active:bg-slate-50"
                                    >
                                        <View>
                                            <ThemedText className="text-sm font-semibold text-brand-blue">
                                                {tpl.template_info.name}
                                            </ThemedText>
                                            <ThemedText type="caption" className="text-slate-400 text-xs">
                                                Código OACI: {tpl.template_info.type}
                                            </ThemedText>
                                        </View>
                                        <Ionicons name="airplane-outline" size={16} color="#b89c50" />
                                    </TouchableOpacity>
                                ))}
                            {templates.filter(
                                (tpl) =>
                                    tpl.template_info.name
                                        .toLowerCase()
                                        .includes(searchQuery.toLowerCase()) ||
                                    tpl.template_info.type
                                        .toLowerCase()
                                        .includes(searchQuery.toLowerCase())
                            ).length === 0 && (
                                    <View className="px-2 py-4">
                                        <ThemedText type="caption" className="text-slate-400 text-center mb-3">
                                            No hay coincidencias
                                        </ThemedText>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setIsManualInput(true);
                                                setSelectedTemplateName("");
                                                setShowSuggestions(false);
                                            }}
                                            className="bg-brand-gold/10 border border-brand-gold/20 px-4 py-2.5 rounded-xl items-center"
                                        >
                                            <View className="flex-row items-center gap-2">
                                                <Ionicons
                                                    name="add-circle-outline"
                                                    size={20}
                                                    color="#C5A059"
                                                />
                                                <ThemedText type="accent" className="text-base font-bold text-brand-gold">
                                                    Ingresar datos manualmente
                                                </ThemedText>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                )}
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}