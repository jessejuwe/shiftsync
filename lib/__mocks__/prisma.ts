/**
 * Mock Prisma client for API route unit tests.
 * Prevents loading the real Prisma client (which uses import.meta).
 */

const createMockDelegate = () => ({
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

export const prisma = {
  auditLog: createMockDelegate(),
  location: createMockDelegate(),
  skill: createMockDelegate(),
  user: createMockDelegate(),
  shift: createMockDelegate(),
  availabilityWindow: createMockDelegate(),
  certification: createMockDelegate(),
  shiftAssignment: createMockDelegate(),
  notification: createMockDelegate(),
  swapRequest: createMockDelegate(),
  staffSkill: createMockDelegate(),
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      location: createMockDelegate(),
      skill: createMockDelegate(),
      shift: createMockDelegate(),
      availabilityWindow: createMockDelegate(),
      certification: createMockDelegate(),
      user: createMockDelegate(),
      shiftAssignment: createMockDelegate(),
      notification: createMockDelegate(),
      swapRequest: createMockDelegate(),
      auditLog: createMockDelegate(),
    };
    return fn(tx);
  }),
};
