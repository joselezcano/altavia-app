import { ThemedText } from "@/components/themed-text";
import UserAvatar from "@/components/user-avatar";
import { View } from "react-native";


export function PilotHeader({
    title,
    subtitle,
}: {
    title: string;
    subtitle: string;
}) {
    return (
        <View className="flex-row justify-between items-center mb-6 mt-2">
            <View>
                <ThemedText
                    type="caption"
                    className="uppercase font-bold text-brand-gold tracking-widest text-xs"
                >
                    {title}
                </ThemedText>
                <ThemedText type="title" className="text-2xl font-bold mt-0.5">
                    {subtitle}
                </ThemedText>
            </View>
            <UserAvatar size={44} />
        </View>
    );
}