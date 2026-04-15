import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence, LayoutGroup, useInView } from "framer-motion";
import * as THREE from "three";
import { PRICING_PLANS, displayPriceUsd, summaryHref, type BillingCycle } from "../data/pricingPlans";

// ─── Three.js particle network ────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 280;

    // Particles
    const COUNT = reducedMotion ? 48 : Math.min(175, Math.round(110 + (canvas.clientWidth / 900) * 65));
    const positions: THREE.Vector3[] = [];
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < COUNT; i++) {
      positions.push(new THREE.Vector3(
        (Math.random() - 0.5) * 600,
        (Math.random() - 0.5) * 380,
        (Math.random() - 0.5) * 120
      ));
      vels.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.22,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.08
      ));
    }

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(COUNT * 3);
    positions.forEach((p, i) => { posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z; });
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xb8a8ff,
      size: reducedMotion ? 2.2 : 2.55,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Lines geometry (dynamic)
    const lineGeo = new THREE.BufferGeometry();
    const maxLines = COUNT * COUNT;
    const linePos = new Float32Array(maxLines * 6);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x7c6ae8, transparent: true, opacity: 0.16 }));
    scene.add(lineMat);

    // Mouse influence
    let mouseX = 0, mouseY = 0;
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 1.6;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 1.2;
    };
    if (!reducedMotion) window.addEventListener("mousemove", onMouse);

    let frame = 0;
    let raf: number | undefined;
    const DIST_THRESHOLD = reducedMotion ? 95 : 118;

    const rebuildLines = () => {
      let lIdx = 0;
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const d = positions[i].distanceTo(positions[j]);
          if (d < DIST_THRESHOLD) {
            linePos[lIdx++] = positions[i].x; linePos[lIdx++] = positions[i].y; linePos[lIdx++] = positions[i].z;
            linePos[lIdx++] = positions[j].x; linePos[lIdx++] = positions[j].y; linePos[lIdx++] = positions[j].z;
          }
        }
      }
      lineGeo.setDrawRange(0, lIdx / 3);
      lineGeo.attributes.position.needsUpdate = true;
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      frame++;

      if (!reducedMotion) {
        for (let i = 0; i < COUNT; i++) {
          positions[i].add(vels[i]);
          if (Math.abs(positions[i].x) > 310) vels[i].x *= -1;
          if (Math.abs(positions[i].y) > 200) vels[i].y *= -1;
          if (Math.abs(positions[i].z) > 65) vels[i].z *= -1;
          posArr[i * 3] = positions[i].x;
          posArr[i * 3 + 1] = positions[i].y;
          posArr[i * 3 + 2] = positions[i].z;
        }
        geo.attributes.position.needsUpdate = true;

        if (frame % 2 === 0) rebuildLines();

        (lineMat.material as THREE.LineBasicMaterial).opacity = 0.09 + 0.09 * Math.sin(frame * 0.028);
        camera.position.x += (mouseX * 22 - camera.position.x) * 0.028;
        camera.position.y += (-mouseY * 14 - camera.position.y) * 0.028;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      rebuildLines();
      renderer.render(scene, camera);
    } else {
      animate();
    }

    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

// ─── Shared fade-up animation variant ────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } }
};
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const HERO_VERBS = ["transforma", "blinda", "eleva", "moderniza"] as const;

