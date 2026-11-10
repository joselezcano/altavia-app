/**
 * Tests de reglas de Firestore (firestore.rules) contra el emulador.
 *
 *   cd tests/firestore-rules && npm install && npm test
 *
 * Cada caso refleja una operación real que hace la app (o un abuso que debe bloquearse).
 */
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
    addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");

let env;

const UIDS = {
    admin: "admin1",
    owner: "owner1",
    otherOwner: "owner2",
    encargada: "encargada1",
    pilot: "pilot1",
    client: "client1",
    otherClient: "client2",
};

before(async () => {
    env = await initializeTestEnvironment({
        projectId: "demo-altavia",
        firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host, port: Number(port) },
    });
});

after(async () => {
    await env.cleanup();
});

beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        const users = {
            [UIDS.admin]: ["ADMIN"],
            [UIDS.owner]: ["OWNER"],
            [UIDS.otherOwner]: ["OWNER"],
            [UIDS.encargada]: ["PILOT"],
            [UIDS.pilot]: ["PILOT"],
            [UIDS.client]: ["CLIENT"],
            [UIDS.otherClient]: ["CLIENT"],
        };
        for (const [uid, roles] of Object.entries(users)) {
            await setDoc(doc(db, "users", uid), { uid, roles, email: `${uid}@test.com`, kycVerified: false });
        }
        await setDoc(doc(db, "pilots", UIDS.encargada), { isEncargado: true, managed_aircrafts: ["ac1"], owner_ids: [UIDS.owner] });
        await setDoc(doc(db, "pilots", UIDS.pilot), { isEncargado: false, managed_aircrafts: [], owner_ids: [UIDS.owner] });
        await setDoc(doc(db, "AircraftSpecs", "ac1"), { ownerId: UIDS.owner, basic_specs: { registration: "ZP-BOC" } });
        await setDoc(doc(db, "AircraftSpecs", "ac2"), { ownerId: UIDS.otherOwner, basic_specs: { registration: "ZP-XXX" } });
        await setDoc(doc(db, "pilots", "pilotOther"), { isEncargado: false, managed_aircrafts: [], pilot_aircrafts: [], owner_ids: [UIDS.otherOwner] });
        await setDoc(doc(db, "aircraft-reservation", "res1"), {
            aircraftId: "ac1", clientId: UIDS.client, price: 2000,
            client_status: "unpaid", internal_status: "awaiting_payment", pilot_ids: [UIDS.encargada],
        });
        // Vuelo pagado y confirmado, con el piloto común asignado.
        await setDoc(doc(db, "aircraft-reservation", "res2"), {
            aircraftId: "ac1", clientId: UIDS.client, price: 2000, paid_at: new Date(),
            client_status: "confirmed", internal_status: "confirmed", pilot_ids: [UIDS.pilot],
        });
        // Reserva de una aeronave de otro propietario.
        await setDoc(doc(db, "aircraft-reservation", "res3"), {
            aircraftId: "ac2", clientId: UIDS.otherClient, price: 900,
            client_status: "unpaid", internal_status: "awaiting_payment", pilot_ids: [],
        });
        await setDoc(doc(db, "aircraft-availability", "ev2"), { aircraftId: "ac2", reason: "maintenance" });
        await setDoc(doc(db, "owner_operational_flights", "f2"), { ownerId: UIDS.otherOwner, aircraftId: "ac2" });
        await setDoc(doc(db, "Contadores", "cambioDelDia"), { dolar: 6180 });
        await setDoc(doc(db, "owner_operational_flights", "f1"), { ownerId: UIDS.owner, aircraftId: "ac1" });
    });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const newReservation = (clientId) => ({
    aircraftId: "ac1", clientId, price: 1500, client_status: "unpaid", internal_status: "pending_approval", pilot_ids: [],
});

describe("Sin sesión", () => {
    test("no puede leer nada", async () => {
        await assertFails(getDoc(doc(anon(), "aircraft-reservation", "res1")));
        await assertFails(getDoc(doc(anon(), "users", UIDS.client)));
        await assertFails(getDoc(doc(anon(), "AircraftSpecs", "ac1")));
    });
});

