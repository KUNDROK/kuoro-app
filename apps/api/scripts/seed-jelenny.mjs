/**
 * Seed: Administrador Jelenny Alejandra
 * Crea admin + propiedad + 100 unidades con propietarios hipotéticos variados.
 * Ejecutar con: node apps/api/scripts/seed-jelenny.mjs
 */

const BASE =
  process.env.API_SEED_BASE_URL?.trim() ||
  process.env.API_BASE_URL?.trim() ||
  "http://localhost:4000/api/v1";

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
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

// ── Nombres colombianos variados ──────────────────────────────────────────────
const NOMBRES = [
  "Carlos Arturo Gómez Restrepo", "María Fernanda López Díaz", "Andrés Felipe Torres Vargas",
  "Claudia Patricia Jiménez Mora", "Luis Eduardo Martínez Castro", "Sandra Milena Rodríguez Peña",
  "Jorge Armando Herrera Silva", "Diana Carolina Ospina Ruiz", "Ricardo Alonso Muñoz Cardona",
  "Yolanda Esperanza Cárdenas Bernal", "Fabio Ernesto Salcedo Arias", "Paola Andrea Rincón Suárez",
  "Gustavo Adolfo Mejía Quintero", "Luz Marina Pardo Acosta", "Hernán Darío Vargas Londoño",
  "Adriana Marcela Castaño Giraldo", "Jaime Alberto Ríos Agudelo", "Patricia Elena Morales Romero",
  "Eduardo José Velásquez Cano", "Catalina Isabel Álvarez Montoya", "Rodrigo Enrique Zapata Benítez",
  "Gloria Cecilia Henao Cortés", "Mauricio Andrés Soto Espinosa", "Beatriz Helena Arango Gaviria",
  "Iván Darío Posada Ochoa", "Natalia Cristina Duque Franco", "Sebastián Felipe Patiño Reyes",
  "Martha Lucía Bedoya Gutiérrez", "Alejandro Miguel Ossa Carmona", "Olga Cecilia Caballero Sierra",
  "Francisco Javier Tobón Vásquez", "Amparo del Socorro Meza Leal", "Rafael Antonio Cano Guerrero",
  "Esperanza del Pilar Nieto Salinas", "Orlando Alberto Naranjo Cifuentes", "Carmen Rosa Barrera Pineda",
  "Álvaro Hernán Buitrago Castellanos", "Rosa Elena Molina Pastrana", "Néstor Iván Rueda Angarita",
  "Consuelo Margarita Pedraza Daza", "Hernando Augusto Fonseca Maldonado", "Elsa Janneth Pinto Chaparro",
  "Germán Rodrigo Useche Carvajal", "Blanca Nubia Mora Quiñones", "Jairo Humberto Abril Sánchez",
  "Doris Amparo Téllez Gaitán", "Humberto de Jesús Ibáñez Guerrero", "Myriam del Carmen Pulido Lozano",
  "Ramón Alberto Galvis Sepúlveda", "Flor Alba Mendoza Trujillo", "William Fernando Acosta Varela",
  "Aura Inés Caicedo Preciado", "Ernesto Darío Echeverri Tamayo", "Gilma Lucía Palacio Rendón",
  "Jesús Albeiro Agudelo Correa", "Piedad Eugenia Vélez Toro", "Henry Augusto Zuluaga Ossa",
  "Cecilia Amparo Betancur Montiel", "Armando de Jesús Arenas Álvarez", "Inés del Carmen Garzón Roa",
  "Nicolás Esteban Serna Uribe", "Valentina Sofía Cárdenas Ríos", "Daniel Alejandro Ospina Guzmán",
  "Juliana Marcela Acevedo Correa", "Sergio Camilo Restrepo Arango", "Isabella Sofía Torres Ramírez",
  "Tomás Andrés Pérez Londoño", "Manuela Alejandra Giraldo Vélez", "Santiago David Murillo Zapata",
  "Laura Valentina Castillo Morales", "Felipe Augusto Duarte Salazar", "Daniela Natalia Herrera Franco",
  "David Esteban Ríos Patiño", "Verónica Paola Ortiz Castaño", "Sebastián Mateo Llano Arango",
  "Ana María Jaramillo Echeverri", "Mateo Alejandro Álvarez Posada", "Camila Sofía Bermúdez Henao",
  "Juan Pablo Suárez Montoya", "Sara Valentina Molina López", "Esteban Andrés Tobón Mejía",
  "Natalia Alejandra Villa Ríos", "Cristian Camilo Ramos Cardona", "María Paula Vargas Muñoz",
  "Simón Andrés Arango Gaviria", "Alejandra Milena Salcedo Gómez", "Andrés Mauricio Soto Díaz",
  "Catalina Andrea López Restrepo", "Emilio José Piedrahíta Ossa", "Luisa Fernanda Cano Castaño",
  "Óscar Alberto Ocampo Vélez", "Carolina Marcela Gaviria Uribe", "Jhon Alexander Cruz Bermúdez",
  "Adriana Lorena Quintero Franco", "Pedro Nel Ríos Leal", "Nubia Esperanza Hincapié Ruiz",
  "Álvaro Augusto Tamayo Salinas", "Luz Dary Castañeda Mendoza", "Roberto Carlos Isaza Arenas",
  "Olga Lucía Osorio Botero", "Víctor Hugo Rincón Serna", "Mónica Liliana Bedoya Pinto"
];

