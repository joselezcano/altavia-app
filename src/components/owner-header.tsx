import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { TouchableOpacity, View } from "react-native";


export function OwnerHeader({
    title,
    subtitle,
    onMenuPress,
    onActionButtonPress,
    userInitial,
    iconName,
}: {
    title: string;
    subtitle: string;
    onMenuPress: () => void;
    onActionButtonPress?: () => void;
    userInitial?: string;
    iconName?: ComponentProps<typeof Ionicons>["name"];
}) {
    return (
        <View className="flex-row items-center justify-between mb-4 mt-2">
            <TouchableOpacity
                onPress={onMenuPress}
                className="p-2 mr-4 bg-white rounded-xl shadow-sm border border-slate-100 active:bg-slate-50"
            >
                <Ionicons name="menu" size={24} color="#0f1e3d" />
            </TouchableOpacity>
            <View className="flex-1">
                <ThemedText
                    type="caption"
                    className="uppercase font-bold text-brand-gold tracking-widest text-xs"
                >
                    {title}
                </ThemedText>
                <ThemedText type="title" className="text-2xl font-bold mt-0.5 text-brand-blue">
                    {subtitle}
                </ThemedText>
            </View>
            {onActionButtonPress &&
                <TouchableOpacity
                    onPress={onActionButtonPress}
                    className="w-11 h-11 rounded-full bg-brand-blue items-center justify-center shadow-sm"
                    activeOpacity={0.8}
                >
                    {userInitial &&
                        <ThemedText className="text-white font-bold text-base">
                            {userInitial}
                        </ThemedText>
                    }
                    {iconName &&
                        <Ionicons name={iconName} size={24} color="#FFFFFF" />
                    }
                </TouchableOpacity>
            }
        </View>
    );
}