describe("users", () => {
    test("el usuario no puede darse roles", async () => {
        await assertFails(updateDoc(doc(as(UIDS.client), "users", UIDS.client), { roles: ["CLIENT", "ADMIN"] }));
    });
    test("el usuario no puede marcarse KYC verificado", async () => {
        await assertFails(updateDoc(doc(as(UIDS.client), "users", UIDS.client), { kycVerified: true }));
    });
    test("el usuario puede aceptar TyC y soft-delete", async () => {
        await assertSucceeds(updateDoc(doc(as(UIDS.client), "users", UIDS.client), { acceptedTermsVersion: "1.0" }));
        await assertSucceeds(updateDoc(doc(as(UIDS.client), "users", UIDS.client), { deleted: true, firstName: "Usuario" }));
    });
    test("onboarding: alta propia solo como CLIENT", async () => {
        await assertSucceeds(setDoc(doc(as("nuevo"), "users", "nuevo"), { uid: "nuevo", roles: ["CLIENT"] }, { merge: true }));
        await assertFails(setDoc(doc(as("nuevo2"), "users", "nuevo2"), { uid: "nuevo2", roles: ["OWNER"] }));
        await assertFails(setDoc(doc(as("nuevo3"), "users", "nuevo3"), { roles: ["CLIENT"], kycVerified: true }));
    });
    test("onboarding repetido con roles iguales funciona (merge)", async () => {
        await assertSucceeds(setDoc(doc(as(UIDS.client), "users", UIDS.client), { roles: ["CLIENT"], phone: "0981" }, { merge: true }));
    });
    test("un cliente no puede leer a otro cliente", async () => {
        await assertFails(getDoc(doc(as(UIDS.client), "users", UIDS.otherClient)));
    });
    test("la encargada da de alta clientes (alta rápida) y les agrega rol CLIENT", async () => {
        const db = as(UIDS.encargada);
        await assertSucceeds(setDoc(doc(db, "users", "telefonico1"), { roles: ["CLIENT"], firstName: "Juan" }));
        await assertSucceeds(setDoc(doc(db, "users", UIDS.pilot), { roles: ["PILOT", "CLIENT"] }, { merge: true }));
        await assertFails(setDoc(doc(db, "users", UIDS.pilot), { roles: ["PILOT", "CLIENT", "ADMIN"] }, { merge: true }));
        await assertSucceeds(setDoc(doc(db, "clients", "telefonico1"), { uid: "telefonico1" }, { merge: true }));
    });
    test("un piloto común no puede crear clientes", async () => {
        await assertFails(setDoc(doc(as(UIDS.pilot), "users", "x"), { roles: ["CLIENT"] }));
    });
});

describe("pilots", () => {
    test("el piloto no puede hacerse encargado", async () => {
        await assertFails(updateDoc(doc(as(UIDS.pilot), "pilots", UIDS.pilot), { isEncargado: true }));
    });
    test("el owner vincula pilotos a su flota", async () => {
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "pilots", UIDS.pilot), { owner_ids: arrayUnion(UIDS.owner) }));
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "pilots", "pilotOther"), { owner_ids: arrayUnion(UIDS.owner) }));
    });
    test("el owner nombra encargado y asigna aviones a SUS pilotos", async () => {
        const db = as(UIDS.owner);
        await assertSucceeds(updateDoc(doc(db, "pilots", UIDS.pilot), { isEncargado: true, managed_aircrafts: ["ac1"] }));
        await assertSucceeds(updateDoc(doc(db, "pilots", UIDS.encargada), {
            owner_ids: arrayRemove(UIDS.owner), isEncargado: false, managed_aircrafts: [],
        }));
    });
    test("el owner no toca pilotos ajenos ni vínculos de otros owners", async () => {
        const db = as(UIDS.owner);
        await assertFails(updateDoc(doc(db, "pilots", "pilotOther"), { isEncargado: true }));
        await assertFails(updateDoc(doc(db, "pilots", UIDS.pilot), { owner_ids: [UIDS.owner, UIDS.otherOwner] }));
    });
    test("la encargada asigna pilotos solo a las aeronaves que gestiona", async () => {
        const db = as(UIDS.encargada);
        await assertSucceeds(updateDoc(doc(db, "pilots", UIDS.pilot), { pilot_aircrafts: arrayUnion("ac1") }));
        await assertFails(updateDoc(doc(db, "pilots", UIDS.pilot), { pilot_aircrafts: arrayUnion("ac2") }));
        await assertFails(updateDoc(doc(db, "pilots", UIDS.pilot), { isEncargado: true }));
        await assertFails(updateDoc(doc(db, "pilots", UIDS.encargada), { managed_aircrafts: ["ac1", "ac2"] }));
    });
    test("el piloto puede desvincularse, pero no darse permisos", async () => {
        const db = as(UIDS.encargada);
        await assertFails(updateDoc(doc(db, "pilots", UIDS.encargada), { owner_ids: [UIDS.owner, UIDS.otherOwner] }));
        await assertSucceeds(updateDoc(doc(db, "pilots", UIDS.encargada), {
            owner_ids: [], isEncargado: false, managed_aircrafts: [],
        }));
    });
});

