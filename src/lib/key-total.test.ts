import { describe, expect, it } from "bun:test";
import { countRunKeys } from "./key-total";

describe("printed run key total", () => {
  it("counts one per checked client and zero per unchecked client", () => {
    expect(countRunKeys([
      { clients: { key_no: true } },
      { clients: { key_no: false } },
      { clients: { key_no: true } },
    ])).toBe(2);
  });
  it("shows zero when no clients are checked", () => {
    expect(countRunKeys([{ clients: { key_no: false } }, { clients: null }, {}])).toBe(0);
  });
});