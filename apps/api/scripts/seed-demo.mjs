/**
 * seed-demo.mjs — Entorno de demostración completo para pruebas E2E
 *
 * Crea (idempotente — puede correrse múltiples veces):
 *   1. Administrador demo
 *   2. Propiedad "Conjunto Torres Demo"
 *   3. 12 unidades con variedad realista (propietario directo, copropietario, apoderado aprobado)
 *   4. Asamblea en estado `in_progress`
 *   5. Configuración de acceso + access grants (uno por unidad)
 *   6. Seed de representaciones de voto
 *
 * Uso:
 *   node apps/api/scripts/seed-demo.mjs
 *
 * Requiere API accesible. Por defecto localhost; en staging:
 *   API_SEED_BASE_URL=https://tu-api.railway.app/api/v1
 *   APP_BASE_URL=https://tu-front.vercel.app
 */

const BASE =
  process.env.API_SEED_BASE_URL?.trim() ||
  process.env.API_BASE_URL?.trim() ||
  "http://localhost:4000/api/v1";

const APP_ORIGIN =
  process.env.APP_BASE_URL?.trim() ||
  process.env.PUBLIC_APP_URL?.trim() ||
  "http://localhost:5173";

// ─── Cliente HTTP mínimo ──────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function ok(res, label) {
  if (res.status < 200 || res.status >= 300) {
    console.error(`❌ ${label} — HTTP ${res.status}:`, JSON.stringify(res.data).slice(0, 600));
    process.exit(1);
  }
  return res.data;
}

// ─── Datos demo ───────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "demo@kuoro.io";
const ADMIN_PASS  = "Kuoro2026!";
const ADMIN_NAME  = "Demo Administrador";

/**
 * 12 unidades en 2 torres × 2 pisos × 3 aptos.
 * Variedad:
 *  A-101, A-102, A-103: propietario directo canVote=true
 *  A-201: propietario directo con copropietario (copropietario no vota)
 *  A-202: apoderado aprobado (participationRole="apoderado", proxyApprovalStatus="approved")
 *  A-203: propietario directo canVote=true
 *  B-101..B-203: propietarios directos variados
 */