describe("aircraft-reservation", () => {
    test("el cliente crea su reserva pendiente", async () => {
        await assertSucceeds(addDoc(collection(as(UIDS.client), "aircraft-reservation"), newReservation(UIDS.client)));
    });
    test("el cliente no puede crear una reserva ya pagada", async () => {
        await assertFails(addDoc(collection(as(UIDS.client), "aircraft-reservation"), {
            ...newReservation(UIDS.client), client_status: "confirmed",
        }));
        await assertFails(addDoc(collection(as(UIDS.client), "aircraft-reservation"), {
            ...newReservation(UIDS.client), paid_at: new Date(),
        }));
    });
    test("el cliente no puede crear reservas a nombre de otro", async () => {
        await assertFails(addDoc(collection(as(UIDS.client), "aircraft-reservation"), newReservation(UIDS.otherClient)));
    });
    test("la encargada crea reservas telefónicas para un cliente", async () => {
        await assertSucceeds(addDoc(collection(as(UIDS.encargada), "aircraft-reservation"), newReservation(UIDS.otherClient)));
    });
    test("el owner da de alta clientes y crea reservas solo para SUS aeronaves", async () => {
        const db = as(UIDS.owner);
        await assertSucceeds(setDoc(doc(db, "users", "telefonico2"), { roles: ["CLIENT"], firstName: "Ana" }));
        await assertSucceeds(setDoc(doc(db, "clients", "telefonico2"), { uid: "telefonico2" }, { merge: true }));
        await assertSucceeds(addDoc(collection(db, "aircraft-availability"), { aircraftId: "ac1", reason: "flight" }));
        await assertSucceeds(addDoc(collection(db, "aircraft-reservation"), newReservation("telefonico2")));
        await assertFails(addDoc(collection(db, "aircraft-reservation"), { ...newReservation("telefonico2"), aircraftId: "ac2" }));
    });
    test("EL CLIENTE NO PUEDE MARCAR SU VUELO COMO PAGADO", async () => {
        const ref = doc(as(UIDS.client), "aircraft-reservation", "res1");
        await assertFails(updateDoc(ref, { client_status: "confirmed", internal_status: "confirmed" }));
        await assertFails(updateDoc(ref, { paid_at: new Date() }));
        await assertFails(updateDoc(ref, { invoice_number: "001-001-0001" }));
    });
    test("el staff tampoco puede escribir campos de pago", async () => {
        const ref = doc(as(UIDS.owner), "aircraft-reservation", "res1");
        await assertFails(updateDoc(ref, { client_status: "confirmed" }));
        await assertFails(updateDoc(ref, { payment_transaction_id: "x" }));
    });
    test("el cliente carga el manifiesto y puede cancelar", async () => {
        const ref = doc(as(UIDS.client), "aircraft-reservation", "res1");
        await assertSucceeds(updateDoc(ref, { passengers: [{ id: "p1", fullName: "Ana" }] }));
        await assertSucceeds(updateDoc(ref, { client_status: "canceled" }));
    });
    test("el cliente no puede cambiar el precio", async () => {
        await assertFails(updateDoc(doc(as(UIDS.client), "aircraft-reservation", "res1"), { price: 1 }));
    });
    test("owner y encargada de la aeronave operan la reserva (precio, pilotos, estado)", async () => {
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "aircraft-reservation", "res1"), { price: 2500, internal_status: "awaiting_payment" }));
        await assertSucceeds(updateDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res1"), { pilot_ids: [UIDS.encargada] }));
    });
    test("owner y encargada no operan reservas de aeronaves ajenas", async () => {
        await assertFails(updateDoc(doc(as(UIDS.owner), "aircraft-reservation", "res3"), { price: 1 }));
        await assertFails(updateDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res3"), { internal_status: "canceled" }));
        await assertFails(addDoc(collection(as(UIDS.encargada), "aircraft-reservation"), {
            ...newReservation(UIDS.otherClient), aircraftId: "ac2",
        }));
    });
    test("el piloto asignado mueve estados operativos y carga el manifiesto", async () => {
        const ref = doc(as(UIDS.pilot), "aircraft-reservation", "res2");
        await assertSucceeds(updateDoc(ref, { internal_status: "in_flight" }));
        await assertSucceeds(updateDoc(ref, { passengers: [{ id: "p1", fullName: "Ana" }] }));
    });
    test("el piloto no toca precio, aprobación ni vuelos donde no está asignado", async () => {
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), { price: 1 }));
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), { pilot_ids: [] }));
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), { internal_status: "awaiting_payment" }));
        // res1 no está pagada (awaiting_payment) y además no está asignado.
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res1"), { internal_status: "confirmed" }));
    });
    test("el piloto asignado, el owner y la encargada cargan el ID de FlightAware", async () => {
        await assertSucceeds(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), { fa_flight_id: "ZPBOC-1762430000-adhoc-0123" }));
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "aircraft-reservation", "res2"), { fa_flight_id: "ZPBOC-1762430000-adhoc-0124" }));
        await assertSucceeds(updateDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res2"), { fa_flight_id: null }));
    });
    test("el ID de FlightAware no lo carga un piloto no asignado ni el cliente, ni sirve para colar otros campos", async () => {
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res1"), { fa_flight_id: "X-1" }));
        await assertFails(updateDoc(doc(as(UIDS.client), "aircraft-reservation", "res2"), { fa_flight_id: "X-1" }));
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), { fa_flight_id: "X-1", price: 1 }));
    });
    test("editar reserva: owner y encargada reprograman y re-sincronizan bloqueos", async () => {
        const schedule = {
            roundtrip: false,
            outbound_flight_departure_time: new Date("2026-12-01T12:00:00Z"),
            outbound_flight_arrival_time: new Date("2026-12-01T13:30:00Z"),
            return_flight_departure_time: null,
            return_flight_arrival_time: null,
        };
        // Reserva sin pagar: ruta, precio y cotización.
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "aircraft-reservation", "res1"), {
            schedule, event_ids: ["evNuevo"], price: 2100, estimated_price: 2100, billable_hours: 3.4,
            trip: { origin_airport_ident: "SGAS", origin_timezone: "", destination_airport_ident: "SGES", destination_timezone: "" },
            capacity: { passangers: 3 },
        }));
        // Reserva pagada: solo reprogramar (los campos de pago siguen bloqueados).
        await assertSucceeds(updateDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res2"), { schedule, event_ids: ["evNuevo2"] }));
        await assertFails(updateDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res2"), { schedule, paid_at: new Date() }));
        // El piloto asignado no reprograma.
        await assertFails(updateDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res2"), {
            schedule: { ...schedule, outbound_flight_departure_time: new Date("2026-12-02T12:00:00Z") },
        }));
    });
    test("eliminar reserva sin pagar: primero los bloqueos, después la reserva", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "aircraft-availability", "ev1"), { aircraftId: "ac1", reason: "flight" });
        });
        await assertSucceeds(deleteDoc(doc(as(UIDS.owner), "aircraft-availability", "ev1")));
        await assertSucceeds(deleteDoc(doc(as(UIDS.owner), "aircraft-reservation", "res1")));
    });
    test("eliminar: solo reservas sin pagar y solo quien gestiona la aeronave", async () => {
        await assertFails(deleteDoc(doc(as(UIDS.owner), "aircraft-reservation", "res2")));
        await assertFails(deleteDoc(doc(as(UIDS.pilot), "aircraft-reservation", "res1")));
        await assertFails(deleteDoc(doc(as(UIDS.client), "aircraft-reservation", "res1")));
        await assertSucceeds(deleteDoc(doc(as(UIDS.encargada), "aircraft-reservation", "res1")));
    });
    test("el cliente lee sus reservas pero no las de otros", async () => {
        await assertSucceeds(getDocs(query(collection(as(UIDS.client), "aircraft-reservation"), where("clientId", "==", UIDS.client))));
        await assertFails(getDoc(doc(as(UIDS.otherClient), "aircraft-reservation", "res1")));
        await assertFails(getDocs(query(collection(as(UIDS.client), "aircraft-reservation"), where("aircraftId", "==", "ac1"))));
    });
    test("el staff lee todas las reservas", async () => {
        await assertSucceeds(getDocs(collection(as(UIDS.owner), "aircraft-reservation")));
    });
});

