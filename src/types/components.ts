import type { FlightWeather, FlightWeatherRequest, FlightWeatherVariant } from "./weather";

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

/** Badge de estado que muestra FlightSummaryCard (mismos campos de color que getStatusBadge). */
export interface FlightSummaryStatus {
  label: string;
  icon: string;
  iconColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

/** Card de vuelo colapsable (src/components/flight-summary-card.tsx). */
export interface FlightSummaryCardProps {
  expanded: boolean;
  onToggle: () => void;
  /** Línea chica arriba de la ruta (ej. modelo de la aeronave o "Vuelo de Ida"). */
  eyebrow?: string;
  originCode: string;
  originName?: string;
  destinationCode: string;
  destinationName?: string;
  departureTime: Date;
  roundtrip?: boolean;
  status?: FlightSummaryStatus;
  registration?: string;
  passengers?: number;
  /** Precio en USD (se muestra si es > 0). */
  priceUsd?: number;
  /** Pronóstico del tramo (null si el vuelo no cumple las condiciones). */
  weatherRequest?: FlightWeatherRequest | null;
  /** true: al desplegar muestra el bloque de clima completo (piloto, owner, encargada). */
  weatherDetail?: boolean;
  /** Contenido y acciones que se muestran al desplegar la card. */
  children?: React.ReactNode;
}

/** Bloque de clima con su propia consulta (detalle del vuelo). */
export interface FlightWeatherCardProps {
  request: FlightWeatherRequest | null;
  variant?: FlightWeatherVariant;
}

/** Bloques de clima presentacionales. */
export interface FlightWeatherViewProps {
  weather: FlightWeather;
}
