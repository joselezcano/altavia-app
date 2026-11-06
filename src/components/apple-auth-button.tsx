import { AppleAuthButtonProps } from "@/types/components";
import * as AppleAuthentication from "expo-apple-authentication";
import React from "react";

export function AppleAuthButton({ onPress, disabled }: AppleAuthButtonProps) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      onPress={onPress}
      style={{ width: "100%", height: 50, opacity: disabled ? 0.6 : 1 }}
    />
  );
}