describe("aircraft-availability", () => {
    test("el cliente bloquea el horario de su vuelo pero no otros motivos", async () => {
        const db = as(UIDS.client);
        await assertSucceeds(addDoc(collection(db, "aircraft-availability"), { aircraftId: "ac1", reason: "flight" }));
        await assertFails(addDoc(collection(db, "aircraft-availability"), { aircraftId: "ac1", reason: "maintenance" }));
    });
    test("el staff solo edita bloqueos de aeronaves que gestiona", async () => {
        await assertSucceeds(addDoc(collection(as(UIDS.encargada), "aircraft-availability"), { aircraftId: "ac1", reason: "maintenance" }));
        await assertFails(addDoc(collection(as(UIDS.encargada), "aircraft-availability"), { aircraftId: "ac2", reason: "maintenance" }));
        await assertFails(deleteDoc(doc(as(UIDS.owner), "aircraft-availability", "ev2")));
        await assertFails(addDoc(collection(as(UIDS.pilot), "aircraft-availability"), { aircraftId: "ac1", reason: "maintenance" }));
    });
    test("el cliente consulta bloqueos (buscador)", async () => {
        await assertSucceeds(getDocs(query(collection(as(UIDS.client), "aircraft-availability"), where("aircraftId", "==", "ac1"))));
    });
});

