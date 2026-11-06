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


