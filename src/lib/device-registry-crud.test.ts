import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  responses: [] as Array<unknown[]>,
  queries: [] as Array<{ sql: string; inputs: Record<string, unknown> }>,
  gate: vi.fn(),
  begin: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler(fn: unknown) {
      return fn;
    },
  }),
}));
vi.mock("./server/device-registry-access", () => ({ requireDeviceRegistryAccess: db.gate }));
vi.mock("mssql", () => {
  class Request {
    inputs: Record<string, unknown> = {};
    input(name: string, _type: unknown, value: unknown) {
      this.inputs[name] = value;
      return this;
    }
    async query(sql: string) {
      db.queries.push({ sql, inputs: this.inputs });
      return { recordset: db.responses.shift() ?? [] };
    }
  }
  return {
    default: {
      Request,
      Transaction: class {
        begin = db.begin;
        commit = db.commit;
        rollback = db.rollback;
      },
      BigInt: 0,
      Bit: 0,
      NVarChar: () => 0,
      MAX: 0,
      ISOLATION_LEVEL: { SERIALIZABLE: 4 },
    },
  };
});
vi.mock("./carddb", () => ({
  isCardDbConfigured: () => true,
  getCardDbSchema: () => "dbo",
  getCardDbPool: async () => ({
    request: () => ({
      query: async (sql: string) => {
        db.queries.push({ sql, inputs: {} });
        return { recordset: db.responses.shift() ?? [] };
      },
    }),
  }),
}));
vi.mock("./server/activity", () => ({
  currentActor: async () => ({ id: 1, username: "admin" }),
  recordActivity: async () => undefined,
}));
import {
  changeRegisteredDeviceState,
  listRegisteredDevices,
  upsertRegisteredDeviceInputSchema,
  upsertRegisteredDeviceProfile,
} from "./device-registry";
import { createDefaultDeviceProfile } from "./device-config";
const input = {
  ...createDefaultDeviceProfile(),
  deviceCode: "edge-test",
  deviceName: "Test",
  plant: "Acid Plant",
  edgeApiUrl: "http://10.0.0.2:3000",
};
const row = {
  id: 7,
  code: "edge-test",
  name: "Test",
  plant: "Acid Plant",
  is_active: true,
  edge_api_url: input.edgeApiUrl,
};
beforeEach(() => {
  vi.clearAllMocks();
  db.responses = [];
  db.queries = [];
  db.gate.mockResolvedValue({
    ok: true,
    user: { id: 1, username: "admin", role: "admin", isActive: true },
  });
  db.rollback.mockResolvedValue(undefined);
});
describe("registry mutations", () => {
  it("rejects unauthorized writes before any SQL", async () => {
    db.gate.mockResolvedValue({ ok: false, message: "Denied" });
    expect((await upsertRegisteredDeviceProfile({ data: input })).ok).toBe(false);
    expect(
      (await changeRegisteredDeviceState({ data: { deviceId: 7, action: "delete" } })).ok,
    ).toBe(false);
    expect(db.begin).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(0);
  });
  it("creates a new device with URL, assignment and profile in one transaction", async () => {
    db.responses = [[], [], [{ id: 10 }], [{ id: 7 }], [], [], [], [{ id: 20 }], [], [row]];
    const result = await upsertRegisteredDeviceProfile({ data: input });
    expect(result.ok).toBe(true);
    expect(db.commit).toHaveBeenCalledOnce();
    expect(
      db.queries.find((q) => q.sql.includes("INSERT INTO [dbo].devices"))?.inputs.edgeApiUrl,
    ).toBe(input.edgeApiUrl);
    expect(db.queries.some((q) => q.sql.includes("INSERT INTO [dbo].device_assignments"))).toBe(
      true,
    );
  });
  it("rejects codes that are still registered instead of silently updating", async () => {
    db.responses = [[{ id: 7, code: "edge-test", is_deleted: false }]];
    expect((await upsertRegisteredDeviceProfile({ data: input })).ok).toBe(false);
    expect(db.rollback).toHaveBeenCalledOnce();
    expect(db.commit).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(1);
  });
  it("re-registers a deleted code using its original ID and preserves history", async () => {
    db.responses = [
      [{ id: 7, code: "edge-test", is_deleted: true }],
      [{ id: 10 }],
      [],
      [],
      [],
      [],
      [],
      [{ id: 20 }],
      [],
      [],
      [row],
    ];
    const result = await upsertRegisteredDeviceProfile({ data: input });
    expect(result.ok).toBe(true);
    expect(db.commit).toHaveBeenCalledOnce();
    expect(db.queries.some((q) => q.sql.includes("INSERT INTO [dbo].devices"))).toBe(false);
    const restored = db.queries.find((q) => q.sql.includes("is_deleted = 0, is_active = 1"));
    expect(restored?.inputs.deviceId).toBe(7);
    expect(
      db.queries.find((q) => q.sql.includes("INSERT INTO [dbo].device_assignments"))?.inputs
        .deviceId,
    ).toBe(7);
    expect(db.queries.some((q) => /DELETE FROM/i.test(q.sql))).toBe(false);
  });
  it("updates by stable ID and leaves URL and active flag unchanged on profile-only save", async () => {
    db.responses = [
      [{ id: 7, code: "edge-test", is_deleted: false }],
      [{ id: 10 }],
      [],
      [],
      [{ id: 1, location_id: 10 }],
      [{ id: 20 }],
      [],
      [],
      [row],
    ];
    const { edgeApiUrl: _url, ...profileOnly } = input;
    const result = await upsertRegisteredDeviceProfile({ data: { ...profileOnly, deviceId: 7 } });
    expect(result.ok).toBe(true);
    const update = db.queries.find((q) => q.sql.includes("UPDATE [dbo].devices"));
    expect(update?.inputs).toMatchObject({ deviceId: 7, setEdgeApiUrl: 0 });
    expect(update?.sql).not.toContain("is_active = 1");
  });
  it("rejects code changes and missing edit targets", async () => {
    db.responses = [[{ id: 7, code: "original", is_deleted: false }]];
    expect((await upsertRegisteredDeviceProfile({ data: { ...input, deviceId: 7 } })).ok).toBe(
      false,
    );
    db.responses = [[]];
    expect((await upsertRegisteredDeviceProfile({ data: { ...input, deviceId: 8 } })).ok).toBe(
      false,
    );
    expect(db.commit).not.toHaveBeenCalled();
  });
  it("requires deactivation before deletion", async () => {
    db.responses = [[{ id: 7, is_active: true }]];
    expect(
      (await changeRegisteredDeviceState({ data: { deviceId: 7, action: "delete" } })).ok,
    ).toBe(false);
    expect(db.commit).not.toHaveBeenCalled();
  });
  it("soft deletes inactive devices, closes assignments and preserves captures", async () => {
    db.responses = [[{ id: 7, is_active: false }], [], []];
    expect(
      (await changeRegisteredDeviceState({ data: { deviceId: 7, action: "delete" } })).ok,
    ).toBe(true);
    expect(db.queries[1].inputs).toMatchObject({ active: 0, deleted: 1 });
    expect(
      db.queries.some((q) => q.sql.includes("device_assignments") && q.sql.includes("assigned_to")),
    ).toBe(true);
    expect(
      db.queries.some((q) => q.sql.includes("DELETE FROM") || q.sql.includes("capture_records")),
    ).toBe(false);
  });
  it.each(["activate", "deactivate"] as const)("supports %s without deleting", async (action) => {
    db.responses = [[{ id: 7, is_active: action !== "activate" }], []];
    expect((await changeRegisteredDeviceState({ data: { deviceId: 7, action } })).ok).toBe(true);
    expect(db.queries[1].inputs).toMatchObject({
      active: action === "activate" ? 1 : 0,
      deleted: 0,
    });
  });
  it("scopes non-admin reads to the assigned plant", async () => {
    db.gate.mockResolvedValue({ ok: true, user: { role: "operator", plant: "Acid Plant" } });
    db.responses = [[row, { ...row, id: 8, plant: "Chloride Plant" }]];
    const result = await listRegisteredDevices();
    expect(result.ok && result.devices.map((d) => d.id)).toEqual([7]);
  });
  it("validates URL protocol and database field bounds", () => {
    expect(
      upsertRegisteredDeviceInputSchema.safeParse({ ...input, edgeApiUrl: "file:///etc/passwd" })
        .success,
    ).toBe(false);
    expect(
      upsertRegisteredDeviceInputSchema.safeParse({ ...input, deviceCode: "x".repeat(51) }).success,
    ).toBe(false);
  });
});