const DOC_TYPES = ["cc","cc","cc","cc","ce","ce","nit","pasaporte","te","cc","cc","cc"];
const PHONE_PREFIXES = ["301","302","304","305","310","311","312","313","314","315","316","317","318","319","320"];

function phone() {
  const p = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  return `+57 ${p} ${Math.floor(1000000 + Math.random() * 8999999)}`;
}

function email(name) {
  const clean = name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, ".");
  const domains = ["gmail.com","hotmail.com","outlook.com","yahoo.com","protonmail.com"];
  const d = domains[Math.floor(Math.random() * domains.length)];
  const suffix = Math.floor(10 + Math.random() * 89);
  return `${clean}${suffix}@${d}`;
}

function docNum(type) {
  if (type === "nit") return `${Math.floor(800000000 + Math.random() * 99999999)}-${Math.floor(1+Math.random()*9)}`;
  return `${Math.floor(10000000 + Math.random() * 89999999)}`;
}

function coeff(i) {
  // Variedad: algunas unidades grandes (mayor coeficiente), otras pequeñas
  const base = [0.85, 1.0, 1.1, 1.2, 0.95, 1.05, 0.9, 1.15, 0.88, 1.08];
  return parseFloat((base[i % base.length] + (Math.random() * 0.2 - 0.1)).toFixed(4));
}

function area(i) {
  const sizes = [42, 52, 65, 72, 80, 90, 105, 48, 58, 68];
  return sizes[i % sizes.length];
}

