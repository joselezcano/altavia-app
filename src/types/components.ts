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

/** Botón que abre WhatsApp con el contacto comercial de AltaGo. */
export interface WhatsAppContactButtonProps {
  /** Mensaje precargado para el cliente. */
  message: string;
  label?: string;
  /** "solid": verde de WhatsApp; "outline": borde de marca sobre fondo claro; "light": sobre fondo oscuro. */
  variant?: "solid" | "outline" | "light";
  compact?: boolean;
}

/** Datos del cliente para el comprobante de pago (PDF sin valor fiscal). */
export interface PaymentReceiptOptions {
  clientName?: string;
  clientEmail?: string;
  /** Tipo de cambio (Gs por USD) para mostrar el equivalente aproximado. */
  exchangeRate?: number;
}

/** Opción de rol (selector de rol en el ingreso, en la hoja de cuenta y en Perfil). */
export interface RoleOptionProps {
  role: "ADMIN" | "CLIENT" | "PILOT" | "OWNER";
  active?: boolean;
  onPress: () => void;
}

/** Hoja de cuenta que se abre al tocar el avatar (igual para todos los roles). */
export interface AccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Avatar del usuario (abre la hoja de cuenta). */
export interface UserAvatarProps {
  size?: number;
  showDetails?: boolean;
  /** Círculo blanco con inicial navy (sobre fondos oscuros o fotos). */
  light?: boolean;
}

/** Wrapper de compatibilidad: abre la hoja de cuenta desde el botón del header del owner. */
export interface UserModalProps {
  modalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  user?: unknown;
  role?: unknown;
  userInitial?: string;
}

/** Acceso propio de un rol dentro de la hoja de cuenta. */
export interface AccountMenuItem {
  id: string;
  label: string;
  icon: import("react").ComponentProps<typeof import("@expo/vector-icons").Ionicons>["name"];
  href: import("expo-router").Href;
  /** Aviso corto a la derecha (ej. "Incompleto"). */
  badge?: string;
}
