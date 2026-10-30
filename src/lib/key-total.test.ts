import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { countRunKeys } from "./key-total";

describe("printed run key total", () => {
  it("counts one per checked client and zero per unchecked client", () => {
    assert.equal(countRunKeys([
      { clients: { key_no: true } },
      { clients: { key_no: false } },
      { clients: { key_no: true } },
    ]), 2);
  });
  it("shows zero when no clients are checked", () => {
    assert.equal(countRunKeys([{ clients: { key_no: false } }, { clients: null }, {}]), 0);
  });
});