function HeroRotatingVerb() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % HERO_VERBS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ display: "inline-block", minWidth: "min(5.5ch, 38vw)", textAlign: "center" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={HERO_VERBS[idx]}
          className="landing-gradient-text-animated"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-block" }}
        >
          {HERO_VERBS[idx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function LandingMarquee() {
  const phrases = [
    "Quórum verificado en vivo",
    "Votación trazable",
    "Actas asistidas por IA",
    "Poderes sin papel",
    "Experiencia broadcast 16∶9",
    "Ley 1581 · trazabilidad"
  ];
  const track = [...phrases, ...phrases];
  return (
    <div className="landing-marquee" aria-hidden>
      <div className="landing-marquee__track">
        {track.map((text, i) => (
          <span key={`${text}-${i}`} className="landing-marquee__item">
            {text}
            <span className="landing-marquee__dot">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Animated process pipeline (SVG + motion) ─────────────────────────────────

function ProcessPipeline() {
  const nodes = [
    { x: 120, title: "Prepara", sub: "Datos + agenda + convocatoria", color: "#8B7FE8", delay: 0 },
    { x: 440, title: "Ejecuta", sub: "Sala + quórum + votos", color: "#6258C4", delay: 0.2 },
    { x: 760, title: "Cierra", sub: "Acta + trazabilidad", color: "#4CAF72", delay: 0.4 }
  ];
  const R = 38;
  return (
    <div style={{ margin: "0 auto 48px", maxWidth: 920 }}>
      <svg viewBox="0 0 880 100" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} aria-hidden>
        <defs>
          <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B7FE8" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#6258C4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4CAF72" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <line x1={120 + R} y1="50" x2={440 - R} y2="50" stroke="url(#pipeGrad)" strokeWidth="2" className="landing-pipeline-dashed" />
        <line x1={440 + R} y1="50" x2={760 - R} y2="50" stroke="url(#pipeGrad)" strokeWidth="2" className="landing-pipeline-dashed" style={{ animationDelay: "-0.6s" }} />
        {nodes.map((n, i) => (
          <g key={n.title}>
            <circle cx={n.x} cy="50" r="38" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx={n.x} cy="50" r="30" fill="none" stroke={n.color} strokeWidth="1.5" opacity="0.5" className={i === 0 ? "landing-node-ring" : i === 1 ? "landing-node-ring landing-node-ring-delay-1" : "landing-node-ring landing-node-ring-delay-2"} />
            <text x={n.x} y="46" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700" style={{ letterSpacing: "0.12em" }}>{`0${i + 1}`}</text>
            <text x={n.x} y="62" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="500">FASE</text>
          </g>
        ))}
      </svg>
      <div className="landing-pipeline-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 8 }}>
        {nodes.map((n, i) => (
          <motion.div
            key={n.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: n.delay, duration: 0.5 }}
            style={{ textAlign: "center", padding: "14px 12px", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: n.color, marginBottom: 6 }}>{n.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{n.sub}</div>
          </motion.div>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 16, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
        El flujo de datos es lineal: cada fase alimenta la siguiente. Nada se pierde entre correos ni versiones de Excel.
      </p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

const faqItems = [
  {
    q: "¿Kuoro cumple con la Ley 1581 de protección de datos en Colombia?",
    a: "Sí. La plataforma está diseñada para tratamiento de datos personales bajo consentimiento, finalidad específica y medidas de seguridad. Puedes adjuntar políticas de privacidad y términos adaptados a tu copropiedad. Para implementaciones enterprise ofrecemos anexos legales revisables con tu abogado."
  },
  {
    q: "¿Los propietarios necesitan instalar una aplicación?",
    a: "No. Reciben un enlace seguro por correo (o WhatsApp si lo configuras) y acceden desde el navegador. La experiencia está optimizada para móvil y escritorio."
  },
  {
    q: "¿Qué pasa si un propietario no tiene correo electrónico?",
    a: "Puedes marcar convocatoria manual, registrar asistencia alternativa y usar validación por documento. El administrador siempre tiene visibilidad de quién falta por contacto."
  },
  {
    q: "¿Las votaciones tienen valor legal?",
    a: "Kuoro registra porcentajes, momento exacto de cierre, reglas aplicadas (simple, dos tercios, etc.) y participantes. La validez jurídica depende del reglamento de propiedad horizontal y de la asamblea; la plataforma entrega trazabilidad y evidencia digital para respaldar el acta."
  },
  {
    q: "¿Puedo usar Zoom o Meet en lugar de la sala integrada?",
    a: "Sí. Puedes enlazar una videollamada externa mientras gestionas quórum, diapositivas y votación dentro de Kuoro. La sala integrada (Kuoro Live) está en roadmap para planes superiores."
  },
  {
    q: "¿Cómo migro desde Excel o desde otro software?",
    a: "Importación asistida de unidades y propietarios, plantillas por tipo de conjunto (torres, manzanas, mixtos) y soporte en planes Profesional y Empresarial para acompañarte en la primera carga."
  }
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="landing-faq-glow" style={{ padding: "88px 40px", backgroundColor: "rgba(0,0,0,0.25)", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B7FE8", marginBottom: 12 }}>Preguntas frecuentes</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>
            Transparencia antes del clic
          </h2>
        </motion.div>
        <LayoutGroup>
          {faqItems.map((item, i) => {
            const open = openIdx === i;
            return (
              <motion.div
                key={item.q}
                layout
                style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  style={{
                    width: "100%", textAlign: "left", padding: "18px 0", background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, color: "#fff"
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.45 }}>{item.q}</span>
                  <motion.span animate={{ rotate: open ? 45 : 0 }} style={{ fontSize: 20, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>+</motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}
                      style={{ overflow: "hidden" }}
                    >
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, margin: "0 0 20px", paddingRight: 28 }}>
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </LayoutGroup>
      </div>
    </section>
  );
}

// ─── Power features (landing) — hierarchy + impact copy ───────────────────────

type PowerTier = "spotlight" | "standard" | "ai";

type PowerFeature = {
  id: string;
  powerTag: string;
  title: string;
  impact: string;
  desc: string;
  kind: "prep" | "sala" | "vote" | "poder" | "quorum" | "ai";
  tier: PowerTier;
  pills: string[];
};

const powerFeatures: PowerFeature[] = [
  {
    id: "sala",
    powerTag: "Núcleo de la experiencia",
    title: "Sala de asamblea virtual",
    impact: "Un solo lienzo para que administradores y propietarios vean exactamente lo mismo: diapositivas, quórum y resultados.",
    desc: "Canvas 16:9, pantalla compartida, cámara del moderador y control del flujo desde un panel profesional. Nada queda fuera de cámara.",
    kind: "sala",
    tier: "spotlight",
    pills: ["16:9 broadcast", "Quórum en vivo", "Pantalla compartida", "Un panel de mando"]
  },
  {
    id: "prep",
    powerTag: "Orquestación previa",
    title: "Preparación completa",
    impact: "Todo lo que necesitas antes de abrir micrófono: copropiedad, unidades, agenda y convocatoria en un solo hub.",
    desc: "Coeficientes, propietarios, orden del día y anexos sin planillas paralelas ni correos que nadie encuentra.",
    kind: "prep",
    tier: "standard",
    pills: ["1 hub", "Plantillas por tipo de conjunto", "Estado de alistamiento"]
  },
  {
    id: "vote",
    powerTag: "Decisión con respaldo",
    title: "Votaciones con trazabilidad",
    impact: "Cada punto del orden del día puede cerrarse con porcentajes, regla aplicada y veredicto visible para todos.",
    desc: "Abre y cierra votaciones por ítem. Resultados en pantalla, auditables y listos para el acta.",
    kind: "vote",
    tier: "standard",
    pills: ["Simple / ⅔ / unanimidad", "Registro de cierre", "Historial por asamblea"]
  },
  {
    id: "poder",
    powerTag: "Representación legal",
    title: "Gestión de poderes",
    impact: "El propietario sube su poder por enlace único; tú apruebas o rechazas con trazabilidad y sin carpetas físicas.",
    desc: "Menos fricción en convocatoria: sabes quién puede votar y con qué respaldo antes de iniciar la sesión.",
    kind: "poder",
    tier: "standard",
    pills: ["Enlace único", "Estados de revisión", "Cero papel"]
  },
  {
    id: "quorum",
    powerTag: "Visibilidad operativa",
    title: "Quórum proyectado en vivo",
    impact: "Antes y durante la asamblea ves cuántas unidades tienen representante válido y qué falta para alcanzar el mínimo.",
    desc: "Dejas de adivinar en salas llenas de dudas: el porcentaje se actualiza con la realidad de asistencia y poderes.",
    kind: "quorum",
    tier: "standard",
    pills: ["Antes del inicio", "En curso", "Por coeficiente o unidad"]
  },
  {
    id: "ai",
    powerTag: "Diferencial competitivo",
    title: "Asistente IA integrado",
    impact: "Tu equipo legal y administrativo gana velocidad: redacción, resúmenes y acta sin empezar desde cero.",
    desc: "Convocatorias, sugerencias de orden del día, acta preliminar al cierre y respuestas contextualizadas sobre el reglamento.",
    kind: "ai",
    tier: "ai",
    pills: ["Acta asistida", "Convocatoria en minutos", "Copiloto del moderador", "Planes Pro+"]
  }
];

const FG_CAPTIONS: Record<PowerFeature["kind"], string> = {
  sala: "La miniatura es la cámara del moderador; el lienzo es lo que todos ven a la vez.",
  prep: "Cada requisito queda marcado en el mismo hub: nada se pierde entre correos y versiones.",
  vote: "Abres, recibes votos y cierras: el veredicto queda visible para todos con porcentajes.",
  poder: "El propietario sube una vez; tú registras el veredicto sin carpetas físicas.",
  quorum: "El indicador refleja representación válida en tiempo real, antes y durante la sesión.",
  ai: "La IA propone texto legal; tú revisas, ajustas y publicas con trazabilidad."
};

const SALA_SLIDES = [
  { title: "Punto 3 · Presupuesto", sub: "Mismas cifras y gráficos para quien está en sala y quien entra desde casa." },
  { title: "Quórum en vivo", sub: "El porcentaje se actualiza en el mismo lienzo 16∶9 para todos los asistentes." }
];

/** Punto 1 — Sala: lienzo + miniatura de cámara del moderador (interactivo, demo). */
function FeatureSalaGraphic({ active }: { active: boolean }) {
  const [camOn, setCamOn] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);
  const onClass = active ? " landing-feature-graph--on" : "";

  return (
    <div className={`landing-feature-graph landing-feature-graph--sala${onClass}`}>
      <div className="landing-fg-sala">
        <div className="landing-fg-sala__sync" aria-hidden>
          <span className="landing-fg-sala__pill">Admin</span>
          <span className="landing-fg-sala__sync-line" />
          <span className="landing-fg-sala__pill">Propietarios</span>
        </div>
        <p className="landing-fg-interactive-hint">Toca la miniatura para apagar o encender la cámara · clic en el lienzo para cambiar de diapositiva</p>

        <div className="landing-fg-sala__screen">
          <button
            type="button"
            className="landing-fg-sala__deck"
            onClick={() => setSlideIdx((i) => (i + 1) % SALA_SLIDES.length)}
            aria-label="Siguiente diapositiva, demostración de sala virtual"
          >
            {SALA_SLIDES.map((s, i) => (
              <div
                key={s.title}
                className={`landing-fg-sala__slide-card${i === slideIdx ? " landing-fg-sala__slide-card--active" : ""}`}
              >
                <span className="landing-fg-sala__slide-kicker">Diapositiva {i + 1} de {SALA_SLIDES.length}</span>
                <strong className="landing-fg-sala__slide-title">{s.title}</strong>
                <span className="landing-fg-sala__slide-sub">{s.sub}</span>
              </div>
            ))}
            <span className="landing-fg-sala__deck-chip" aria-hidden>Clic → siguiente</span>
          </button>

          <button
            type="button"
            className={`landing-fg-sala__pip${camOn ? "" : " landing-fg-sala__pip--muted"}`}
            onClick={(e) => {
              e.stopPropagation();
              setCamOn((v) => !v);
            }}
            aria-pressed={camOn}
            aria-label={camOn ? "Apagar cámara del moderador (demostración)" : "Encender cámara del moderador (demostración)"}
          >
            <div className="landing-fg-sala__pip-frame">
              <div className="landing-fg-sala__pip-video" aria-hidden />
              {camOn && (
                <div className="landing-fg-sala__pip-bars" aria-hidden>
                  {[0, 1, 2, 3, 4].map((b) => (
                    <span key={b} className="landing-fg-sala__pip-bar" style={{ animationDelay: `${b * 0.08}s` }} />
                  ))}
                </div>
              )}
              {!camOn && (
                <div className="landing-fg-sala__pip-cover" aria-hidden>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="landing-fg-sala__pip-svg">
                    <path d="M15 10l4-2v10l-4-2v-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M4 8h7v8H4V8z" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 20L20 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span className="landing-fg-sala__pip-off-label">Cámara off</span>
                </div>
              )}
            </div>
            <span className="landing-fg-sala__pip-caption">Moderador/a</span>
          </button>

          <div className="landing-fg-sala__hud" aria-hidden>
            <span className="landing-fg-sala__live" />
            En vivo · mismo lienzo para todos
          </div>
        </div>
        <p className="landing-fg-caption">{FG_CAPTIONS.sala}</p>
      </div>
    </div>
  );
}

const PREP_ITEMS = [
  "Unidades + coeficientes cargados",
  "Orden del día publicado",
  "Convocatoria lista para enviar"
];

/** Punto 2 — Preparación: checklist interactivo en el hub. */
function FeaturePrepGraphic({ active }: { active: boolean }) {
  const [done, setDone] = useState([false, false, false]);
  const onClass = active ? " landing-feature-graph--on" : "";

  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)));
  const allDone = done.every(Boolean);

  return (
    <div className={`landing-feature-graph landing-feature-graph--prep${onClass}`}>
      <div className="landing-fg-prep">
        <p className="landing-fg-interactive-hint">Toca cada fila para marcar listo · “Todo listo” marca el hub de una vez</p>
        <div className="landing-fg-prep__hub">
          <div className="landing-fg-prep__hub-title">Hub de asamblea</div>
          {PREP_ITEMS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`landing-fg-prep__row${done[i] ? " landing-fg-prep__row--done" : ""}`}
              onClick={() => toggle(i)}
              aria-pressed={done[i]}
              aria-label={`${done[i] ? "Desmarcar" : "Marcar"}: ${label} (demostración)`}
            >
              <span className="landing-fg-prep__chk" aria-hidden />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="landing-fg-prep__all"
            onClick={() => setDone([true, true, true])}
            aria-label="Marcar todos los ítems del hub como listos (demostración)"
          >
            Todo listo
          </button>
          {allDone && <div className="landing-fg-prep__toast" role="status">Listo para convocar</div>}
        </div>
        <div className="landing-fg-prep__orbit" aria-hidden />
        <p className="landing-fg-caption">{FG_CAPTIONS.prep}</p>
      </div>
    </div>
  );
}

/** Punto 3 — Votación: simular apertura y cierre con resultado. */
function FeatureVoteGraphic({ active }: { active: boolean }) {
  const [closed, setClosed] = useState(false);
  const onClass = active ? " landing-feature-graph--on" : "";

  return (
    <div className={`landing-feature-graph landing-feature-graph--vote${onClass}`}>
      <div className="landing-fg-vote">
        <p className="landing-fg-interactive-hint">Clic en el botón para pasar de “votación abierta” a “cerrada con resultado”</p>
        <div className={`landing-fg-vote__board${closed ? " landing-fg-vote__board--closed" : ""}`}>
          <span className="landing-fg-vote__q">¿Aprueba el punto 3 — presupuesto?</span>
          {!closed ? (
            <div className="landing-fg-vote__live">
              <span className="landing-fg-vote__pulse" aria-hidden />
              <span>Recibiendo votos en vivo…</span>
            </div>
          ) : (
            <>
              <div className="landing-fg-vote__donut-wrap">
                <div className="landing-fg-vote__donut" />
                <svg className="landing-fg-vote__check" viewBox="0 0 48 48" fill="none" aria-hidden>
                  <path className="landing-fg-vote__check-path" d="M12 24l8 8 16-16" stroke="#4CAF72" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="landing-fg-vote__split">
                <span className="landing-fg-vote__favor">72% a favor</span>
                <span className="landing-fg-vote__contra">28% en contra</span>
              </div>
            </>
          )}
          <button
            type="button"
            className="landing-fg-vote__cta"
            onClick={() => setClosed((c) => !c)}
            aria-label={closed ? "Volver a simular votación abierta (demostración)" : "Simular cierre de votación con resultado (demostración)"}
          >
            {closed ? "↺ Volver a abrir" : "Cerrar votación (demo)"}
          </button>
        </div>
        <p className="landing-fg-caption">{FG_CAPTIONS.vote}</p>
      </div>
    </div>
  );
}

/** Punto 4 — Poderes: simular carga y veredicto del admin. */
function FeaturePoderGraphic({ active }: { active: boolean }) {
  const [uploaded, setUploaded] = useState(false);
  const [verdict, setVerdict] = useState<"none" | "ok" | "no">("none");
  const onClass = active ? " landing-feature-graph--on" : "";

  return (
    <div className={`landing-feature-graph landing-feature-graph--poder${onClass}`}>
      <div className="landing-fg-poder">
        <p className="landing-fg-interactive-hint">Primero “Simular carga”; luego elige aprobar o rechazar como haría el administrador</p>
        <div className="landing-fg-poder__cols">
          <div className="landing-fg-poder__col">
            <button
              type="button"
              className={`landing-fg-poder__upload${uploaded ? " landing-fg-poder__upload--done" : ""}`}
              onClick={() => {
                setUploaded(true);
                setVerdict("none");
              }}
              aria-label="Simular carga de poder desde el enlace del propietario (demostración)"
            >
              {uploaded ? "Poder recibido.pdf" : "Simular carga de poder"}
            </button>
            <div className="landing-fg-poder__arrow" aria-hidden />
          </div>
          <div className="landing-fg-poder__col landing-fg-poder__col--admin">
            <div className="landing-fg-poder__inbox">Tu revisión</div>
            <div className="landing-fg-poder__actions">
              <button
                type="button"
                className="landing-fg-poder__btn landing-fg-poder__btn--ok"
                disabled={!uploaded}
                onClick={() => setVerdict("ok")}
                aria-label="Aprobar poder (demostración)"
              >
                Aprobar
              </button>
              <button
                type="button"
                className="landing-fg-poder__btn landing-fg-poder__btn--no"
                disabled={!uploaded}
                onClick={() => setVerdict("no")}
                aria-label="Rechazar poder (demostración)"
              >
                Rechazar
              </button>
            </div>
            {verdict === "ok" && <div className="landing-fg-poder__stamp landing-fg-poder__stamp--ok">Aprobado</div>}
            {verdict === "no" && <div className="landing-fg-poder__stamp landing-fg-poder__stamp--no">Rechazado</div>}
          </div>
        </div>
        <button type="button" className="landing-fg-poder__reset" onClick={() => { setUploaded(false); setVerdict("none"); }} aria-label="Reiniciar demostración de poderes">
          Reiniciar demo
        </button>
        <p className="landing-fg-caption">{FG_CAPTIONS.poder}</p>
      </div>
    </div>
  );
}

/** Punto 5 — Quórum (métrica): ajustar representación con + / −. */
function FeatureQuorumGraphic({ active }: { active: boolean }) {
  const [pct, setPct] = useState(38);
  const onClass = active ? " landing-feature-graph--on" : "";

  useEffect(() => {
    if (active) setPct(42);
  }, [active]);

  const meta = 50;
  const fillScale = Math.min(1, pct / 100);

  return (
    <div className={`landing-feature-graph landing-feature-graph--quorum${onClass}`}>
      <div className="landing-fg-quorum">
        <p className="landing-fg-interactive-hint">+ y − simulan cómo sube o baja la representación válida (asistencia + poderes)</p>
        <div className="landing-fg-quorum__pct" aria-live="polite">{pct}%</div>
        <div className="landing-fg-quorum__track">
          <div
            className="landing-fg-quorum__fill"
            style={{ transform: `scaleX(${fillScale})` }}
          />
            <div
              className={`landing-fg-quorum__ghost${pct >= meta ? " landing-fg-quorum__ghost--visible" : ""}`}
              style={{ left: `${meta}%`, transform: "translateX(-50%)" }}
              aria-hidden
            />
        </div>
        <div className="landing-fg-quorum__ticks">
          <span>0%</span>
          <span>meta {meta}%</span>
          <span>100%</span>
        </div>
        <div className="landing-fg-quorum__controls">
          <button type="button" className="landing-fg-quorum__step" onClick={() => setPct((p) => Math.max(18, p - 8))} aria-label="Disminuir representación simulada (demostración)">−</button>
          <button type="button" className="landing-fg-quorum__step" onClick={() => setPct((p) => Math.min(100, p + 8))} aria-label="Aumentar representación simulada (demostración)">+</button>
        </div>
        {pct >= meta && <p className="landing-fg-quorum__badge" role="status">Meta alcanzada</p>}
        <p className="landing-fg-caption">{FG_CAPTIONS.quorum}</p>
      </div>
    </div>
  );
}

const AI_PREVIEW_LINES = [
  "ACTA ORDINARIA — extracto generado",
  "Asistentes: 47 unidades representadas (68,4% coeficiente).",
  "Punto 3: aprobado por mayoría simple con 72% a favor.",
  "Se deja constancia de votación digital con trazabilidad."
];

/** Punto 6 — IA: generar y reiniciar borrador. */
function FeatureAiGraphic({ active }: { active: boolean }) {
  const [lines, setLines] = useState(0);
  const timerRef = useRef<number | null>(null);
  const onClass = active ? " landing-feature-graph--on" : "";

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const generate = () => {
    clearTimer();
    setLines(0);
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      setLines(i);
      if (i >= AI_PREVIEW_LINES.length) clearTimer();
    }, 520);
  };

  return (
    <div className={`landing-feature-graph landing-feature-graph--ai${onClass}`}>
      <div className="landing-fg-ai">
        <p className="landing-fg-interactive-hint">“Generar borrador” simula cómo la IA rellena el acta; “Reiniciar” vuelve a empezar</p>
        <div className="landing-fg-ai__doc">
          {AI_PREVIEW_LINES.slice(0, lines).map((line, idx) => (
            <p key={idx} className="landing-fg-ai__preview-line">{line}</p>
          ))}
          {lines === 0 && <div className="landing-fg-ai__placeholder">Pulsa generar para ver un extracto de acta…</div>}
          <div className="landing-fg-ai__badge">IA</div>
        </div>
        <div className="landing-fg-ai__glow" aria-hidden />
        <div className="landing-fg-ai__toolbar">
          <button type="button" className="landing-fg-ai__gen" onClick={generate} aria-label="Generar borrador de acta con IA (demostración)">
            Generar borrador
          </button>
          <button type="button" className="landing-fg-ai__reset" onClick={() => { clearTimer(); setLines(0); }} aria-label="Reiniciar vista del borrador (demostración)">
            Reiniciar
          </button>
        </div>
        <p className="landing-fg-caption">{FG_CAPTIONS.ai}</p>
      </div>
    </div>
  );
}

/** Mini escena por punto: misma idea que Sala (pista + interacción demo + `active` por scroll). */
function FeatureMotionGraphic({ kind, active }: { kind: PowerFeature["kind"]; active: boolean }) {
  switch (kind) {
    case "sala":
      return <FeatureSalaGraphic active={active} />;
    case "prep":
      return <FeaturePrepGraphic active={active} />;
    case "vote":
      return <FeatureVoteGraphic active={active} />;
    case "poder":
      return <FeaturePoderGraphic active={active} />;
    case "quorum":
      return <FeatureQuorumGraphic active={active} />;
    case "ai":
      return <FeatureAiGraphic active={active} />;
    default:
      return null;
  }
}

function PowerFeatureStoryRow({ item, index, total }: { item: PowerFeature; index: number; total: number }) {
  const tier = item.tier;
  const step = String(index + 1).padStart(2, "0");
  const tot = String(total).padStart(2, "0");
  const articleRef = useRef<HTMLElement>(null);
  const graphicActive = useInView(articleRef, {
    once: true,
    amount: 0.08,
    margin: "18% 0px 18% 0px"
  });

  return (
    <motion.article
      ref={articleRef}
      className={`landing-feature-story landing-feature-story--${tier}`}
      initial={{ opacity: 0, y: 64 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="landing-feature-story__rail" aria-hidden />
      <header className="landing-feature-story__head">
        <span className="landing-feature-story__step" aria-hidden>
          {step}
          <small> / {tot}</small>
        </span>
        <span className="landing-feature-story__eyebrow">{item.powerTag}</span>
      </header>

      <div className="landing-feature-story__grid">
        <FeatureMotionGraphic kind={item.kind} active={graphicActive} />
        <div className="landing-feature-story__copy">
          <h3 className="landing-feature-story__title">{item.title}</h3>
          <p className="landing-feature-story__impact">{item.impact}</p>
          <p className="landing-feature-story__desc">{item.desc}</p>
          <motion.div
            className="landing-feature-story__pills"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } }
            }}
          >
            {item.pills.map((p) => (
              <motion.span
                key={p}
                className="landing-feature-story__pill"
                variants={{
                  hidden: { opacity: 0, x: -12 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
                }}
              >
                {p}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.article>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const stats = [
  { value: "100%", label: "Trazabilidad legal" },
  { value: "3×", label: "Más rápido que el método tradicional" },
  { value: "0", label: "Planillas de Excel" },
  { value: "∞", label: "Asambleas disponibles" }
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const [annualBilling, setAnnualBilling] = useState(false);
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ["rgba(6,4,15,0)", "rgba(6,4,15,0.92)"]);
  const navBlur = useTransform(scrollY, [0, 80], ["blur(0px)", "blur(16px)"]);
  const heroParticleOpacity = useTransform(scrollY, [0, 480], [1, 0.12]);

  return (
    <div className="landing-root" style={{ backgroundColor: "#06040F", color: "#FFFFFF", overflowX: "hidden" }}>

      {/* ── Sticky nav ── */}
      <motion.header
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 40px", height: 64,
          backgroundColor: navBg as any,
          backdropFilter: navBlur as any,
          borderBottom: "0.5px solid rgba(255,255,255,0.06)"
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #6258C4 0%, #9B7FE8 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.5" fill="white" opacity="0.9"/>
              <circle cx="2.5" cy="4" r="2" fill="white" opacity="0.5"/>
              <circle cx="13.5" cy="4" r="2" fill="white" opacity="0.5"/>
              <circle cx="2.5" cy="12" r="2" fill="white" opacity="0.5"/>
              <circle cx="13.5" cy="12" r="2" fill="white" opacity="0.5"/>
              <line x1="4.3" y1="5.1" x2="6.2" y2="6.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
              <line x1="11.7" y1="5.1" x2="9.8" y2="6.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
              <line x1="4.3" y1="10.9" x2="6.2" y2="9.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
              <line x1="11.7" y1="10.9" x2="9.8" y2="9.5" stroke="white" strokeWidth="0.8" opacity="0.4"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", background: "linear-gradient(90deg, #FFFFFF 0%, #9B7FE8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Kuoro
          </span>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          {[["Producto", "#features"], ["Precios", "#pricing"], ["Cómo funciona", "#how"], ["FAQ", "#faq"]].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "color 200ms" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              {label}
            </a>
          ))}
          <Link
            to="/contratar"
            style={{ fontSize: 13, color: "rgba(196,181,253,0.85)", textDecoration: "none", fontWeight: 600, transition: "color 200ms" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#E9D5FF")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(196,181,253,0.85)")}
          >
            Contratar
          </Link>
        </nav>

        {/* CTA */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/login-admin" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", padding: "6px 14px" }}>
            Ingresar
          </Link>
          <Link to="/contratar" style={{ fontSize: 13, fontWeight: 500, background: "linear-gradient(90deg, #6258C4 0%, #9B7FE8 100%)", color: "#fff", textDecoration: "none", padding: "7px 18px", borderRadius: 8, letterSpacing: "-0.01em" }}>
            Ver planes
          </Link>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section
        className="landing-hero"
        style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <motion.div
          style={{ position: "absolute", inset: 0, zIndex: 0, opacity: heroParticleOpacity }}
          aria-hidden
        >
          <ParticleCanvas />
        </motion.div>

        <div className="landing-hero__mesh" aria-hidden>
          <div className="landing-hero__blob landing-hero__blob--1" />
          <div className="landing-hero__blob landing-hero__blob--2" />
          <div className="landing-hero__blob landing-hero__blob--3" />
        </div>
        <div className="landing-hero__grid" aria-hidden />
        <div className="landing-hero__ring" aria-hidden />
        <div className="landing-hero__ring landing-hero__ring--2" aria-hidden />
        <div className="landing-hero__noise" aria-hidden />
        <div className="landing-hero__vignette" aria-hidden />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 3, textAlign: "center", padding: "0 24px", maxWidth: 920, margin: "0 auto" }}>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px 6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(139,127,232,0.35)",
              background: "linear-gradient(135deg, rgba(98,88,196,0.22), rgba(12,10,28,0.75))",
              boxShadow: "0 0 40px rgba(98,88,196,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
              marginBottom: 32
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: "linear-gradient(90deg, #8B7FE8, #C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Nuevo</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>Votación digital en tiempo real con IA</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{ fontSize: "clamp(36px, 5.8vw, 76px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.045em", margin: "0 0 22px" }}
          >
            La plataforma que <HeroRotatingVerb />
            <br />
            <span style={{ color: "rgba(255,255,255,0.92)" }}>tus asambleas</span>
            {" "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>de propiedad horizontal</span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 auto 36px", maxWidth: 600 }}
          >
            Convoca, gestiona y ejecuta asambleas con quórum verificado, votaciones digitales trazables y actas generadas por IA. Todo en una sola plataforma.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link to="/contratar"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 10, background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.02em", boxShadow: "0 0 40px rgba(98,88,196,0.4)" }}
            >
              Ver planes — prueba 14 días
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </Link>
            <a href="#how"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 500, textDecoration: "none", letterSpacing: "-0.02em", backgroundColor: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)" }}
            >
              Ver cómo funciona
            </a>
          </motion.div>

          {/* Trust strip */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 28 }}
          >
            Sin tarjeta de crédito · Configuración en 15 minutos · Cancelación en cualquier momento
          </motion.p>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
          style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 4 }}
        >
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>Explorar</span>
          <div style={{ width: 1, height: 44, background: "linear-gradient(to bottom, transparent, rgba(139,127,232,0.55))" }} />
        </motion.div>
      </section>

      <LandingMarquee />

      {/* ── Stats bar ── */}
      <section className="landing-stats-strip" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", padding: "36px 40px", backgroundColor: "rgba(255,255,255,0.025)" }}>
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 24, maxWidth: 900, margin: "0 auto" }}
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ textAlign: "center", padding: "8px 12px", borderRadius: 12 }}
            >
              <div style={{ fontSize: "clamp(32px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.04em", background: "linear-gradient(120deg, #dcd4ff, #8B7FE8, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.38)", marginTop: 6, maxWidth: 130, marginLeft: "auto", marginRight: "auto", lineHeight: 1.35 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Problem / Solution split ── */}
      <section style={{ padding: "100px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B7FE8", marginBottom: 12 }}>El problema</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.15 }}>
              Las asambleas de hoy son<br />
              <span style={{ color: "rgba(255,255,255,0.25)" }}>caóticas, inseguras y difíciles de probar.</span>
            </h2>
          </motion.div>

          <div className="landing-vs-wrap">
            <motion.div variants={fadeUp} className="landing-problem-scan" style={{ padding: 32, borderRadius: 18, border: "0.5px solid rgba(220,38,38,0.22)", background: "linear-gradient(165deg, rgba(220,38,38,0.07) 0%, rgba(12,8,18,0.5) 100%)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#EF4444", textTransform: "uppercase", marginBottom: 16 }}>Para el administrador</div>
              {["Planillas de Excel imposibles de actualizar", "Quórum incierto hasta el último minuto", "Votaciones sin trazabilidad legal", "Actas redactadas a mano, días después", "Poderes en papel que se pierden o falsifican"].map((p) => (
                <div key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ color: "#EF4444", fontSize: 16, lineHeight: 1.4 }}>×</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </motion.div>

            <div className="landing-vs-badge" aria-hidden>VS</div>

            <motion.div variants={fadeUp} style={{ padding: 32, borderRadius: 18, border: "0.5px solid rgba(98,88,196,0.35)", background: "linear-gradient(165deg, rgba(98,88,196,0.12) 0%, rgba(10,8,22,0.65) 100%)", position: "relative", overflow: "hidden", boxShadow: "0 0 60px rgba(98,88,196,0.08)" }}>
              <div style={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,127,232,0.2) 0%, transparent 68%)" }} />
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#8B7FE8", textTransform: "uppercase", marginBottom: 16 }}>Con Kuoro</div>
              {["Gestión centralizada en tiempo real", "Quórum calculado automáticamente", "Votaciones digitales firmadas y auditables", "Acta generada por IA al cerrar la sesión", "Poderes digitales con estado de aprobación"].map((p) => (
                <div key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ color: "#4CAF72", fontSize: 16, lineHeight: 1.4 }}>✓</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Features bento ── */}
      <section id="features" style={{ position: "relative", padding: "80px 40px 100px", backgroundColor: "rgba(255,255,255,0.015)" }}>
        <div className="landing-features-rail" aria-hidden />
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B7FE8", marginBottom: 12 }}>Todo en uno</div>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 14px" }}>
                Una plataforma. Cero fricciones.
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>
                Baja despacio: cada capacidad cobra vida cuando entra en pantalla — ilustración, texto y detalles en secuencia.
              </p>
            </motion.div>

            <div className="landing-feature-storylist">
              {powerFeatures.map((item, index) => (
                <PowerFeatureStoryRow key={item.id} item={item} index={index} total={powerFeatures.length} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ padding: "100px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B7FE8", marginBottom: 12 }}>El proceso</div>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>
                De cero a asamblea<br />en 3 pasos
              </h2>
            </motion.div>

            <ProcessPipeline />

            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 20 }}>DETALLE POR ROL</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                {
                  n: "01", title: "Prepara en minutos",
                  desc: "Registra tu copropiedad, carga las unidades y propietarios, configura la agenda con diapositivas, gestiona poderes y programa la convocatoria automática.",
                  forWho: "Administrador",
                  color: "#8B7FE8"
                },
                {
                  n: "02", title: "Ejecuta con control total",
                  desc: "Abre la sala virtual, verifica quórum en tiempo real, presenta el orden del día, abre y cierra votaciones, muestra resultados en pantalla. Todo desde un solo panel.",
                  forWho: "Administrador + Propietarios",
                  color: "#6258C4"
                },
                {
                  n: "03", title: "Cierra con respaldo legal",
                  desc: "Quórum final calculado, votaciones con porcentajes trazables, acta preliminar generada por IA lista para revisión y firma digital.",
                  forWho: "Toda la copropiedad",
                  color: "#4CAF72"
                }
              ].map((step, i) => (
                <motion.div
                  key={step.n}
                  variants={fadeUp}
                  style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 24, padding: "32px 0", borderBottom: i < 2 ? "0.5px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.05em", color: "rgba(255,255,255,0.06)", lineHeight: 1 }}>{step.n}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", margin: 0 }}>{step.title}</h3>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `0.5px solid ${step.color}40`, color: step.color, fontWeight: 600, letterSpacing: "0.04em" }}>{step.forWho}</span>
                    </div>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.7 }}>{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── For owners section ── */}
      <section style={{ padding: "80px 40px", backgroundColor: "rgba(255,255,255,0.015)", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <motion.div variants={fadeUp}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4CAF72", marginBottom: 14 }}>Para propietarios</div>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 16px", lineHeight: 1.2 }}>
                Participa sin importar dónde estés
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, margin: "0 0 28px" }}>
                Recibe tu convocatoria por email, ingresa con tu enlace único, sigue la presentación en tiempo real, y vota digitalmente. Sin aplicaciones que instalar.
              </p>
              {["Enlace de acceso personal y seguro", "Visualización de diapositivas y resultados en vivo", "Votación digital con confirmación inmediata", "Certificado de participación descargable", "Gestión de tu poder de representación en línea"].map((f) => (
                <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "rgba(76,175,114,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#4CAF72" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{f}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Visual card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ position: "relative" }}
          >
            <div style={{ padding: 24, borderRadius: 16, border: "0.5px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontWeight: 600, letterSpacing: "0.04em" }}>ASAMBLEA ORDINARIA 2025 · EN CURSO</div>
              <div style={{ padding: "16px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Punto 3 — Aprobación del presupuesto</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Quórum actual: 68.4% · 47/68 unidades representadas</div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>Votación activa: ¿Aprueba el presupuesto por $980M COP?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[["A favor", "61%", "#4CAF72"], ["En contra", "28%", "#EF4444"]].map(([l, v, c]) => (
                  <div key={l} style={{ padding: "12px 16px", borderRadius: 10, backgroundColor: `${c}15`, border: `0.5px solid ${c}40`, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 16px", borderRadius: 8, backgroundColor: "rgba(76,175,114,0.08)", border: "0.5px solid rgba(76,175,114,0.2)", textAlign: "center" }}>
                <span style={{ fontSize: 12, color: "#4CAF72", fontWeight: 600 }}>✓ Tu voto fue registrado — A favor</span>
              </div>
            </div>
            {/* Decorative glow */}
            <div style={{ position: "absolute", inset: -20, borderRadius: 24, background: "radial-gradient(circle at 50% 50%, rgba(98,88,196,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: "100px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B7FE8", marginBottom: 12 }}>Precios</div>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
                Transparente desde el primer día
              </h2>
              {/* Toggle */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "6px 8px", borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <button onClick={() => setAnnualBilling(false)} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, backgroundColor: !annualBilling ? "rgba(98,88,196,0.4)" : "transparent", color: !annualBilling ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 150ms" }}>
                  Mensual
                </button>
                <button onClick={() => setAnnualBilling(true)} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, backgroundColor: annualBilling ? "rgba(98,88,196,0.4)" : "transparent", color: annualBilling ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 150ms", display: "flex", alignItems: "center", gap: 6 }}>
                  Anual
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, backgroundColor: "rgba(76,175,114,0.2)", color: "#4CAF72", fontWeight: 600 }}>-20%</span>
                </button>
              </div>
            </motion.div>

            <div className="landing-pricing-stage">
              <div className="landing-pricing-stage__inner">
            <div className="landing-pricing-grid">
              {PRICING_PLANS.map((plan) => {
                const cycle: BillingCycle = annualBilling ? "annual" : "monthly";
                const price = displayPriceUsd(plan, cycle);
                const ctaTo = plan.salesAssisted ? "/contacto-ventas" : summaryHref(plan.id, cycle);
                return (
                  <motion.div
                    key={plan.id}
                    variants={fadeUp}
                    className="landing-pricing-card"
                    style={{
                      padding: 28, borderRadius: 18,
                      border: plan.highlight ? "0.5px solid rgba(139,127,232,0.55)" : "0.5px solid rgba(255,255,255,0.08)",
                      backgroundColor: plan.highlight ? "rgba(98,88,196,0.14)" : "rgba(255,255,255,0.03)",
                      position: "relative", overflow: "hidden"
                    }}
                  >
                    {plan.highlight && (
                      <>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #6258C4, #9B7FE8, #6258C4)" }} />
                        <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4, backgroundColor: "rgba(139,127,232,0.2)", color: "#C4B5FD" }}>MÁS POPULAR</div>
                      </>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: plan.highlight ? "#C4B5FD" : "rgba(255,255,255,0.5)", marginBottom: 6 }}>{plan.name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em" }}>{price}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 24, lineHeight: 1.5 }}>{plan.tagline}</div>

                    <Link to={ctaTo} style={{
                      display: "block", textAlign: "center", padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 24, letterSpacing: "-0.01em",
                      background: plan.highlight ? "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)" : "rgba(255,255,255,0.06)",
                      color: plan.highlight ? "#fff" : "rgba(255,255,255,0.7)",
                      border: plan.highlight ? "none" : "0.5px solid rgba(255,255,255,0.1)"
                    }}>
                      {plan.cta}
                    </Link>

                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {plan.features.map((f) => (
                        <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 1, flexShrink: 0 }}>
                            <circle cx="7" cy="7" r="6" fill={plan.highlight ? "rgba(139,127,232,0.2)" : "rgba(255,255,255,0.06)"}/>
                            <path d="M4 7l2 2 4-4" stroke={plan.highlight ? "#9B7FE8" : "rgba(255,255,255,0.35)"} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                          </svg>
                          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
              </div>
            </div>

            <motion.p variants={fadeUp} style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 28 }}>
              Precios en USD. Facturación disponible en COP. Incluye IVA según aplique. Datos almacenados en servidores con certificación SOC 2.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <FaqSection />

      {/* ── Final CTA ── */}
      <section style={{ padding: "100px 40px", position: "relative", overflow: "hidden" }}>
        <div className="landing-cta-aurora" aria-hidden />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(98,88,196,0.1) 0%, rgba(61,46,143,0.05) 50%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(98,88,196,0.14) 0%, transparent 70%)", filter: "blur(48px)" }} />

        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 680, margin: "0 auto" }}
        >
          <motion.h2 variants={fadeUp} style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", margin: "0 0 16px", lineHeight: 1.1 }}>
            Tu próxima asamblea,{" "}
            <span style={{ background: "linear-gradient(90deg, #8B7FE8, #C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              sin complicaciones
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", margin: "0 0 36px", lineHeight: 1.7 }}>
            Únete a las administradoras que ya transformaron su forma de gestionar asambleas. Empieza hoy, sin compromisos.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/contratar" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 32px", borderRadius: 10, background: "linear-gradient(135deg, #6258C4 0%, #8B7FE8 100%)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.02em", boxShadow: "0 0 50px rgba(98,88,196,0.35)" }}>
              Elegir plan y empezar
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 20 }}>
            14 días gratis · Sin tarjeta · Soporte humano incluido
          </motion.p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", padding: "40px 40px 32px", backgroundColor: "rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #6258C4 0%, #9B7FE8 100%)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>Kuoro</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.7, maxWidth: 240, margin: "0 0 16px" }}>
              La plataforma de asambleas de propiedad horizontal más avanzada de Latinoamérica.
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>© 2026 Kuoro. Todos los derechos reservados.</p>
          </div>
          {[
            {
              title: "Producto",
              links: [
                { label: "Características", href: "/#features" },
                { label: "Precios y planes", to: "/contratar" },
                { label: "Cómo funciona", href: "/#how" },
                { label: "Preguntas frecuentes", href: "/#faq" }
              ]
            },
            {
              title: "Legal",
              links: [
                { label: "Términos de uso", to: "/legal/terminos" },
                { label: "Privacidad", to: "/legal/privacidad" },
                { label: "Política de datos", href: "#" },
                { label: "Ley 1581", href: "#" }
              ]
            },
            {
              title: "Empresa",
              links: [
                { label: "Ventas — Empresarial", to: "/contacto-ventas" },
                { label: "Ingresar", to: "/login-admin" },
                { label: "Crear cuenta", to: "/registro-admin" },
                { label: "Soporte", href: "mailto:soporte@kuoro.io" }
              ]
            }
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>{col.title}</div>
              {col.links.map((l) => (
                <div key={l.label} style={{ marginBottom: 10 }}>
                  {"to" in l && l.to ? (
                    <Link
                      to={l.to}
                      style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={"href" in l ? l.href : "#"}
                      style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                    >
                      {l.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
