/**
 * Mock de PrismaClient para tests unitarios.
 *
 * Proporciona un mock tipado de speakerQueueEntry y conferenceAuditLog
 * con vi.fn() para todos los métodos usados en speakerQueue.ts.
 *
 * Uso en tests:
 *   vi.mock("../lib/prisma", () => ({ prisma: mockPrisma }));
 */

import { vi } from "vitest";

export function createMockPrisma() {
  const speakerQueueEntry = {
    findMany:   vi.fn(),
    findFirst:  vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    delete:     vi.fn(),
  };

  const conferenceAuditLog = {
    create:   vi.fn(),
    findMany: vi.fn(),
  };

  return {
    speakerQueueEntry,
    conferenceAuditLog,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      speakerQueueEntry,
      conferenceAuditLog,
    })),
  };
}

export const mockPrisma = createMockPrisma();
