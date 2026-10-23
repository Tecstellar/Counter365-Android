/**
 * Semantic Version Comparison Utilities
 * Handles '1.0.4', '1.0.5', '2.0.0', etc.
 */

export function parseVersionNumbers(versionString: string): number[] {
  if (!versionString) return [0, 0, 0];
  const cleaned = versionString.replace(/[^0-9.]/g, '').trim();
  const parts = cleaned.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts;
}

/**
 * Returns:
 *  1 if v1 > v2
 * -1 if v1 < v2
 *  0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseVersionNumbers(v1);
  const p2 = parseVersionNumbers(v2);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Returns true if installed version is strictly less than minimum required version
 */
export function isVersionOutdated(installedVersion: string, minRequiredVersion: string): boolean {
  if (!minRequiredVersion) return false;
  return compareVersions(installedVersion, minRequiredVersion) < 0;
}