describe("pagos y servidor", () => {
    test("nadie lee ni escribe bancard-transactions desde la app", async () => {
        await assertFails(getDoc(doc(as(UIDS.admin), "bancard-transactions", "1")));
        await assertFails(setDoc(doc(as(UIDS.admin), "bancard-transactions", "1"), { status: "approved" }));
    });
    test("nadie lee ni crea payment-links desde la app", async () => {
        await assertFails(getDoc(doc(as(UIDS.admin), "payment-links", "abc")));
        await assertFails(setDoc(doc(as(UIDS.encargada), "payment-links", "abc"), { reservationId: "res1" }));
    });
    test("tipo de cambio: lectura sí, escritura no", async () => {
        await assertSucceeds(getDoc(doc(as(UIDS.client), "Contadores", "cambioDelDia")));
        await assertFails(setDoc(doc(as(UIDS.admin), "Contadores", "cambioDelDia"), { dolar: 1 }));
    });
});

describe("legal_logs", () => {
    test("solo se crean, propios, e inmutables", async () => {
        const db = as(UIDS.client);
        const ref = await assertSucceeds(addDoc(collection(db, "legal_logs"), { userId: UIDS.client, contractVersion: "1.0" }));
        await assertFails(addDoc(collection(db, "legal_logs"), { userId: UIDS.otherClient }));
        await assertFails(updateDoc(doc(db, "legal_logs", ref.id), { contractVersion: "2.0" }));
        await assertFails(deleteDoc(doc(as(UIDS.admin), "legal_logs", ref.id)));
    });
});

