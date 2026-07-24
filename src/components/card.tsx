import { cn } from "@/utils/cn";
import { Text, View, ViewProps } from "react-native";

type CardProps = ViewProps & {
    className?: string;
    title: string | undefined;
    content: string | undefined;
    shadow?: boolean;
};

export function Card({ className, title, content, shadow, ...rest }: CardProps) {
    if (!title && !content) {
        return null;
    }

    return (
        <View
            className={cn(
                className,
                shadow && "shadow-sm elevation-sm dark:shadow-none dark:elevation-none",
                "border border-gray-200 rounded-lg bg-white dark:border-white/10 dark:bg-gray-800/50",
            )}
            {...rest}
        >
            {title &&
                <View className="border-b border-gray-200 px-3 py-4 dark:border-white/10">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white">{title}</Text>
                </View>
            }
            {content &&
                <View className="px-3 py-4 sm:p-6">
                    <Text className="text-sm text-gray-900 dark:text-white">{content}</Text>
                </View>
            }
        </View>
    );
};