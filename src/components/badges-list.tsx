import { ThemedText } from "@/components/themed-text";
import { View } from "react-native";


export const BadgesList = ({
    label,
    items,
    map,
}: {
    label: string;
    items: string[] | string | undefined | null;
    map?: Record<string, string>;
}) => {
    const list = Array.isArray(items)
        ? items
        : typeof items === "string" && items.trim() !== ""
            ? items.split(/[\s,]+/).filter(Boolean)
            : [];

    const hasItems = list.length > 0;
    return (
        <View className="py-2.5 border-b border-slate-100">
            <ThemedText type="caption" className="text-slate-500 font-medium mb-1.5">
                {label}
            </ThemedText>
            {hasItems ? (
                <View className="flex-row flex-wrap gap-1.5 mt-0.5">
                    {list.map((item, idx) => (
                        <View
                            key={`${item}-${idx}`}
                            className="bg-slate-100 border border-slate-200/65 px-2.5 py-1 rounded-md"
                        >
                            <ThemedText className="text-xs font-semibold text-slate-700">
                                {map && map[item] ? `${item} - ${map[item]}` : String(item)}
                            </ThemedText>
                        </View>
                    ))}
                </View>
            ) : (
                <ThemedText className="font-semibold text-slate-400 italic">
                    Ninguno
                </ThemedText>
            )}
        </View>
    );
};