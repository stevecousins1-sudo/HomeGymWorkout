const PLATE_CONFIG = {
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
  kg: { bar: 20, plates: [20, 15, 10, 5, 2.5, 1.25] },
};

export function calcPlates(targetWeight, unit = 'lb') {
  const config = PLATE_CONFIG[unit] ?? PLATE_CONFIG.lb;
  let remaining = (targetWeight - config.bar) / 2;
  if (remaining < 0) return null;
  const result = [];
  for (const plate of config.plates) {
    if (remaining < 0.01) break;
    const count = Math.floor(remaining / plate + 0.001);
    if (count > 0) {
      result.push({ plate, count });
      remaining -= count * plate;
    }
  }
  return result;
}
