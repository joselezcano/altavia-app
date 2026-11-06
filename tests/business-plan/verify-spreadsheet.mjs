/**
 * Verificación de src/utils/business-plan.ts contra la planilla
 * "Rentabilidad_Cessna414_ZP-BOC.xlsx" (valores de las celdas calculadas por Excel).
 *
 *   node tests/business-plan/verify-spreadsheet.mjs
 *
 * Transpila los .ts con typescript.transpileModule (sin build) y reemplaza los módulos
 * nativos (expo-print, expo-sharing, react-native) que importa aircraft-operations-calc.
 *
 * Con los MISMOS supuestos de la planilla (tc 6000, overhaul FIJO de 1080/mes, tarifas sin
 * IVA → ivaPct 0, sin comisión ni IRE) los números deben coincidir con las hojas. Después
 * muestra el modo corregido de la app (overhaul por hora, IVA incluido, comisión e IRE).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");

const STUBS = {
    "expo-print": { printAsync: async () => {}, printToFileAsync: async () => ({ uri: "" }) },
    "expo-sharing": { isAvailableAsync: async () => false, shareAsync: async () => {} },
    "react-native": { Platform: { OS: "node" } },
};

const cache = new Map();

function resolveTs(base) {
    for (const cand of [`${base}.ts`, `${base}.tsx`, base, path.join(base, "index.ts")]) {
        if (existsSync(cand) && statSync(cand).isFile()) return cand;
    }
    throw new Error(`No se encontró el módulo ${base}`);
}

function loadTs(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = readFileSync(file, "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
            jsx: ts.JsxEmit.ReactJSX,
        },
        fileName: file,
    });
    const mod = { exports: {} };
    cache.set(file, mod);
    const localRequire = (spec) => {
        if (spec in STUBS) return STUBS[spec];
        if (spec.startsWith("@/")) return loadTs(resolveTs(path.join(SRC, spec.slice(2))));
        if (spec.startsWith(".")) return loadTs(resolveTs(path.resolve(path.dirname(file), spec)));
        return require(spec);
    };
    new Function("require", "module", "exports", outputText)(localRequire, mod, mod.exports);
    return mod.exports;
}

const bp = loadTs(path.join(SRC, "utils/business-plan.ts"));
const ops = loadTs(path.join(SRC, "utils/aircraft-operations-calc.ts"));

// ------------------------------------------------ supuestos de la planilla (hoja Supuestos)
const cfg = {
    ...ops.createDefaultOperationsConfig("owner-test", "zp-boc", "ZP-BOC", "Cessna 414"),
    tc: 6000, // C7
    consumoLt: 151, // C26
    precioLtGs: 14200, // C27
    pilotajeHora: 120, // C30
    planBaseGs: 180000, // C31
    planPersonaGs: 20000, // C32
    tarifaHora: 1000, // C39 (sin IVA en la planilla)
    reservaHora: 119, // GIO (solo se usa en el modo corregido)
    fijos: [
        { id: "fix-hangar", n: "Hangaraje", m: 550, c: "USD" }, // C11
        { id: "fix-admin", n: "Administración", m: 2200000, c: "GS" }, // C15
        { id: "fix-subs", n: "Suscripciones", m: 100, c: "USD" }, // C16
        { id: "fix-ins", n: "Seguro", m: 0, c: "USD" }, // lo reemplaza el plan
        { id: "fix-hab", n: "Habilitaciones (anual / 12)", m: 133, c: "USD" }, // lo reemplaza el plan
    ],
};

const plan = {
    ...bp.createDefaultBusinessPlan("zp-boc", "owner-test", "ZP-BOC", "Cessna 414"),
    ivaPct: 0, // la planilla trabaja con tarifas sin IVA
    descontarBancard: false,
    descontarIre: false,
};
const toggles = { descontarBancard: false, descontarIre: false };
const base = bp.buildPlanCostBase(plan, cfg, { overhaul: { modo: "fijo_mensual", usdMes: 1080 } }); // C17

// ------------------------------------------------------------- comparación
const TOL = 1e-6;
let ok = 0;
let fail = 0;
const rows = [];
function check(hoja, celda, concepto, actual, esperado) {
    const pass =
        (actual === null && esperado === null) ||
        (actual !== null && esperado !== null && Math.abs(actual - esperado) <= TOL * Math.max(1, Math.abs(esperado)));
    pass ? ok++ : fail++;
    rows.push({ hoja, celda, concepto, planilla: esperado, app: actual, ok: pass ? "OK" : "DIFERENTE" });
}

// Gastos Variables
check("Gastos Variables", "D6", "Combustible USD/h", base.variableHora.combustible, 357.366666666667);
check("Gastos Variables", "D7", "Aceite USD/h", base.variableHora.aceite, 1.5);
check("Gastos Variables", "D8", "Imprevistos USD/h", base.variableHora.imprevistos, 25);
check("Gastos Variables", "D9", "Piloto USD/h", base.variableHora.piloto, 120);
check("Gastos Variables", "D10", "Tasas USD/h", base.variableHora.tasas, 59.2592592592593);
check("Gastos Variables", "D11", "Total variable USD/h", base.variableHora.total, 563.125925925926);

// Gastos Fijos
check("Gastos Fijos", "D7", "Seguro sin CESA /mes", base.seguroMesSinCesa, 302.333333333333);
check("Gastos Fijos", "E7", "Seguro con CESA /mes", base.seguroMesConCesa, 1208.33333333333);
check("Gastos Fijos", "D11", "Subtotal fijo sin CESA", bp.getFijosMes(base, false), 1985.66666666667);
check("Gastos Fijos", "E11", "Subtotal fijo con CESA", bp.getFijosMes(base, true), 2891.66666666667);
check("Gastos Fijos", "D13", "Total fijo operativo sin CESA", bp.getFijosMes(base, false) + 1080, 3065.66666666667);
check("Gastos Fijos", "E13", "Total fijo operativo con CESA", bp.getFijosMes(base, true) + 1080, 3971.66666666667);

// Escenarios (las columnas F e I "contado" duplicaban D y H: se eliminaron)
const esc = bp.computeScenarioTable(base, plan, bp.getTarifaHoy(cfg), toggles);
const ESPERADO_ESC = {
    // id: [col, horas, tarifa, ingreso, varMes, overhaul, overhaulHora, fijo, costoTotal, resultado, margenVuelo, equilibrio]
    hoy_min: ["C", 7, 1000, 7000, 3941.88148148148, 1080, 154.285714285714, 1985.66666666667, 7007.54814814815, -7.54814814814745, 508.659047619048, 7.01727762894639],
    hoy_prom: ["D", 8.5, 1000, 8500, 4786.57037037037, 1080, 127.058823529412, 1985.66666666667, 7852.23703703704, 647.762962962963, 557.667450980392, 7.01727762894639],
    hoy_max: ["E", 10, 1000, 10000, 5631.25925925926, 1080, 108, 1985.66666666667, 8696.92592592593, 1303.07407407407, 591.973333333333, 7.01727762894639],
    cesa_conservador: ["G", 15, 1200, 18000, 8446.88888888889, 1080, 72, 2891.66666666667, 12418.5555555556, 5581.44444444445, 1016.77333333333, 6.23618832724651],
    cesa_objetivo: ["H", 20, 1200, 24000, 11262.5185185185, 1080, 54, 2891.66666666667, 15234.1851851852, 8765.81481481482, 1049.17333333333, 6.23618832724651],
};
for (const r of esc) {
    const e = ESPERADO_ESC[r.input.id];
    const c = e[0];
    check("Escenarios", `${c}6`, `${r.input.etiqueta} · horas`, r.input.horasMes, e[1]);
    check("Escenarios", `${c}7`, `${r.input.etiqueta} · tarifa`, r.input.tarifaHora, e[2]);
    check("Escenarios", `${c}8`, `${r.input.etiqueta} · ingreso`, r.ingresoNeto, e[3]);
    check("Escenarios", `${c}10`, `${r.input.etiqueta} · variable mensual`, r.costoVariableMes, e[4]);
    check("Escenarios", `${c}11`, `${r.input.etiqueta} · overhaul`, r.overhaulMes, e[5]);
    check("Escenarios", `${c}12`, `${r.input.etiqueta} · overhaul por hora`, r.overhaulHora, e[6]);
    check("Escenarios", `${c}13`, `${r.input.etiqueta} · fijo sin overhaul`, r.fijosMes, e[7]);
    check("Escenarios", `${c}15`, `${r.input.etiqueta} · costo total`, r.costoTotal, e[8]);
    check("Escenarios", `${c}16`, `${r.input.etiqueta} · resultado`, r.resultado, e[9]);
    check("Escenarios", `${c}18`, `${r.input.etiqueta} · margen vuelo típico`, r.margenVueloTipico, e[10]);
    check("Escenarios", `${c}19`, `${r.input.etiqueta} · equilibrio hs/mes`, r.equilibrioHorasMes, e[11]);
}

// Resumen: comparativo de tarifas con CESA (C44:H51) — también es la hoja Recuperación de Inversión
const comp = bp.computeTariffComparison(base, plan, toggles);
const ESPERADO_COMP = [
    // col, ingreso, costo, resultado, equilibrio, recupero avión, recupero avión+aviónica
    ["C", 18000, 12418.5555555556, 5581.44444444445, 6.23618832724651, 41.0451097883861, 49.1075388688711],
    ["D", 19500, 12418.5555555556, 7081.44444444445, 5.3898852007479, 32.3508857263898, 38.7055214723926],
    ["E", 21000, 12418.5555555556, 8581.44444444445, 4.74583547239286, 26.6960884595963, 31.9399608975438],
    ["F", 24000, 15234.1851851852, 8765.81481481482, 6.23618832724651, 26.134592714966, 31.2681713896999],
    ["G", 26000, 15234.1851851852, 10765.8148148148, 5.3898852007479, 21.2794854770071, 25.4593827513013],
    ["H", 28000, 15234.1851851852, 12765.8148148148, 4.74583547239286, 17.9456621706699, 21.4707015553692],
];
comp.forEach((r, i) => {
    const [c, ing, costo, res, eq, recA, recT] = ESPERADO_COMP[i];
    check("Resumen", `${c}46`, `${r.input.etiqueta} · ingreso`, r.ingresoNeto, ing);
    check("Resumen", `${c}47`, `${r.input.etiqueta} · costo total`, r.costoTotal, costo);
    check("Resumen", `${c}48`, `${r.input.etiqueta} · resultado`, r.resultado, res);
    check("Resumen", `${c}49`, `${r.input.etiqueta} · equilibrio`, r.equilibrioHorasMes, eq);
    check("Resumen", `${c}50`, `${r.input.etiqueta} · recupero avión`, r.recuperoMesesAvion, recA);
    check("Resumen", `${c}51`, `${r.input.etiqueta} · recupero avión+aviónica`, r.recuperoMesesAvionAvionica, recT);
});
// Recuperación de Inversión C16:H16 (15 hs/mes, tarifas 1/2/3)
const REC = [41.0451097883861, 49.1075388688711, 32.3508857263898, 38.7055214723926, 26.6960884595963, 31.9399608975438];
[0, 1, 2].forEach((ti) => {
    check("Recuperación de Inversión", `${"CEG"[ti]}16`, `Tarifa ${ti + 1} · solo avión`, comp[ti].recuperoMesesAvion, REC[ti * 2]);
    check("Recuperación de Inversión", `${"DFH"[ti]}16`, `Tarifa ${ti + 1} · avión + aviónica`, comp[ti].recuperoMesesAvionAvionica, REC[ti * 2 + 1]);
});

// Fee CESA + Plataforma
const terc = bp.computeThirdPartyFees(plan);
check("Fee CESA + Plataforma", "D10", "Fee de plataforma sugerido", terc.feePlataformaSugerido, 194.444444444444);
check("Fee CESA + Plataforma", "C14", "Fee a 12 meses", terc.sensibilidad[0].feeMes, 291.666666666667);
check("Fee CESA + Plataforma", "C15", "Fee a 18 meses", terc.sensibilidad[1].feeMes, 194.444444444444);
check("Fee CESA + Plataforma", "C16", "Fee a 24 meses", terc.sensibilidad[2].feeMes, 145.833333333333);
const ESP_CAT = [
    ["D", 200, 394.444444444444, 1577.77777777778],
    ["E", 320, 514.444444444445, 2057.77777777778],
    ["F", 500, 694.444444444445, 2777.77777777778],
];
terc.categorias.forEach((c, i) => {
    const [col, feeH, porAc, flota] = ESP_CAT[i];
    check("Fee CESA + Plataforma", `${col}31`, `${c.etiqueta} · fee por hora/mes`, c.ingresoFeeHoraMes, feeH);
    check("Fee CESA + Plataforma", `${col}33`, `${c.etiqueta} · total por aeronave`, c.totalPorAeronave, porAc);
    check("Fee CESA + Plataforma", `${col}34`, `${c.etiqueta} · total 4 aeronaves`, c.totalFlota, flota);
});

console.log("\n=== Verificación contra la planilla (mismos supuestos: overhaul fijo 1080, tc 6000, sin IVA) ===\n");
console.table(rows.map((r) => ({ ...r, planilla: r.planilla === null ? "—" : +r.planilla.toFixed(4), app: r.app === null ? "—" : +r.app.toFixed(4) })));
console.log(`\nResultado: ${ok} OK, ${fail} diferentes.\n`);

// ------------------------------------------------ modo corregido de la app (informativo)
const planApp = bp.createDefaultBusinessPlan("zp-boc", "owner-test", "ZP-BOC", "Cessna 414");
const baseApp = bp.buildPlanCostBase(planApp, cfg);
const togglesApp = { descontarBancard: planApp.descontarBancard, descontarIre: planApp.descontarIre };
const escApp = bp.computeScenarioTable(baseApp, planApp, bp.getTarifaHoy(cfg), togglesApp);
console.log("=== Modo corregido de la app (overhaul 119 USD/h de GIO, tarifas IVA incluido, comisión 2,5 % e IRE 10 %) ===\n");
console.table(
    escApp.map((r) => ({
        escenario: r.input.etiqueta,
        horas: r.input.horasMes,
        "tarifa c/IVA": r.input.tarifaHora,
        "ingreso neto": Math.round(r.ingresoNeto),
        comisión: Math.round(r.comisionBancard),
        "costo total": Math.round(r.costoTotal),
        IRE: Math.round(r.ire),
        resultado: Math.round(r.resultado),
        "equilibrio hs": r.equilibrioHorasMes === null ? "—" : +r.equilibrioHorasMes.toFixed(2),
        "recupero avión (meses)": r.recuperoMesesAvion === null ? "No recupera" : +r.recuperoMesesAvion.toFixed(1),
    }))
);

// Chequeos de coherencia del modo corregido
const coherencia = [];
const s = escApp[1];
coherencia.push(["Overhaul por hora = horas × 119", Math.abs(s.overhaulMes - s.input.horasMes * 119) < 1e-9]);
coherencia.push(["Ingreso neto = bruto ÷ 1,1", Math.abs(s.ingresoNeto - s.ingresoBruto / 1.1) < 1e-9]);
coherencia.push(["Comisión = 2,5 % del bruto", Math.abs(s.comisionBancard - s.ingresoBruto * 0.025) < 1e-9]);
coherencia.push(["IRE = 10 % del resultado positivo", s.resultadoAntesIre > 0 ? Math.abs(s.ire - s.resultadoAntesIre * 0.1) < 1e-9 : s.ire === 0]);
coherencia.push(["Seguro con CESA > sin CESA", escApp[3].seguroMes > escApp[0].seguroMes]);
const eq = escApp[1].equilibrioHorasMes;
if (eq !== null) {
    const enEq = bp.computeScenario(baseApp, { ...escApp[1].input, horasMes: eq, descontarIre: false });
    coherencia.push(["En el equilibrio el resultado es 0", Math.abs(enEq.resultado) < 1e-6]);
}
coherencia.forEach(([n, pass]) => {
    pass ? ok++ : fail++;
    console.log(`${pass ? "OK " : "ERR"} ${n}`);
});

console.log(`\nTotal: ${ok} OK, ${fail} con error.`);
process.exit(fail === 0 ? 0 : 1);
