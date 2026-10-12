import { expect, test } from "bun:test";
import { runOut } from "../src/play";

test("vehicles brake to a stop shortly after the junction", () => {
  const clear = 10;
  expect(runOut(5, clear, 7)).toBe(5); // inside the junction: untouched
  let last = 0;
  for (let d = 0; d <= 60; d += 0.25) {
    const p = runOut(d, clear, 7);
    expect(p).toBeGreaterThanOrEqual(last); // never goes backwards
    expect(p - last).toBeLessThanOrEqual(0.25 + 1e-9); // never faster than the vehicle
    last = p;
  }
  expect(last).toBeLessThan(clear + 12); // stops well before the end of the road
  // A bike (4.5 m/s) stops far enough before a car (7 m/s) that a bike and a car leaving by the same arm do not overlap.
  expect(runOut(1000, clear, 7) - runOut(1000, clear, 4.5)).toBeGreaterThan(4.5);
  expect(runOut(60, clear, 7)).toBe(runOut(1000, clear, 7)); // and stays there
});