const UNITS_DEMO = [
  {
    groupingLabel: "Torre A", floor: "1", unitNumber: "101",
    coeff: 1.00, area: 75,
    owners: [{
      fullName: "Carlos Arturo Gómez Restrepo", documentType: "cc", document: "71234567",
      email: "carlos.gomez@demo.com", phone: "+57 310 111 0001",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre A", floor: "1", unitNumber: "102",
    coeff: 0.95, area: 68,
    owners: [{
      fullName: "María Fernanda López Díaz", documentType: "cc", document: "52456789",
      email: "maria.lopez@demo.com", phone: "+57 311 222 0002",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre A", floor: "1", unitNumber: "103",
    coeff: 1.05, area: 82,
    owners: [{
      fullName: "Andrés Felipe Torres Vargas", documentType: "cc", document: "79876543",
      email: "andres.torres@demo.com", phone: "+57 312 333 0003",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre A", floor: "2", unitNumber: "201",
    coeff: 1.10, area: 90,
    owners: [
      {
        fullName: "Claudia Patricia Jiménez Mora", documentType: "cc", document: "43567891",
        email: "claudia.jimenez@demo.com", phone: "+57 313 444 0004",
        participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
        isPrimary: true, ownershipPercentage: 70
      },
      {
        fullName: "Roberto Jiménez Cano", documentType: "cc", document: "79012345",
        email: "roberto.jimenez@demo.com", phone: "+57 314 555 0005",
        participationRole: "copropietario", canVote: false, proxyApprovalStatus: "not_required",
        isPrimary: false, ownershipPercentage: 30
      }
    ]
  },
  {
    groupingLabel: "Torre A", floor: "2", unitNumber: "202",
    coeff: 0.88, area: 62,
    owners: [{
      fullName: "Representante Oficial Apoderado", documentType: "cc", document: "12345678",
      email: "apoderado.demo@demo.com", phone: "+57 315 666 0006",
      participationRole: "apoderado", canVote: true, proxyApprovalStatus: "approved",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre A", floor: "2", unitNumber: "203",
    coeff: 1.02, area: 78,
    owners: [{
      fullName: "Luis Eduardo Martínez Castro", documentType: "ce", document: "7654321",
      email: "luis.martinez@demo.com", phone: "+57 316 777 0007",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "1", unitNumber: "101",
    coeff: 0.92, area: 65,
    owners: [{
      fullName: "Sandra Milena Rodríguez Peña", documentType: "cc", document: "65432109",
      email: "sandra.rodriguez@demo.com", phone: "+57 317 888 0008",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "1", unitNumber: "102",
    coeff: 0.98, area: 72,
    owners: [{
      fullName: "Jorge Armando Herrera Silva", documentType: "cc", document: "83210987",
      email: "jorge.herrera@demo.com", phone: "+57 318 999 0009",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "1", unitNumber: "103",
    coeff: 1.08, area: 86,
    owners: [{
      fullName: "Diana Carolina Ospina Ruiz", documentType: "cc", document: "54678901",
      email: "diana.ospina@demo.com", phone: "+57 319 000 0010",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "2", unitNumber: "201",
    coeff: 1.15, area: 95,
    owners: [{
      fullName: "Ricardo Alonso Muñoz Cardona", documentType: "cc", document: "71890123",
      email: "ricardo.munoz@demo.com", phone: "+57 320 111 0011",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "2", unitNumber: "202",
    coeff: 0.90, area: 60,
    owners: [{
      fullName: "Yolanda Esperanza Cárdenas Bernal", documentType: "cc", document: "41234567",
      email: "yolanda.cardenas@demo.com", phone: "+57 301 222 0012",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  },
  {
    groupingLabel: "Torre B", floor: "2", unitNumber: "203",
    coeff: 1.12, area: 88,
    owners: [{
      fullName: "Fabio Ernesto Salcedo Arias", documentType: "cc", document: "72345678",
      email: "fabio.salcedo@demo.com", phone: "+57 302 333 0013",
      participationRole: "propietario", canVote: true, proxyApprovalStatus: "not_required",
      isPrimary: true, ownershipPercentage: 100
    }]
  }
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  Kuoro — Seed de entorno demo");
  console.log("═".repeat(55));

  // ── 1. Admin ──────────────────────────────────────────────────────────────
  let token;
  console.log("\n1. Administrador demo…");
  const reg = await api("POST", "/auth/register", {
    fullName: ADMIN_NAME, email: ADMIN_EMAIL, phone: "+57 300 000 0000", password: ADMIN_PASS
  });

  if (reg.status === 201) {
    token = reg.data.token;
    console.log(`   ✅ Admin creado (id: ${reg.data.admin.id})`);
  } else if (reg.status === 409 || reg.status === 400) {
    const login = await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
    ok(login, "Login admin");
    token = login.data.token;
    console.log("   ℹ️  Admin ya existe — sesión iniciada");
  } else {
    ok(reg, "Registro admin");
  }

  // ── 2. Propiedad ──────────────────────────────────────────────────────────
  let propertyId;
  console.log("\n2. Propiedad demo…");

  const listPropsRes = await api("GET", "/properties", null, token);
  const existingProp = listPropsRes.data?.properties?.find(
    p => p.name === "Conjunto Residencial Torres Demo"
  );

  if (existingProp) {
    propertyId = existingProp.id;
    console.log(`   ℹ️  Propiedad existente (id: ${propertyId})`);
  } else {
    const propRes = await api("POST", "/properties", {
      name: "Conjunto Residencial Torres Demo",
      city: "Bogotá",
      address: "Cra 15 # 127-45, Usaquén, Bogotá",
      nit: "830.456.111-1",
      legalType: "residencial",
      developmentShape: "conjunto",
      buildingSubtype: "edificio_apartamentos",
      structureModes: ["torres_apartamentos"],
      privateUnitTypes: ["apartamento"],
      usesCoefficients: true,
      usesContributionModules: true,
      supportsProxies: true
    }, token);
    ok(propRes, "Crear propiedad");
    propertyId = (propRes.data.property ?? propRes.data).id;
    console.log(`   ✅ Propiedad creada (id: ${propertyId})`);
  }

  // ── 3. Unidades ──────────────────────────────────────────────────────────
  console.log("\n3. Unidades y propietarios…");
  let unitIds = [];

  const existingUnitsRes = await api("GET", `/properties/${propertyId}/units`, null, token);
  const existingUnits = existingUnitsRes.data?.units ?? [];

  if (existingUnits.length >= UNITS_DEMO.length) {
    console.log(`   ℹ️  ${existingUnits.length} unidades ya existen — reutilizando`);
    unitIds = existingUnits.map(u => u.id);
  } else {
    const unitsPayload = UNITS_DEMO.map(u => ({
      unitType: "apartamento",
      groupingKind: "torre",
      groupingLabel: u.groupingLabel,
      unitNumber: u.unitNumber,
      floor: u.floor,
      destination: "residencial",
      privateArea: u.area,
      coefficient: u.coeff,
      contributionModule: parseFloat((u.coeff * 100).toFixed(2)),
      owners: u.owners
    }));

    const unitsRes = await api("POST", `/properties/${propertyId}/units`, { units: unitsPayload }, token);
    ok(unitsRes, "Crear unidades");
    unitIds = (unitsRes.data.units ?? []).map(u => u.id);
    console.log(`   ✅ ${unitIds.length} unidades creadas`);
  }

  // ── 4. Asamblea ───────────────────────────────────────────────────────────
  let assemblyId;
  console.log("\n4. Asamblea demo…");

  // GET /assembly-settings devuelve la asamblea activa (la única permitida)
  const asmSettingsRes = await api("GET", `/properties/${propertyId}/assembly-settings`, null, token);
  const existingAsm = asmSettingsRes.data?.assembly;

  /**
   * El payload de AssemblyConfigInput requerido por isValidAssemblyConfig:
   *   title        (string >= 5 chars)
   *   type         ("ordinaria" | "extraordinaria" | "segunda_convocatoria" | ...)
   *   modality     ("presencial" | "virtual" | "mixta")
   *   status       ("draft" | "scheduled" | "in_progress" | ...)
   *   scheduledAt  (ISO date string >= 10 chars)
   *   conferenceService ("ninguno" | "kuoro_live" | "enlace_externo" | ...)
   *   votingBasis  ("coeficientes" | "modulos" | "unidad")
   *   allowsSecondCall (boolean)
   */
  const now = new Date().toISOString();
  const asmPayload = {
    title:            "Asamblea General Demo 2026",
    type:             "ordinaria",
    modality:         "virtual",
    status:           "in_progress",           // Directamente en_curso para pruebas
    scheduledAt:      now,
    conferenceService: "kuoro_live",           // Usa el LiveKit integrado
    votingBasis:      "unidad",
    allowsSecondCall: false,
    location:         "Sala comunal / Videoconferencia",
    notes:            "Asamblea de prueba generada por seed-demo.mjs"
  };

  if (existingAsm) {
    assemblyId = existingAsm.id;
    console.log(`   ℹ️  Asamblea existente (id: ${assemblyId}, estado: ${existingAsm.status})`);

    // Si no está en in_progress, actualizarla
    if (existingAsm.status !== "in_progress") {
      const updRes = await api("PUT", `/properties/${propertyId}/assembly-settings`, {
        ...asmPayload,
        status: "in_progress"
      }, token);
      if (updRes.status === 200) {
        console.log("   ✅ Asamblea actualizada a in_progress");
      } else {
        console.log(`   ⚠️  No se pudo actualizar el estado: HTTP ${updRes.status}`);
      }
    }
  } else {
    // Crear asamblea directamente en in_progress
    const asmRes = await api("POST", `/properties/${propertyId}/assemblies`, asmPayload, token);
    ok(asmRes, "Crear asamblea");
    assemblyId = (asmRes.data.assembly ?? asmRes.data).id;
    console.log(`   ✅ Asamblea creada y en in_progress (id: ${assemblyId})`);
  }

  // ── 5. Access Config + Grants ─────────────────────────────────────────────
  console.log("\n5. Configuración de acceso y grants…");

  // PUT /api/v1/properties/:pId/assembly-access
  // Requiere body: { config: AssemblyAccessConfigInput, grants: AssemblyAccessGrantInput[] }
  //
  // AssemblyAccessConfigInput:
  //   sessionAccessMode:          "enlace_unico" | "codigo_y_documento" | "pre_registro_asistido"
  //   identityValidationMethod:   "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp"
  //   otpChannel:                 "email" | "sms" | "no_aplica"
  //   requireDocumentMatch:       boolean
  //   enableLobby:                boolean
  //   allowCompanions:            boolean
  //   oneActiveVoterPerUnit:      boolean
  //   fallbackManualValidation:   boolean
  //
  // AssemblyAccessGrantInput (por unidad):
  //   unitId:               string
  //   deliveryChannel:      "email" | "whatsapp" | "manual" | "pendiente"
  //   validationMethod:     "otp_email" | "otp_sms" | "validacion_manual" | "sin_otp"
  //   preRegistrationStatus: "pending" | "confirmed" | "manual_review"
  //   dispatchStatus:       "draft" | "ready_to_send" | "sent"

  const grantsPayload = unitIds.map(unitId => ({
    unitId,
    deliveryChannel:       "email",
    validationMethod:      "sin_otp",
    preRegistrationStatus: "confirmed",
    dispatchStatus:        "sent"
  }));

  const accessRes = await api("PUT", `/properties/${propertyId}/assembly-access`, {
    config: {
      sessionAccessMode:        "enlace_unico",
      identityValidationMethod: "sin_otp",
      otpChannel:               "no_aplica",
      requireDocumentMatch:     false,
      enableLobby:              false,
      allowCompanions:          false,
      oneActiveVoterPerUnit:    true,
      fallbackManualValidation: false
    },
    grants: grantsPayload
  }, token);

  if (accessRes.status === 200) {
    const count = accessRes.data.grants?.length ?? 0;
    console.log(`   ✅ Configuración de acceso guardada — ${count} grants`);
  } else {
    console.log(`   ⚠️  Access config: HTTP ${accessRes.status}:`, JSON.stringify(accessRes.data).slice(0, 200));
  }

  // Recargar grants para obtener accessTokens
  const grantsRes = await api("GET", `/properties/${propertyId}/assembly-access`, null, token);
  const allGrants = grantsRes.data?.grants ?? [];
  console.log(`   ✅ ${allGrants.length} grants cargados con accessToken`);

  // ── 6. Seed de representaciones ───────────────────────────────────────────
  console.log("\n6. Representaciones de voto…");
  const seedRes = await api(
    "POST",
    `/properties/${propertyId}/assemblies/${assemblyId}/representations/seed`,
    null,
    token
  );
  if (seedRes.status === 200) {
    const r = seedRes.data;
    console.log(`   ✅ ${r.created} creadas, ${r.skipped} omitidas` +
      (r.errors?.length ? `, ${r.errors.length} errores` : ""));
  } else {
    console.log(`   ⚠️  Seed representaciones: HTTP ${seedRes.status}`);
  }

  // ── 7. Obtener representaciones con tokens ────────────────────────────────
  const repsRes = await api(
    "GET", `/properties/${propertyId}/assemblies/${assemblyId}/representations`, null, token
  );
  const representations = repsRes.data?.representations ?? [];

  // ── 8. Imprimir resumen ───────────────────────────────────────────────────
  console.log("\n" + "═".repeat(55));
  console.log("✅  ENTORNO DEMO LISTO");
  console.log("═".repeat(55));

  console.log("\n📋  CREDENCIALES ADMIN");
  console.log(`   Email:      ${ADMIN_EMAIL}`);
  console.log(`   Contraseña: ${ADMIN_PASS}`);
  console.log(`   Hub:        ${APP_ORIGIN}/asambleas/${assemblyId}`);
  console.log(`\n   Property ID: ${propertyId}`);
  console.log(`   Assembly ID: ${assemblyId}`);

  console.log("\n🔗  LINKS DE ASISTENTES (copiar y pegar en otro navegador)");
  console.log("─".repeat(55));

  // Mostrar hasta 6 representaciones con sus links
  const shown = representations.slice(0, 6);
  for (const rep of shown) {
    const url = `${APP_ORIGIN}/asistente/${propertyId}/${assemblyId}?token=${rep.accessToken}`;
    const typeTag = rep.representationType === "proxy" ? " [APODERADO]" : "";
    console.log(`\n   ${rep.representedUnitLabel}${typeTag}`);
    console.log(`   Representante: ${rep.representativeFullName}`);
    console.log(`   URL: ${url}`);
  }

  if (representations.length > 6) {
    console.log(`\n   ... y ${representations.length - 6} más.`);
    console.log(`   Ver: GET ${BASE}/properties/${propertyId}/assemblies/${assemblyId}/representations`);
  }

  if (representations.length === 0) {
    // Mostrar grants directos si no hay representaciones
    console.log("\n   ⚠️  Sin representaciones. Links por grant directo:");
    for (const g of allGrants.slice(0, 6)) {
      if (g.accessToken) {
        console.log(`   ${APP_ORIGIN}/asistente/${propertyId}/${assemblyId}?token=${g.accessToken}`);
      }
    }
  }

  console.log("\n" + "─".repeat(55));
  console.log("🎯  FLUJOS DE PRUEBA RÁPIDOS");
  console.log(`   Admin sala:        ${APP_ORIGIN}/asambleas/${assemblyId}  → pestaña "Sala en vivo"`);
  console.log(`   Admin votación:    ${APP_ORIGIN}/asambleas/${assemblyId}  → pestaña "Votación"`);
  console.log(`   Asistente (base):  ${APP_ORIGIN}/asistente/${propertyId}/${assemblyId}?token=<token>`);
  console.log("");
  console.log("   Ver QA_CHECKLIST.md para el flujo completo.");
  console.log("═".repeat(55) + "\n");
}

main().catch(err => {
  console.error("\n❌ Error fatal:", err.message ?? err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
