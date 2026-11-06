export type BancardEnvironment = "staging" | "production";

/**
 * Configuración pública de Bancard en la app.
 * Las claves (pública/privada) viven SOLO en Cloud Functions (functions/.env).
 */
export interface BancardConfig {
    stagingUrl: string;
    productionUrl: string;
    commerceName: string;
}

/** Respuesta de la Cloud Function `bancardSingleBuy`. */
export interface BancardSingleBuyResult {
    processId: string;
    shopProcessId: number;
    amountPyg: number;
    amountUsd: number;
    exchangeRate: number;
    environment: BancardEnvironment;
    checkoutBaseUrl: string;
    returnUrl: string;
    cancelUrl: string;
}

/** Respuesta de la Cloud Function `createPaymentLink` (link para WhatsApp). */
export interface CreatePaymentLinkResult {
    url: string;
    expiresAt: string;
    amountUsd: number;
    amountPygEstimate: number;
}

/** Respuesta de la Cloud Function `bancardGetConfirmation`. */
export interface BancardConfirmationResult {
    status: "approved" | "declined" | "pending";
    responseCode?: string;
    responseDescription?: string;
    authorizationNumber?: string;
    ticketNumber?: string;
}

export interface BancardBillingDetail {
    description: string;
    amount: string;
    iva_rate: number;
    total_items: number;
}

export interface BancardBilling {
    client_ruc: string | null;
    client_name: string;
    client_email: string;
    commerce_stamp: string;
    commerce_expedition_point: string;
    commerce_establishment: string;
    details: BancardBillingDetail[];
}

export interface BancardSingleBuyOperation {
    token: string;
    shop_process_id: number;
    amount: string;
    currency: string;
    description: string;
    return_url: string;
    cancel_url: string;
    billing?: BancardBilling;
    additional_data?: string;
    zimple?: string;
}

export interface BancardSingleBuyPayload {
    public_key: string;
    operation: BancardSingleBuyOperation;
}

export interface BancardSingleBuySuccessResponse {
    status: "success";
    process_id: string;
}

export interface BancardSingleBuyErrorResponse {
    status: "error";
    messages?: Array<{
        key: string;
        level: string;
        dsc: string;
    }>;
}

export type BancardSingleBuyResponse =
    | BancardSingleBuySuccessResponse
    | BancardSingleBuyErrorResponse;

export interface BancardTestCard {
    brand: "MasterCard" | "Visa" | "Bancard";
    cardNumber: string;
    formattedNumber: string;
    expiration: string;
    cvv: string;
    name: string;
    cardHolder: string;
}

export interface BancardPaymentSuccessEvent {
    type: "payment_success";
    transactionId: string;
    authorizationCode: string;
    ticketNumber?: string;
    cardBrand?: string;
    cardLast4?: string;
    amountPyg: number;
    amountUsd: number;
    processId?: string;
}

export interface BancardPaymentErrorEvent {
    type: "payment_error";
    code?: string;
    description: string;
}

export type BancardWebViewMessage =
    | BancardPaymentSuccessEvent
    | BancardPaymentErrorEvent
    | { type: "close" };

export interface ClientInAppNotification {
    id: string;
    userId: string;
    reservationId: string;
    title: string;
    message: string;
    type: "flight_approved" | "payment_confirmed" | "flight_update";
    read: boolean;
    created_at: Date;
    routeText?: string;
    amountUsd?: number;
}
