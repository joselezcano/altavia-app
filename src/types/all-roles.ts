export interface Airport {
    ident: string;
    type: string;
    name: string;
    latitude_deg: number;
    longitude_deg: number;
    elevation_ft: number | null;
    country: string;
    region: string;
    municipality: string | null;
    iata_code: string | null;
    icao_code: string | null;
    gps_code: string | null;
    search_tags?: Array<string>;
    timezone?: string;
};