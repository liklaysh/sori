import { randomBytes } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { config } from "../config.js";

const API_VERSION = "v1";
const BUILD_ID = process.env.SORI_BUILD_ID || randomBytes(4).toString("hex");

function readProductVersion(): string {
  const candidates = [
    process.env.SORI_VERSION_FILE,
    path.resolve(process.cwd(), "VERSION"),
    path.resolve(process.cwd(), "../../VERSION"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const version = readFileSync(candidate, "utf8").trim();
      if (version) {
        return version;
      }
    }
  }

  return "unknown";
}

function readGitCommit(): string {
  const envCommit = process.env.SORI_COMMIT || process.env.GIT_COMMIT;
  if (envCommit) {
    return envCommit.slice(0, 12);
  }

  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

const versionPayload = {
  name: "SORI",
  version: readProductVersion(),
  apiVersion: API_VERSION,
  buildId: BUILD_ID,
  commit: readGitCommit(),
  environment: config.security.isProduction ? "production" : "development",
};

export function getSystemVersion() {
  return versionPayload;
}
