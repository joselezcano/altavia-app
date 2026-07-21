export interface CustomDatePickerProps {
  value: Date | null | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minimumDate?: Date | null;
  includeTime?: boolean;
}
