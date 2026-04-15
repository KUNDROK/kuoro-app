/**
 * Mock de los servicios de LiveKit para tests unitarios.
 * Permite simular éxito, fallo y verificar que las llamadas se realizan correctamente.
 */

import { vi } from "vitest";

export const mockElevate   = vi.fn().mockResolvedValue(undefined);
export const mockRevoke    = vi.fn().mockResolvedValue(undefined);
export const mockBuildRoom = vi.fn((propertyId: string, assemblyId: string) =>
  `ph-${propertyId}-${assemblyId}`,
);

export const livekitMock = {
  elevateParticipantToSpeaker: mockElevate,
  revokeParticipantSpeaker:    mockRevoke,
  buildRoomName:               mockBuildRoom,
};
