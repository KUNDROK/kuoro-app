/**
 * Tests de la lógica de seguridad de LiveKit.
 *
 * Estrategia: testear grantsForRole directamente (función pura) en vez de
 * mockear el constructor AccessToken. Esto es más fiable y más rápido.
 *
 * Cobertura:
 * - buildRoomName: unicidad, determinismo, aislamiento multi-tenant
 * - grantsForRole admin: permisos completos + screen share + roomAdmin
 * - grantsForRole attendee: solo suscripción, canPublish=false, sources vacías
 * - grantsForRole speaker: mic sin screen share, no roomAdmin
 * - Separación admin/speaker: no interfieren entre sí
 * - Privilegio mínimo: attendee ≠ speaker ≠ admin
 */

import { describe, it, expect } from "vitest";

// Importar sin mock: grantsForRole es una función pura sin side effects externos
vi.mock("livekit-server-sdk", () => ({
  AccessToken: class {},
  RoomServiceClient: class {},
  TrackSource: {
    CAMERA:             "camera",
    MICROPHONE:         "microphone",
    SCREEN_SHARE:       "screen_share",
    SCREEN_SHARE_AUDIO: "screen_share_audio",
  },
}));

import { buildRoomName, grantsForRole } from "./livekit";
import { vi } from "vitest";

const ROOM = "ph-prop1-asm1";

// ─── buildRoomName ────────────────────────────────────────────────────────────

describe("buildRoomName", () => {
  it("genera nombres únicos por combinación property+assembly", () => {
    expect(buildRoomName("p1", "a1")).toBe("ph-p1-a1");
    expect(buildRoomName("p1", "a2")).toBe("ph-p1-a2");
    expect(buildRoomName("p2", "a1")).toBe("ph-p2-a1");
  });

  it("es determinista — mismo input = mismo output", () => {
    expect(buildRoomName("prop-abc", "asm-xyz"))
      .toBe(buildRoomName("prop-abc", "asm-xyz"));
  });

  it("rooms de propiedades distintas son distintas aunque coincida assemblyId", () => {
    expect(buildRoomName("prop-1", "asm-1"))
      .not.toBe(buildRoomName("prop-2", "asm-1"));
  });
});

// ─── grantsForRole: admin ─────────────────────────────────────────────────────

describe("grantsForRole — admin", () => {
  const grant = grantsForRole("admin", ROOM);

  it("puede publicar", () => {
    expect(grant.canPublish).toBe(true);
  });

  it("puede suscribirse", () => {
    expect(grant.canSubscribe).toBe(true);
  });

  it("es roomAdmin", () => {
    expect(grant.roomAdmin).toBe(true);
  });

  it("incluye screen share en los sources", () => {
    expect(grant.canPublishSources).toContain("screen_share");
    expect(grant.canPublishSources).toContain("screen_share_audio");
  });

  it("incluye cámara y micrófono", () => {
    expect(grant.canPublishSources).toContain("camera");
    expect(grant.canPublishSources).toContain("microphone");
  });

  it("el room del grant coincide con la sala solicitada", () => {
    expect(grant.room).toBe(ROOM);
  });
});

// ─── grantsForRole: attendee ──────────────────────────────────────────────────

describe("grantsForRole — attendee", () => {
  const grant = grantsForRole("attendee", ROOM);

  it("NO puede publicar", () => {
    expect(grant.canPublish).toBe(false);
  });

  it("canPublishSources está vacío — cero fuentes permitidas", () => {
    expect(grant.canPublishSources).toHaveLength(0);
  });

  it("puede suscribirse para recibir audio/video", () => {
    expect(grant.canSubscribe).toBe(true);
  });

  it("NO es roomAdmin", () => {
    expect(grant.roomAdmin).toBeFalsy();
  });

  it("no puede obtener screen share", () => {
    expect(grant.canPublishSources ?? []).not.toContain("screen_share");
    expect(grant.canPublishSources ?? []).not.toContain("screen_share_audio");
  });

  it("no puede obtener cámara", () => {
    expect(grant.canPublishSources ?? []).not.toContain("camera");
  });

  it("no puede obtener micrófono", () => {
    expect(grant.canPublishSources ?? []).not.toContain("microphone");
  });
});

// ─── grantsForRole: speaker ───────────────────────────────────────────────────

describe("grantsForRole — speaker (asistente con la palabra)", () => {
  const grant = grantsForRole("speaker", ROOM);

  it("puede publicar", () => {
    expect(grant.canPublish).toBe(true);
  });

  it("puede suscribirse", () => {
    expect(grant.canSubscribe).toBe(true);
  });

  it("NO es roomAdmin", () => {
    expect(grant.roomAdmin).toBeFalsy();
  });

  it("incluye micrófono en los sources", () => {
    expect(grant.canPublishSources).toContain("microphone");
  });

  it("NO incluye screen share", () => {
    expect(grant.canPublishSources ?? []).not.toContain("screen_share");
    expect(grant.canPublishSources ?? []).not.toContain("screen_share_audio");
  });
});

// ─── Comparación de roles: privilegio mínimo ──────────────────────────────────

describe("Separación de privilegios entre roles", () => {
  const adminGrant    = grantsForRole("admin",    ROOM);
  const speakerGrant  = grantsForRole("speaker",  ROOM);
  const attendeeGrant = grantsForRole("attendee", ROOM);

  it("admin es el único con screen share", () => {
    expect(adminGrant.canPublishSources).toContain("screen_share");
    expect(speakerGrant.canPublishSources  ?? []).not.toContain("screen_share");
    expect(attendeeGrant.canPublishSources ?? []).not.toContain("screen_share");
  });

  it("admin es el único roomAdmin", () => {
    expect(adminGrant.roomAdmin).toBe(true);
    expect(speakerGrant.roomAdmin).toBeFalsy();
    expect(attendeeGrant.roomAdmin).toBeFalsy();
  });

  it("attendee no puede publicar; speaker y admin sí", () => {
    expect(attendeeGrant.canPublish).toBe(false);
    expect(speakerGrant.canPublish).toBe(true);
    expect(adminGrant.canPublish).toBe(true);
  });

  it("attendee tiene sources vacías; speaker y admin tienen al menos una", () => {
    expect(attendeeGrant.canPublishSources).toHaveLength(0);
    expect((speakerGrant.canPublishSources ?? []).length).toBeGreaterThan(0);
    expect((adminGrant.canPublishSources   ?? []).length).toBeGreaterThan(0);
  });

  it("admin y speaker pueden coexistir publicando en la misma sala — son identidades distintas", () => {
    // Ambos tienen canPublish=true pero en sus propios contextos JWT.
    // El servidor LiveKit aísla los permisos por participantIdentity.
    expect(adminGrant.canPublish).toBe(true);
    expect(speakerGrant.canPublish).toBe(true);
    // Sus sources son diferentes
    expect(adminGrant.canPublishSources).toContain("screen_share");
    expect(speakerGrant.canPublishSources ?? []).not.toContain("screen_share");
  });

  it("el attendee no puede escalar privilegios cambiando su rol — los grants son independientes por rol", () => {
    // La única forma de obtener permisos de speaker es que el backend emita un token con role=speaker.
    // Este test documenta que attendee ≠ speaker a nivel de grants.
    expect(attendeeGrant.canPublish).not.toBe(speakerGrant.canPublish);
    expect(attendeeGrant.canPublishSources).not.toEqual(speakerGrant.canPublishSources);
  });
});
