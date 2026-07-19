import { Airport } from "@/types/all-roles";


// Fields to search
export const getSearchableFields = (airport: Airport) => {
    return `${airport.name} ${airport.municipality ?? ''} ${airport.region} ${airport.country} ${airport.iata_code ?? ''} ${airport.icao_code ?? ''} ${airport.gps_code ?? ''}`.toLowerCase();
}


export const buildSearchTags = (searchableFields: string) => {
    const filteredKeywords = getSearchKeywords(searchableFields);

    // Generate n-grams to enable partial word matching during search
    const nGrams = new Set<string>();

    filteredKeywords.forEach(word => {
        // Generate prefixes starting at 3 characters up to the full word length
        for (let i = 3; i <= word.length; i++) {
            nGrams.add(word.substring(0, i));
        }
    });

    return Array.from(nGrams);
};


export const getSearchKeywords = (searchText: string) => {
    // Split by spaces, remove empty strings, and get unique values
    let words = searchText.split(/\s+/).filter(Boolean);

    // Add words without accents and diacritics
    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    words.push(...words.map(removeAccents));

    // Remove parenthesis
    words = words.map((word) => word.replace(/[()]/g, ""));

    // Unique words
    const keywords = Array.from(new Set(words));

    // Remove common words
    const commonWords = [
        'united', 'states',
        'airport', 'aeropuerto',
        'heliport', 'helipuerto', 'helipad', 'helicentro',
        'international', 'internacional',
        'national', 'nacional',
        'department', 'departamento',
        'region', 'región', 'regiao', 'região',
        'country', 'pais', 'país',
        'municipality', 'municipio', 'município',
        'state', 'estado',
        'county', 'condado',
        'district', 'distrito',
        'territory', 'territorio',
        'province', 'provincia',
        'aerodromo', 'aeródromo',
        'base', 'federal',
        '-', '/', '&',
        'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
        'do', 'da', 'dos', 'das', 'e', 'a', 'o',
        'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'for', 'unassigned', 'under'
    ];

    const filteredKeywords = keywords.filter((keyword) => !commonWords.includes(keyword));

    return filteredKeywords;
}


// @ts-ignore
const chooseOneTimezone = (timezones: string[], airport: Airport) => {
    if (timezones.length === 0) {
        return "";
    }

    if (timezones.length === 1) {
        return timezones[0];
    }

    // Prefer match with municipality (city) because the IANA timezone format is Region/City
    // The region is usually the continent in America
    const searchString = (airport.municipality?.toLowerCase() ?? '') + ' ' + airport.region.toLowerCase() + ' ' + airport.country.toLowerCase();

    const matches: number[] = [];
    timezones.forEach((timezone, i) => {
        const city = timezone.toLowerCase().split('/')[1];
        if (searchString.includes(city)) matches.push(i);
    });

    // Pick the first match because getAirportTimezone (geo-tz) provides timezones ordered by highest population nearby
    return matches.length > 0 ? timezones[matches[0]] : "";
}