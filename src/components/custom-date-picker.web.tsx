import React from 'react';

interface CustomDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minimumDate?: Date;
}

export function CustomDatePicker({
  value,
  onChange,
  minimumDate,
}: CustomDatePickerProps) {
  // Helper to convert Date to local "YYYY-MM-DDTHH:mm" format for <input type="datetime-local">
  const toLocalDatetimeString = (date: Date | undefined): string => {
    if (!date) return '';
    const tzOffset = date.getTimezoneOffset() * 60000; // in ms
    const localTime = new Date(date.getTime() - tzOffset);
    return localTime.toISOString().slice(0, 16);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(undefined);
    } else {
      onChange(new Date(val));
    }
  };

  const minValString = minimumDate ? toLocalDatetimeString(minimumDate) : undefined;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="datetime-local"
        value={toLocalDatetimeString(value)}
        min={minValString}
        onChange={handleInputChange}
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
