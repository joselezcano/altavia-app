import { useResponsive } from "@/hooks/use-responsive";
import { ScreenContainerProps } from "@/types/components";
import React from "react";
import { StyleSheet, View } from "react-native";

export function ScreenContainer({
  children,
  maxWidth = 1140,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const { isWideScreen } = useResponsive();

  return (
    <View style={[styles.outerContainer, style]}>
      <View
        style={[
          styles.innerContainer,
          isWideScreen && { maxWidth, alignSelf: "center", width: "100%" },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: "100%",
  },
  innerContainer: {
    flex: 1,
    width: "100%",
  },
});
