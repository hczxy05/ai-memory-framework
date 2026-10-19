#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { looksSensitive } from "../shared/secrets.mjs";

const FILES = new Set(["PROJECT.md", "STATUS.md", "ARCHITECTURE.md", "DECISIONS.md", "BUGS.md", "LESSONS.md"]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const digest = (plan) => sha256(JSON.stringify(plan));
const text = (value, name, max = 4000) => {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x08\x0b-\x1f\x7f]/.test(value)) {
    throw new Error("Invalid " + name);
  }
  return value;
};
function readBounded(file, max) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > max || fs.lstatSync(file).isSymbolicLink()) {
      throw new Error("Unsafe or oversized file: " + file);
    }
    const buffer = Buffer.alloc(max + 1);
    let size = 0;
    while (size <= max) {
      const n = fs.readSync(fd, buffer, size, buffer.length - size, size);
      if (!n) break;
      size += n;
    }
    if (size > max) throw new Error("File grew past the read limit");
    return { bytes: buffer.subarray(0, size), stat };
  } finally { fs.closeSync(fd); }
}
export function readJson(file) {
  return JSON.parse(readBounded(file, 32 * 1024).bytes.toString("utf8"));
}
export function prepare(policy, candidate, now = Date.now()) {
  if (!policy || !candidate || Array.isArray(candidate)) throw new Error("Policy and candidate are required");
  const root = fs.realpathSync(text(policy.root, "root"));
  const scope = text(policy.scope, "policy scope", 200);
  if (candidate.scope !== scope) throw new Error("Scope mismatch");
  if (!FILES.has(candidate.target) || !Array.isArray(policy.files) || !policy.files.includes(candidate.target)) {
    throw new Error("Target is not an allowed project document");
  }
  const allowed = ["scope", "target", "content", "base_sha256", "stable", "reusable", "evidence", "expires_at"];
  if (Object.keys(candidate).some((key) => !allowed.includes(key))) throw new Error("Unknown candidate field");
  if (candidate.stable !== true || candidate.reusable !== true) throw new Error("Stable and reusable must be true");
  const content = text(candidate.content, "content");
  const evidence = candidate.evidence;
  const source = text(evidence?.source, "evidence source", 500);
  const summary = text(evidence?.summary, "verification summary", 2000);
  const verifiedAt = Date.parse(text(evidence?.verified_at, "verification date", 40));
  const expiresAt = Date.parse(text(candidate.expires_at, "expiry", 40));
  if (!Number.isFinite(verifiedAt) || verifiedAt > now) throw new Error("Invalid verification date");
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 24 * 3600_000) throw new Error("Candidate expired or validity exceeds 24 hours");
  if (looksSensitive(content, source, summary) || content.includes("<!-- ai-memory-promotion:")) throw new Error("Secret or reserved promotion marker");
  const file = path.join(root, candidate.target);
  const current = readBounded(file, 1024 * 1024).bytes;
  if (!/^##? Purpose\s*$/m.test(current.toString("utf8"))) throw new Error("Target must declare its Purpose");
  if (sha256(current) !== candidate.base_sha256) throw new Error("Target changed; review a new candidate");
  const plan = {
    version: 1, root, scope, target: candidate.target, base_sha256: candidate.base_sha256,
    content, stable: true, reusable: true,
    evidence: { source, summary, verified_at: new Date(verifiedAt).toISOString() },
    expires_at: new Date(expiresAt).toISOString(),
  };
  return { plan, digest: digest(plan) };
}
export function initKey(file) {
  fs.writeFileSync(file, randomBytes(32).toString("hex") + "\n", { flag: "wx", mode: 0o600 });
}
function readKey(file) {
  const { bytes, stat } = readBounded(file, 128);
  if (process.platform !== "win32" && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid())) throw new Error("Approval key must be owned by the operator and mode 0600");
  const key = bytes.toString("utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid approval key");
  return Buffer.from(key, "hex");
}
export function signApproval(plan, keyFile, confirmation) {
  const hash = digest(plan);
  if (confirmation !== "APPROVE " + hash) throw new Error("Exact operator confirmation required");
  const body = { version: 1, digest: hash, expires_at: plan.expires_at };
  return { ...body, signature: createHmac("sha256", readKey(keyFile)).update(JSON.stringify(body)).digest("hex") };
}
export function applyApproval(policy, candidate, approval, keyFile, now = Date.now()) {
  const { plan, digest: hash } = prepare(policy, candidate, now);
  if (approval?.version !== 1 || approval.digest !== hash || approval.expires_at !== plan.expires_at || !/^[a-f0-9]{64}$/.test(approval.signature || "")) throw new Error("Approval does not match the current plan");
  const body = { version: 1, digest: hash, expires_at: approval.expires_at };
  const expected = createHmac("sha256", readKey(keyFile)).update(JSON.stringify(body)).digest();
  if (!timingSafeEqual(expected, Buffer.from(approval.signature, "hex"))) throw new Error("Invalid approval signature");
  const lock = path.join(plan.root, ".ai-memory-promotion.lock");
  const lockFd = fs.openSync(lock, "wx", 0o600);
  const temp = path.join(plan.root, ".promotion-" + randomUUID() + ".tmp");
  try {
    const fresh = prepare(policy, candidate, now);
    if (fresh.digest !== hash) throw new Error("Plan changed while acquiring lock");
    const target = path.join(plan.root, plan.target);
    const current = readBounded(target, 1024 * 1024);
    const audit = "<!-- ai-memory-promotion:" + hash + " -->\n" +
      "> Promotion evidence: " + JSON.stringify(plan.evidence) + "\n" +
      "> Scope: " + JSON.stringify(plan.scope) + "; approved plan: " + hash + "\n";
    const bytes = Buffer.concat([current.bytes, Buffer.from("\n\n" + plan.content + "\n\n" + audit)]);
    if (bytes.length > 1024 * 1024) throw new Error("Promotion would exceed document size limit");
    const fd = fs.openSync(temp, "wx", current.stat.mode & 0o777);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    // The document directory must be writable only by the trusted executor.
    if (sha256(readBounded(target, 1024 * 1024).bytes) !== plan.base_sha256) throw new Error("Target changed before commit");
    fs.renameSync(temp, target);
    return { promoted: true, digest: hash, target: plan.target, sha256: sha256(bytes) };
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}
async function main() {
  const [command, policyFile, candidateFile, keyFile, receiptFile] = process.argv.slice(2);
  if (command === "init-key") { initKey(policyFile); console.log("Approval key created"); return; }
  const policy = readJson(policyFile);
  const candidate = readJson(candidateFile);
  const prepared = prepare(policy, candidate);
  if (command === "review") { console.log(JSON.stringify(prepared, null, 2)); return; }
  if (command === "approve") {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Approval requires the operator's interactive terminal");
    console.log(JSON.stringify(prepared, null, 2));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question("Type APPROVE " + prepared.digest + ": ");
      const receipt = signApproval(prepared.plan, keyFile, answer);
      fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    } finally { rl.close(); }
    return;
  }
  if (command === "apply") { console.log(JSON.stringify(applyApproval(policy, candidate, readJson(receiptFile), keyFile))); return; }
  throw new Error("Usage: gate.mjs init-key KEY | review POLICY CANDIDATE | approve/apply POLICY CANDIDATE KEY RECEIPT");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
