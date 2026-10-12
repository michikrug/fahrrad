import { expect, test } from "bun:test";
import { runOut } from "../src/play";

test("vehicles brake to a stop shortly after the junction", () => {
  const clear = 10;
  expect(runOut(5, clear)).toBe(5); // inside the junction: untouched
  let last = 0;
  for (let d = 0; d <= 60; d += 0.25) {
    const p = runOut(d, clear);
    expect(p).toBeGreaterThanOrEqual(last); // never goes backwards
    expect(p - last).toBeLessThanOrEqual(0.25 + 1e-9); // never faster than the vehicle
    last = p;
  }
  expect(last).toBeLessThan(clear + 12); // stops well before the end of the road
  expect(runOut(60, clear)).toBe(runOut(1000, clear)); // and stays there
});
