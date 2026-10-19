export function looksSensitive(...values) {
  const content = values.map((value) => String(value || "")).join("\n");
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
    /\b(?:api[_-]?key|access[_-]?token|secret|password|passwd)\s*[:=]\s*\S{8,}/i,
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /\bAKID[A-Za-z0-9]{12,}\b/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/i,
    /\bglpat-[A-Za-z0-9_-]{20,}\b/i,
    /\bAIza[A-Za-z0-9_-]{20,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/i,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/i,
  ].some((pattern) => pattern.test(content));
}