// ── Construir 100 unidades (4 torres × 5 pisos × 5 aptos) ─────────────────────
function buildUnits(names) {
  const units = [];
  const towers = ["A", "B", "C", "D"];
  let nameIdx = 0;
  let unitNum = 0;

  for (const tower of towers) {
    for (let floor = 1; floor <= 5; floor++) {
      for (let apt = 1; apt <= 5; apt++) {
        const label = `${floor}0${apt}`;           // 101, 102 … 505
        const idx = unitNum;
        const ownerName = names[nameIdx % names.length];
        nameIdx++;
        unitNum++;

        // Determinar variedad:
        const hasCoOwner = idx % 7 === 0;         // ~14% tienen copropietario
        const hasProxy   = idx % 11 === 0;        // ~9%  tienen poder
        const noEmail    = idx % 5 === 0;         // 20%  sin email
        const noPhone    = idx % 9 === 0;         // ~11% sin teléfono
        const docType    = DOC_TYPES[idx % DOC_TYPES.length];
        const role       = hasProxy ? "apoderado" : "propietario";
        const proxyStatus = hasProxy ? "approved" : "not_required";
        const ownerEmail = noEmail ? undefined : email(ownerName);
        const ownerPhone = noPhone ? undefined : phone();

        const owners = [
          {
            fullName: ownerName,
            documentType: docType,
            document: docNum(docType),
            email: ownerEmail,
            phone: ownerPhone,
            participationRole: role,
            canVote: true,
            receivesInvitations: !noEmail,
            proxyApprovalStatus: proxyStatus,
            isPrimary: true,
            ownershipPercentage: hasCoOwner ? 60 : 100
          }
        ];

        if (hasCoOwner) {
          const coName = names[(nameIdx + 50) % names.length];
          owners.push({
            fullName: coName,
            documentType: "cc",
            document: docNum("cc"),
            email: email(coName),
            phone: phone(),
            participationRole: "copropietario",
            canVote: false,
            receivesInvitations: true,
            proxyApprovalStatus: "not_required",
            isPrimary: false,
            ownershipPercentage: 40
          });
        }

        units.push({
          unitType: "apartamento",
          groupingKind: "torre",
          groupingLabel: `Torre ${tower}`,
          unitNumber: label,
          floor: String(floor),
          destination: "residencial",
          privateArea: area(idx),
          coefficient: coeff(idx),
          contributionModule: parseFloat((coeff(idx) * 100).toFixed(2)),
          owners
        });
      }
    }
  }
  return units;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Seed: Jelenny Alejandra");
  console.log("─".repeat(50));

  // 1. Registrar admin
  const ADMIN_EMAIL = "jelenny@kuoro.io";
  const ADMIN_PASS  = "Kuoro2026!";
  let token;

  console.log("1. Registrando administradora…");
  const reg = await api("POST", "/auth/register", {
    fullName: "Jelenny Alejandra Morales",
    email: ADMIN_EMAIL,
    phone: "+57 310 555 1234",
    password: ADMIN_PASS
  });

  if (reg.status === 201) {
    token = reg.data.token;
    console.log(`   ✅ Admin creada (id: ${reg.data.admin.id})`);
  } else if (reg.status === 409 || reg.status === 400) {
    console.log("   ℹ️  Ya existe, iniciando sesión…");
    const login = await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (login.status !== 200) {
      console.error("   ❌ Login fallido:", login.data);
      process.exit(1);
    }
    token = login.data.token;
    console.log("   ✅ Sesión iniciada");
  } else {
    console.error("   ❌ Error al registrar:", reg.data);
    process.exit(1);
  }

  // 2. Crear propiedad
  console.log("2. Creando propiedad…");
  const propRes = await api("POST", "/properties", {
    name: "Conjunto Residencial Torres del Norte",
    city: "Bogotá",
    address: "Cra 15 # 127-45, Usaquén, Bogotá",
    nit: "830.456.789-2",
    legalType: "residencial",
    developmentShape: "conjunto",
    buildingSubtype: "edificio_apartamentos",
    structureModes: ["torres_apartamentos"],
    privateUnitTypes: ["apartamento"],
    usesCoefficients: true,
    usesContributionModules: true,
    supportsProxies: true
  }, token);

  if (propRes.status !== 201 && propRes.status !== 200) {
    // Puede que ya exista — buscar la existente
    console.log("   ⚠️  No se pudo crear propiedad, intentando obtener lista…");
    const listRes = await api("GET", "/properties", null, token);
    if (listRes.status !== 200 || !listRes.data.properties?.length) {
      console.error("   ❌ Sin propiedad disponible:", propRes.data);
      process.exit(1);
    }
    const existing = listRes.data.properties.find(p => p.name === "Conjunto Residencial Torres del Norte");
    if (!existing) {
      console.error("   ❌ Propiedad no encontrada en la lista");
      process.exit(1);
    }
    console.log(`   ℹ️  Usando propiedad existente (id: ${existing.id})`);
    var propertyId = existing.id;
  } else {
    var propertyId = (propRes.data.property ?? propRes.data).id;
    console.log(`   ✅ Propiedad creada (id: ${propertyId})`);
  }

  // 3. Crear 100 unidades en lotes de 10 (límite de timeout de Prisma)
  console.log("3. Generando 100 unidades con propietarios…");
  const units = buildUnits(NOMBRES);
  console.log(`   → ${units.length} unidades preparadas, enviando en lotes de 10…`);

  const BATCH_SIZE = 10;
  let totalCreated = 0;
  for (let i = 0; i < units.length; i += BATCH_SIZE) {
    const batch = units.slice(i, i + BATCH_SIZE);
    const unitsRes = await api("POST", `/properties/${propertyId}/units`, { units: batch }, token);
    if (unitsRes.status !== 201 && unitsRes.status !== 200) {
      console.error(`   ❌ Error en lote ${i/BATCH_SIZE + 1}:`, JSON.stringify(unitsRes.data).slice(0, 300));
      process.exit(1);
    }
    const created = unitsRes.data.units ?? [];
    totalCreated += created.length;
    process.stdout.write(`   Lote ${Math.floor(i/BATCH_SIZE)+1}/10 → ${totalCreated} unidades\r`);
  }
  console.log(`\n   ✅ ${totalCreated} unidades creadas`);

  // ── Resumen final ──────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(50));
  console.log("✅  Seed completado");
  console.log(`   Admin:      ${ADMIN_EMAIL}  /  contraseña: ${ADMIN_PASS}`);
  console.log(`   Propiedad:  Conjunto Residencial Torres del Norte (${propertyId})`);
  console.log(`   Unidades:   ${totalCreated} / 100`);
  console.log(`   Torres:     A, B, C, D  ×  5 pisos  ×  5 aptos`);
  console.log(`   Variedad de propietarios:`);
  console.log(`     - ~14% con copropietario registrado`);
  console.log(`     -  ~9% con apoderado (poder aprobado)`);
  console.log(`     - ~20% sin email (invitación manual)`);
  console.log(`     - ~11% sin teléfono`);
  console.log(`     - Tipos de doc: CC, CE, NIT, Pasaporte, TE`);
  console.log(`     - Coeficientes variados entre 0.85 y 1.20`);
  console.log(`     - Áreas privadas: 42 – 105 m²`);
  console.log("─".repeat(50));
  console.log("\nAbre http://localhost:5173 e inicia sesión con las credenciales de arriba.");
}

main().catch(err => { console.error(err); process.exit(1); });
