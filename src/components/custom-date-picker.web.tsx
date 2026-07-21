import React from 'react';
import { CustomDatePickerProps } from '@/types/components';

export function CustomDatePicker({
  value,
  onChange,
  placeholder,
  minimumDate,
  includeTime = true,
}: CustomDatePickerProps) {
  // Helper to convert Date to local "YYYY-MM-DDTHH:mm" format for <input type="datetime-local">
  const toLocalDatetimeString = (date: Date | undefined | null): string => {
    if (!date) return '';
    const tzOffset = date.getTimezoneOffset() * 60000; // in ms
    const localTime = new Date(date.getTime() - tzOffset);
    return localTime.toISOString().slice(0, 16);
  };

  // Helper to convert Date to local "YYYY-MM-DD" format for <input type="date">
  const toLocalDateString = (date: Date | undefined | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(undefined);
    } else {
      if (includeTime) {
        onChange(new Date(val));
      } else {
        const [year, month, day] = val.split('-').map(Number);
        onChange(new Date(year, month - 1, day));
      }
    }
  };

  const minValString = minimumDate
    ? includeTime
      ? toLocalDatetimeString(minimumDate)
      : toLocalDateString(minimumDate)
    : undefined;

  const currentValueString = includeTime
    ? toLocalDatetimeString(value)
    : toLocalDateString(value);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={includeTime ? "datetime-local" : "date"}
        value={currentValueString}
        min={minValString}
        onChange={handleInputChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          backgroundColor: '#F8FAFC', // slate-50
          borderColor: '#E2E8F0', // slate-200
          borderWidth: '1px',
          borderStyle: 'solid',
          borderRadius: '12px', // rounded-xl
          padding: '12px 16px', // px-4 py-3
          color: value ? '#0F172A' : '#94A3B8', // slate-900 / slate-400
          fontWeight: 500,
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
