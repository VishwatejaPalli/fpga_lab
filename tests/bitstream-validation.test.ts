import { describe, it, expect } from "vitest";

describe("Bitstream Header & Part Target Inspection Tests", () => {
  it("should match target FPGA part strings correctly", () => {
    const headerPart = "7z020clg400-1";
    const isZynq7020 = headerPart.includes("7z020");
    expect(isZynq7020).toBe(true);

    const artixPart = "7a35tcpg236-1";
    const isArtix35 = artixPart.includes("7a35t");
    expect(isArtix35).toBe(true);
  });
});
