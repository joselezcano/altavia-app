export interface CustomDatePickerProps {
  value: Date | null | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minimumDate?: Date | null;
  includeTime?: boolean;
}

export interface AppleAuthButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export interface ScreenContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: any;
  contentStyle?: any;
}



/** Opciones de confirmAction (src/utils/dialogs.ts / dialogs.web.ts). */
export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}
