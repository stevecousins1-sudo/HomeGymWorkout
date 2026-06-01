/* global __BUILD_TIME__ */
export const BUILD_TIME = __BUILD_TIME__;

export function getBuildLabel() {
  const d = new Date(BUILD_TIME);
  const pad = n => String(n).padStart(2, '0');
  return `Build ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}${pad(d.getUTCMinutes())} UTC`;
}
