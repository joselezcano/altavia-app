/**
 * Rutas según el rol activo.
 *
 * Las pantallas de reservas (new-booking, reservations) se re-exportan en varios
 * grupos, pero cada grupo está protegido por rol (Stack.Protected en el _layout raíz):
 * navegar a "/(owner)/..." siendo encargada (rol PILOT) no funciona. Estas funciones
 * devuelven la ruta equivalente dentro del grupo del rol activo, o null si ese grupo
 * no tiene la pantalla (por ejemplo, el ADMIN no tiene flight-details ni assign-pilots).
 */
import type { Role } from "@/hooks/useAuth";
import type { RoleFlightScreen, RoleRoute } from "@/types/reservation-edit";
import type { Href } from "expo-router";

/** Pantallas del stack de vuelos que el ADMIN también tiene (en su Drawer). */
const ADMIN_SCREENS: RoleFlightScreen[] = ["new-booking", "quotes", "quote-details", "quote-edit"];

/** Base del stack de vuelos del rol activo. */
function flightsBase(role: Role | null | undefined): string | null {
    if (role === "OWNER") return "/(owner)/flights";
    if (role === "PILOT") return "/(pilot)/flights";
    return null;
}

/** Ruta a una pantalla del stack de vuelos del rol activo (null si el rol no la tiene). */
export function roleFlightRoute(
    role: Role | null | undefined,
    screen: RoleFlightScreen,
    params?: Record<string, string>
): RoleRoute | null {
    if (role === "ADMIN" && ADMIN_SCREENS.includes(screen)) {
        return { pathname: `/(admin)/${screen}`, params };
    }
    const base = flightsBase(role);
    if (!base) return null;
    return { pathname: `${base}/${screen}`, params };
}

/**
 * Las rutas se arman en tiempo de ejecución; con typedRoutes el tipo Href es una unión enorme,
 * así que se castea una sola vez acá.
 */
export function toHref(route: RoleRoute): Href {
    return (route.params ? route : route.pathname) as unknown as Href;
}

/** Pantalla de inicio del rol activo. */
export function roleHomeRoute(role: Role | null | undefined): Href {
    if (role === "ADMIN") return "/(admin)" as Href;
    if (role === "OWNER") return "/(owner)/flights" as Href;
    if (role === "PILOT") return "/(pilot)/flights" as Href;
    return "/(client)" as Href;
}
