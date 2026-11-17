import { Decimal } from "decimal.js";

/**
 * Fixed-point money and rate arithmetic.
 *
 * CLAUDE.md rule 8: money is never floating point. Amounts and quantities have
 * 2 decimal places, rates have 6, and rounding is half-up at the point of posting.
 *
 * Values cross the system as decimal strings ("1320.00"), which is also how
 * PostgreSQL `numeric` columns are read and written.
 */

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_SCALE = 2;
export const RATE_SCALE = 6;

export type DecimalInput = string | number | bigint;

function parse(value: DecimalInput, what: string): Decimal {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new RangeError(`${what} must be a finite number`);
  }
  let d: Decimal;
  try {
    d = new D(typeof value === "bigint" ? value.toString() : value);
  } catch {
    throw new RangeError(`${what} is not a valid decimal: ${String(value)}`);
  }
  if (!d.isFinite()) {
    throw new RangeError(`${what} must be a finite number`);
  }
  return d;
}

/** Round to 2 decimal places, half-up, as a fixed string such as "1320.00". */
export function toMoney(value: DecimalInput): string {
  return parse(value, "Amount").toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** Round to 6 decimal places, half-up, as a fixed string such as "13.200000". */
export function toRate(value: DecimalInput): string {
  return parse(value, "Rate").toFixed(RATE_SCALE, Decimal.ROUND_HALF_UP);
}

/** The pula amount of a transaction: quantity x rate applied, rounded to 2 places. */
export function pulaAmount(quantity: DecimalInput, rateApplied: DecimalInput): string {
  const q = parse(quantity, "Quantity");
  const r = parse(rateApplied, "Rate");
  if (q.lte(0)) throw new RangeError("Quantity must be greater than zero");
  if (r.lte(0)) throw new RangeError("Rate must be greater than zero");
  return q.mul(r).toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function addMoney(a: DecimalInput, b: DecimalInput): string {
  return parse(a, "Amount").plus(parse(b, "Amount")).toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function subtractMoney(a: DecimalInput, b: DecimalInput): string {
  return parse(a, "Amount").minus(parse(b, "Amount")).toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

/** -1, 0 or 1, comparing a with b. */
export function compareMoney(a: DecimalInput, b: DecimalInput): -1 | 0 | 1 {
  return parse(a, "Amount").comparedTo(parse(b, "Amount")) as -1 | 0 | 1;
}

export function isZeroMoney(a: DecimalInput): boolean {
  return parse(a, "Amount").toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).isZero();
}
