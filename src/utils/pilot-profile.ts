/** true si el perfil de piloto tiene los datos mínimos para volar (documento y licencia). */
export function isPilotProfileComplete(
    data:
        | { basic?: { id_number?: string } | null; aeronautical?: { pilot_licence?: string; licence_type?: string } | null }
        | null
        | undefined
): boolean {
    return !!data?.basic?.id_number && !!data?.aeronautical?.pilot_licence && !!data?.aeronautical?.licence_type;
}