describe("AircraftSpecs", () => {
    test("todos leen; solo admin cambia la tarifa; owner ajeno no edita", async () => {
        await assertSucceeds(getDoc(doc(as(UIDS.client), "AircraftSpecs", "ac1")));
        await assertSucceeds(updateDoc(doc(as(UIDS.owner), "AircraftSpecs", "ac1"), { base_airport: "SGAS" }));
        await assertFails(updateDoc(doc(as(UIDS.owner), "AircraftSpecs", "ac1"), { pricePerMileOverride: 1 }));
        await assertSucceeds(updateDoc(doc(as(UIDS.admin), "AircraftSpecs", "ac1"), { pricePerMileOverride: 4 }));
        await assertFails(updateDoc(doc(as(UIDS.otherOwner), "AircraftSpecs", "ac1"), { base_airport: "SGES" }));
        await assertFails(updateDoc(doc(as(UIDS.client), "AircraftSpecs", "ac1"), { base_airport: "SGES" }));
    });
    test("el owner registra aeronaves propias, no ajenas", async () => {
        await assertSucceeds(addDoc(collection(as(UIDS.owner), "AircraftSpecs"), { ownerId: UIDS.owner }));
        await assertFails(addDoc(collection(as(UIDS.owner), "AircraftSpecs"), { ownerId: UIDS.otherOwner }));
    });
    test("la encargada edita y da de alta solo para su propietario", async () => {
        const db = as(UIDS.encargada);
        await assertSucceeds(updateDoc(doc(db, "AircraftSpecs", "ac1"), { base_airport: "SGAS" }));
        await assertFails(updateDoc(doc(db, "AircraftSpecs", "ac2"), { base_airport: "SGAS" }));
        await assertSucceeds(addDoc(collection(db, "AircraftSpecs"), { ownerId: UIDS.owner }));
        await assertSucceeds(addDoc(collection(db, "AircraftSpecs"), { ownerId: UIDS.owner, createdBy: UIDS.encargada }));
        // No puede hacerse pasar por otra persona en createdBy.
        await assertFails(addDoc(collection(db, "AircraftSpecs"), { ownerId: UIDS.owner, createdBy: UIDS.pilot }));
        await assertFails(addDoc(collection(db, "AircraftSpecs"), { ownerId: UIDS.otherOwner }));
        await assertFails(updateDoc(doc(as(UIDS.pilot), "AircraftSpecs", "ac1"), { base_airport: "SGES" }));
    });
    test("la tarifa publicada (pricing) no se escribe desde la app", async () => {
        await assertFails(updateDoc(doc(as(UIDS.owner), "AircraftSpecs", "ac1"), { pricing: { pricePerHourUsd: 1 } }));
        await assertFails(updateDoc(doc(as(UIDS.encargada), "AircraftSpecs", "ac1"), { pricing: { pricePerHourUsd: 1 } }));
    });
});

