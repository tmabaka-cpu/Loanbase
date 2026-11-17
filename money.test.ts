import { describe, expect, it } from "vitest";
import { addMoney, compareMoney, isZeroMoney, pulaAmount, subtractMoney, toMoney, toRate } from "./money";

describe("money (CLAUDE.md rule 8: fixed-point, half-up)", () => {
  it("formats amounts to 2 decimal places", () => {
    expect(toMoney("1320")).toBe("1320.00");
    expect(toMoney("0.1")).toBe("0.10");
  });

  it("rounds half-up, not half-even", () => {
    expect(toMoney("2.345")).toBe("2.35");
    expect(toMoney("2.335")).toBe("2.34");
    expect(toMoney("0.005")).toBe("0.01");
  });

  it("does not suffer floating point error", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(subtractMoney("1.00", "0.90")).toBe("0.10");
  });

  it("formats rates to 6 decimal places", () => {
    expect(toRate("13.2")).toBe("13.200000");
    expect(toRate("0.7654321")).toBe("0.765432");
  });

  it("calculates the pula amount as quantity x rate applied (blueprint section 7)", () => {
    expect(pulaAmount("100", "13.20")).toBe("1320.00");
    expect(pulaAmount("50", "13.80")).toBe("690.00");
    expect(pulaAmount("33.33", "13.275")).toBe("442.46");
  });

  it("refuses a zero or negative quantity or rate", () => {
    expect(() => pulaAmount("0", "13.20")).toThrow(/Quantity/);
    expect(() => pulaAmount("100", "-1")).toThrow(/Rate/);
  });

  it("refuses values that are not numbers", () => {
    expect(() => toMoney("abc")).toThrow(RangeError);
    expect(() => toMoney(Number.NaN)).toThrow(RangeError);
    expect(() => toMoney(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("compares amounts", () => {
    expect(compareMoney("10.00", "9.99")).toBe(1);
    expect(compareMoney("10", "10.00")).toBe(0);
    expect(compareMoney("0", "0.01")).toBe(-1);
    expect(isZeroMoney("0.004")).toBe(true);
    expect(isZeroMoney("0.005")).toBe(false);
  });
});
