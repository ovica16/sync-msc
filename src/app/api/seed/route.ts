import { connectDB } from "@/lib/db";
import { Area } from "@/lib/models/Area";
import { Usuario } from "@/lib/models/Usuario";
import { Equipo } from "@/lib/models/Equipo";
import { ArbolFallas } from "@/lib/models/ArbolFallas";

// GET /api/seed — populates dev data (only works in development)
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  await connectDB();

  // ─── Areas ─────────────────────────────────────────────────────────────────
  const areasData = [
    { codigo: "3310", nombre: "Instrumentación Proceso", superintendencia: "Instrumentación", tieneCalibracion: false },
    { codigo: "3311", nombre: "Electricidad Proceso", superintendencia: "Electricidad", tieneCalibracion: false },
    { codigo: "3312", nombre: "Mecánica Proceso", superintendencia: "Mecánica", tieneCalibracion: false },
    { codigo: "3313", nombre: "Instrumentación Servicios", superintendencia: "Instrumentación", tieneCalibracion: false },
    { codigo: "3314", nombre: "Electricidad Servicios", superintendencia: "Electricidad", tieneCalibracion: false },
    { codigo: "3315", nombre: "Mecánica Servicios", superintendencia: "Mecánica", tieneCalibracion: false },
    { codigo: "3316", nombre: "Instrumentación Mina", superintendencia: "Instrumentación", tieneCalibracion: false },
    { codigo: "3317", nombre: "Electricidad Mina", superintendencia: "Electricidad", tieneCalibracion: false },
    { codigo: "3318", nombre: "Mecánica Mina", superintendencia: "Mecánica", tieneCalibracion: false },
    { codigo: "3319", nombre: "Automatización y Control", superintendencia: "Instrumentación", tieneCalibracion: false },
    { codigo: "3320", nombre: "Instrumentación Planta (Calibración)", superintendencia: "Instrumentación", tieneCalibracion: true },
    { codigo: "3321", nombre: "General Planta", superintendencia: "General", tieneCalibracion: false },
  ];

  for (const a of areasData) {
    await Area.updateOne({ codigo: a.codigo }, { $setOnInsert: { ...a, activo: true } }, { upsert: true });
  }

  // ─── Usuarios (passwordHash es placeholder — sin bcrypt en este seed) ──────
  const ADMIN_ID = "admin001";
  const usersData = [
    {
      nombre: "Ricardo", apellido: "Flores",
      email: "admin@msc.com",
      passwordHash: "$2b$10$placeholder_admin",
      rol: 1, areas: [], activo: true,
    },
    {
      nombre: "Carlos", apellido: "Mendoza",
      email: "super@msc.com",
      passwordHash: "$2b$10$placeholder_super",
      rol: 2, areas: ["3310", "3320"], activo: true,
    },
    {
      nombre: "Ana", apellido: "Quispe",
      email: "supervisor@msc.com",
      passwordHash: "$2b$10$placeholder_sup",
      rol: 3, areas: ["3310", "3320"], activo: true,
    },
    {
      nombre: "Juan", apellido: "Colque",
      email: "tecnico1@msc.com",
      passwordHash: "$2b$10$placeholder_t1",
      rol: 4, areas: ["3310"], activo: true,
    },
    {
      nombre: "Pedro", apellido: "Mamani",
      email: "tecnico2@msc.com",
      passwordHash: "$2b$10$placeholder_t2",
      rol: 4, areas: ["3320"], activo: true,
    },
  ];

  for (const u of usersData) {
    await Usuario.updateOne({ email: u.email }, { $setOnInsert: u }, { upsert: true });
  }

  // ─── Equipos ───────────────────────────────────────────────────────────────
  const equiposData = [
    { tag: "PIT-410121", descripcion: "Transmisor de Presión", tipoEquipo: "Transmisor", areaCodigo: "3310", criticidad: "A", fabricante: "Rosemount", modelo: "3051S", activo: true },
    { tag: "TIT-310045", descripcion: "Transmisor de Temperatura", tipoEquipo: "Transmisor", areaCodigo: "3310", criticidad: "B", fabricante: "Yokogawa", modelo: "EJA110A", activo: true },
    { tag: "FIT-210088", descripcion: "Medidor de Flujo Magnético", tipoEquipo: "Medidor de Flujo", areaCodigo: "3310", criticidad: "A", fabricante: "Endress+Hauser", modelo: "Promag 50W", activo: true },
    { tag: "LIT-510032", descripcion: "Transmisor de Nivel por Radar", tipoEquipo: "Transmisor de Nivel", areaCodigo: "3320", criticidad: "B", fabricante: "Siemens", modelo: "LR250", activo: true },
    { tag: "MOT-620011", descripcion: "Motor Bomba de Proceso", tipoEquipo: "Motor Eléctrico", areaCodigo: "3311", criticidad: "A", fabricante: "WEG", modelo: "W22", activo: true },
    { tag: "VLV-710055", descripcion: "Válvula de Control Neumática", tipoEquipo: "Válvula", areaCodigo: "3310", criticidad: "B", fabricante: "Fisher", modelo: "ED", activo: true },
    { tag: "PIT-320067", descripcion: "Transmisor de Presión Diferencial", tipoEquipo: "Transmisor", areaCodigo: "3320", criticidad: "A", fabricante: "ABB", modelo: "266", activo: true },
    { tag: "AIT-410090", descripcion: "Analizador en Línea pH", tipoEquipo: "Analizador", areaCodigo: "3310", criticidad: "A", fabricante: "Hach", modelo: "5500sc", activo: true },
  ];

  for (const e of equiposData) {
    await Equipo.updateOne({ tag: e.tag }, { $setOnInsert: e }, { upsert: true });
  }

  // ─── Árbol de Fallas ───────────────────────────────────────────────────────
  const arbolData = [
    // Transmisores
    { tipoEquipo: "Transmisor", sintoma: "Señal fuera de rango (4-20mA)", causaProbable: "Sensor dañado o descalibrado", resolucionSugerida: "Verificar señal con multímetro. Si fuera de spec, recalibrar o reemplazar sensor.", tiempoEstimadoHrs: 2, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Transmisor", sintoma: "Señal fuera de rango (4-20mA)", causaProbable: "Cable o conector en mal estado", resolucionSugerida: "Inspeccionar continuidad del lazo. Reemplazar cable o reconectar terminales.", tiempoEstimadoHrs: 1, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Transmisor", sintoma: "Sin señal (0 mA o abierto)", causaProbable: "Pérdida de alimentación 24VDC", resolucionSugerida: "Verificar alimentación en bornes del transmisor. Revisar fusibles y fuente.", tiempoEstimadoHrs: 1, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Transmisor", sintoma: "Sin señal (0 mA o abierto)", causaProbable: "Falla electrónica interna", resolucionSugerida: "Intentar reset de fábrica. Si persiste, reemplazar tarjeta electrónica o equipo.", tiempoEstimadoHrs: 4, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Transmisor", sintoma: "Lectura errática o inestable", causaProbable: "Ruido eléctrico en el lazo", resolucionSugerida: "Verificar apantallamiento del cable. Separar de cables de potencia. Agregar filtro RC.", tiempoEstimadoHrs: 2, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Transmisor", sintoma: "Lectura errática o inestable", causaProbable: "Obstrucción en toma de presión o proceso", resolucionSugerida: "Purgar impulso. Verificar que no haya burbujas, cristalización o sólidos en la toma.", tiempoEstimadoHrs: 1.5, activo: true, creadoPor: ADMIN_ID },
    // Motores Eléctricos
    { tipoEquipo: "Motor Eléctrico", sintoma: "Motor no arranca", causaProbable: "Pérdida de fase en alimentación", resolucionSugerida: "Verificar tensión en las 3 fases en bornes del motor. Revisar contactor y protecciones.", tiempoEstimadoHrs: 1.5, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Motor Eléctrico", sintoma: "Motor no arranca", causaProbable: "Sobrecarga térmica disparada", resolucionSugerida: "Resetear relé de sobrecarga. Verificar la causa del disparo antes de rearrancar.", tiempoEstimadoHrs: 1, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Motor Eléctrico", sintoma: "Temperatura elevada", causaProbable: "Ventilación bloqueada o filtros tapados", resolucionSugerida: "Limpiar ventilador y filtros. Verificar espacio libre alrededor del motor.", tiempoEstimadoHrs: 2, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Motor Eléctrico", sintoma: "Vibración excesiva", causaProbable: "Desbalanceo en rodete o acoplamiento", resolucionSugerida: "Medir vibración con analizador. Realizar balanceo dinámico o revisar acoplamiento.", tiempoEstimadoHrs: 4, activo: true, creadoPor: ADMIN_ID },
    // Válvulas
    { tipoEquipo: "Válvula", sintoma: "Válvula no responde a señal", causaProbable: "Posicionador sin señal de entrada", resolucionSugerida: "Verificar señal 4-20mA en posicionador. Revisar lazo de control desde DCS.", tiempoEstimadoHrs: 1, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Válvula", sintoma: "Válvula no responde a señal", causaProbable: "Falla en actuador neumático (sin aire)", resolucionSugerida: "Verificar presión de suministro de aire (≥60 PSI). Revisar electroválvula solenoidea.", tiempoEstimadoHrs: 2, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: "Válvula", sintoma: "Fuga por empaquetadura", causaProbable: "Empaquetadura desgastada", resolucionSugerida: "Ajustar prensaestopas. Si persiste, reemplazar empaquetadura con equipo fuera de servicio.", tiempoEstimadoHrs: 3, activo: true, creadoPor: ADMIN_ID },
    // Genéricos (aplican a cualquier tipo)
    { tipoEquipo: null, sintoma: "Comunicación HART/PROFIBUS perdida", causaProbable: "Terminación de bus incorrecta", resolucionSugerida: "Verificar terminadores en ambos extremos del bus. Revisar resistencia del lazo.", tiempoEstimadoHrs: 1, activo: true, creadoPor: ADMIN_ID },
    { tipoEquipo: null, sintoma: "Comunicación HART/PROFIBUS perdida", causaProbable: "Dirección de red duplicada", resolucionSugerida: "Auditar todas las direcciones del segmento. Asignar dirección única al equipo.", tiempoEstimadoHrs: 1.5, activo: true, creadoPor: ADMIN_ID },
  ];

  for (const entry of arbolData) {
    await ArbolFallas.updateOne(
      { tipoEquipo: entry.tipoEquipo, sintoma: entry.sintoma, causaProbable: entry.causaProbable },
      { $setOnInsert: entry },
      { upsert: true }
    );
  }

  return Response.json({
    ok: true,
    message: "Datos de desarrollo insertados correctamente",
    counts: {
      areas: areasData.length,
      usuarios: usersData.length,
      equipos: equiposData.length,
      arbolFallas: arbolData.length,
    },
  });
}