describe("Control operativo / GIO (OWNER + encargada)", () => {
    test("el owner gestiona lo suyo", async () => {
        const db = as(UIDS.owner);
        await assertSucceeds(getDocs(query(collection(db, "owner_operational_flights"), where("ownerId", "==", UIDS.owner))));
        await assertSucceeds(setDoc(doc(db, "owner_aircraft_operations_config", `${UIDS.owner}_ac1`), { ownerId: UIDS.owner, aircraftId: "ac1", tc: 6000 }, { merge: true }));
        await assertSucceeds(getDoc(doc(db, "owner_aircraft_operations_config", `${UIDS.owner}_ac1`)));
    });
    test("la encargada usa GIO de la aeronave que gestiona", async () => {
        const db = as(UIDS.encargada);
        await assertSucceeds(getDocs(query(collection(db, "owner_operational_flights"),
            where("ownerId", "==", UIDS.owner), where("aircraftId", "==", "ac1"))));
        await assertSucceeds(getDoc(doc(db, "owner_aircraft_operations_config", `${UIDS.owner}_ac1`)));
        await assertSucceeds(setDoc(doc(db, "owner_aircraft_operations_config", `${UIDS.owner}_ac1`), { ownerId: UIDS.owner, aircraftId: "ac1", tc: 6100 }, { merge: true }));
        await assertSucceeds(addDoc(collection(db, "owner_operational_flights"), { ownerId: UIDS.owner, aircraftId: "ac1", horas: 1.8 }));
        await assertSucceeds(addDoc(collection(db, "owner_operational_expenses"), { ownerId: UIDS.owner, aircraftId: "ac1", monto: 100 }));
    });
    test("la encargada no ve GIO de otras aeronaves ni consultas sin filtrar", async () => {
        const db = as(UIDS.encargada);
        await assertFails(getDocs(query(collection(db, "owner_operational_flights"), where("ownerId", "==", UIDS.owner))));
        await assertFails(getDoc(doc(db, "owner_operational_flights", "f2")));
        await assertFails(addDoc(collection(db, "owner_operational_flights"), { ownerId: UIDS.otherOwner, aircraftId: "ac2" }));
        // Registro con ownerId que no es el dueño real de la aeronave.
        await assertFails(addDoc(collection(db, "owner_operational_flights"), { ownerId: UIDS.otherOwner, aircraftId: "ac1" }));
    });
    test("pilotos comunes y otros owners no acceden", async () => {
        await assertFails(getDocs(query(collection(as(UIDS.pilot), "owner_operational_flights"),
            where("ownerId", "==", UIDS.owner), where("aircraftId", "==", "ac1"))));
        await assertFails(getDoc(doc(as(UIDS.otherOwner), "owner_operational_flights", "f1")));
        await assertFails(getDoc(doc(as(UIDS.otherOwner), "owner_aircraft_operations_config", `${UIDS.owner}_ac1`)));
    });
});

describe("notifications", () => {
    test("la encargada notifica; el cliente solo lee/marca las suyas", async () => {
        const ref = await assertSucceeds(addDoc(collection(as(UIDS.encargada), "notifications"), { userId: UIDS.client, read: false }));
        await assertSucceeds(updateDoc(doc(as(UIDS.client), "notifications", ref.id), { read: true }));
        await assertFails(getDoc(doc(as(UIDS.otherClient), "notifications", ref.id)));
        await assertFails(addDoc(collection(as(UIDS.client), "notifications"), { userId: UIDS.client }));
    });
});

describe("catálogos", () => {
    test("airports / templates / model-pricing: lectura todos, escritura admin", async () => {
        await assertSucceeds(getDocs(collection(as(UIDS.client), "airports")));
        await assertFails(setDoc(doc(as(UIDS.owner), "airports", "SGAS"), { ident: "SGAS" }));
        await assertSucceeds(setDoc(doc(as(UIDS.admin), "model-pricing", "C414"), { model: "C414", defaultPricePerMile: 5 }));
    });
});

describe("Facturación y plan de negocio (ADMIN)", () => {
    const plan = { aircraftId: "ac1", ownerId: UIDS.owner, horasHoyMin: 7, horasHoyMax: 10 };

    test("el admin lee y escribe el plan de negocio de una aeronave", async () => {
        const db = as(UIDS.admin);
        await assertSucceeds(setDoc(doc(db, "business-plans", "ac1"), plan));
        await assertSucceeds(getDoc(doc(db, "business-plans", "ac1")));
        await assertSucceeds(updateDoc(doc(db, "business-plans", "ac1"), { horasHoyMax: 12 }));
        await assertSucceeds(getDocs(collection(db, "business-plans")));
    });
    test("el plan debe llevar el aircraftId del documento", async () => {
        await assertFails(setDoc(doc(as(UIDS.admin), "business-plans", "ac1"), { ...plan, aircraftId: "ac2" }));
    });
    test("nadie más que el admin accede al plan de negocio", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "business-plans", "ac1"), plan);
        });
        for (const uid of [UIDS.owner, UIDS.encargada, UIDS.pilot, UIDS.client]) {
            await assertFails(getDoc(doc(as(uid), "business-plans", "ac1")));
            await assertFails(setDoc(doc(as(uid), "business-plans", "ac1"), plan));
        }
        await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "business-plans", "ac1")));
    });
    test("el admin lista las reservas pagadas para Facturación", async () => {
        await assertSucceeds(getDocs(query(collection(as(UIDS.admin), "aircraft-reservation"), where("client_status", "==", "confirmed"))));
        await assertFails(getDocs(query(collection(as(UIDS.client), "aircraft-reservation"), where("client_status", "==", "confirmed"))));
    });
    test("el admin lee GIO filtrando por el dueño real y la aeronave", async () => {
        const db = as(UIDS.admin);
        await assertSucceeds(getDocs(query(collection(db, "owner_operational_flights"),
            where("ownerId", "==", UIDS.owner), where("aircraftId", "==", "ac1"))));
        await assertSucceeds(getDocs(query(collection(db, "owner_operational_expenses"),
            where("ownerId", "==", UIDS.owner), where("aircraftId", "==", "ac1"))));
        await assertSucceeds(getDoc(doc(db, "owner_aircraft_operations_config", `${UIDS.owner}_ac1`)));
        // ownerId que no es el dueño de la aeronave: denegado.
        await assertFails(getDocs(query(collection(db, "owner_operational_flights"),
            where("ownerId", "==", UIDS.otherOwner), where("aircraftId", "==", "ac1"))));
    });
});

