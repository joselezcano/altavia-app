export interface AccountingFlightItem {
    id: string;
    reservationCode: string;
    flightDate: Date;
    route: {
        originIdent: string;
        originCity: string;
        destinationIdent: string;
        destinationCity: string;
        roundtrip: boolean;
    };
    aircraft: {
        id: string;
        model: string;
        registration: string;
        photoUrl?: string;
    };
    client: {
        id?: string;
        name: string;
        company?: string;
        email?: string;
        ruc?: string;
    };
    flightHours: number;
    distanceNm: number;
    amountUsd: number;
    amountGs: number;
    iva10Usd: number;
    iva10Gs: number;
    netAmountUsd: number;
    netAmountGs: number;
    paymentStatus: "paid" | "pending" | "refunded";
    paymentMethod: string; // "bancard_vpos" | "sipap_transfer" | "credit_line"
    paymentDate?: Date;
    transactionId?: string;
    invoiceNumber?: string;
    invoiceTimbrado?: string;
    invoiceCdc?: string;
    isMock?: boolean;
}

export interface AircraftRevenueShare {
    aircraftId: string;
    model: string;
    registration: string;
    revenueUsd: number;
    revenueGs: number;
    flightCount: number;
    flightHours: number;
    percentage: number;
}

export interface MonthlyAccountingMetrics {
    month: number; // 0-11
    year: number;
    monthName: string;
    totalRevenueUsd: number;
    totalRevenueGs: number;
    totalNetUsd: number;
    totalNetGs: number;
    totalIvaUsd: number;
    totalIvaGs: number;
    completedFlightsCount: number;
    totalFlightHours: number;
    avgTicketUsd: number;
    avgPerHourUsd: number;
    revenueChangePercentage?: number; // Compared to previous month
    aircraftBreakdown: AircraftRevenueShare[];
    paymentMethodsBreakdown: {
        bancardUsd: number;
        transferUsd: number;
        otherUsd: number;
    };
    statusCounts: {
        paid: number;
        pending: number;
    };
}

export interface AccountingFilterState {
    month: number;
    year: number;
    selectedAircraftId: string; // "all" or specific id
    statusFilter: "all" | "paid" | "pending";
    searchQuery: string;
    includeDemoData: boolean;
}