describe("Presupuestos (quotes)", () => {
    const quote = (over = {}) => ({
        aircraftId: "ac1", ownerId: UIDS.owner, createdBy: UIDS.encargada, status: "draft",
        clientName: "Ana", subtotalUsd: 1800, totalUsd: 1980, lines: [], costs: [], ...over,
    });
    test("la encargada de la aeronave crea, edita y lista presupuestos", async () => {
        const db = as(UIDS.encargada);
        const ref = await assertSucceeds(addDoc(collection(db, "quotes"), quote()));
        await assertSucceeds(updateDoc(doc(db, "quotes", ref.id), { status: "accepted", subtotalUsd: 1700 }));
        await assertSucceeds(getDocs(query(collection(db, "quotes"), where("aircraftId", "==", "ac1"))));
    });
    test("el owner lista los de sus aeronaves por ownerId", async () => {
        await assertSucceeds(addDoc(collection(as(UIDS.owner), "quotes"), quote({ createdBy: UIDS.owner })));
        await assertSucceeds(getDocs(query(collection(as(UIDS.owner), "quotes"), where("ownerId", "==", UIDS.owner))));
        await assertFails(getDocs(query(collection(as(UIDS.otherOwner), "quotes"), where("ownerId", "==", UIDS.owner))));
    });
    test("no se crean con dueño falso, para otra aeronave o a nombre de otro", async () => {
        const db = as(UIDS.encargada);
        await assertFails(addDoc(collection(db, "quotes"), quote({ ownerId: UIDS.otherOwner })));
        await assertFails(addDoc(collection(db, "quotes"), quote({ aircraftId: "ac2", ownerId: UIDS.otherOwner })));
        await assertFails(addDoc(collection(db, "quotes"), quote({ createdBy: UIDS.owner })));
        await assertFails(addDoc(collection(db, "quotes"), quote({ status: "accepted" })));
    });
    test("pilotos comunes y clientes no acceden; no se mueve de aeronave", async () => {
        let id;
        await env.withSecurityRulesDisabled(async (ctx) => {
            id = (await addDoc(collection(ctx.firestore(), "quotes"), quote())).id;
        });
        await assertFails(getDoc(doc(as(UIDS.pilot), "quotes", id)));
        await assertFails(getDoc(doc(as(UIDS.client), "quotes", id)));
        await assertFails(updateDoc(doc(as(UIDS.encargada), "quotes", id), { aircraftId: "ac2" }));
    });
    test("uno convertido en reserva no se borra; los links son solo del servidor", async () => {
        let id;
        await env.withSecurityRulesDisabled(async (ctx) => {
            id = (await addDoc(collection(ctx.firestore(), "quotes"), quote({ status: "converted" }))).id;
        });
        await assertFails(deleteDoc(doc(as(UIDS.owner), "quotes", id)));
        await assertFails(getDoc(doc(as(UIDS.admin), "quote-links", "x")));
    });
});
