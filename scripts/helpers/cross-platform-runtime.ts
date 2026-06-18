import { spawn, type ChildProcess, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function commandExists(command: string) {
  try {
    const resolver = process.platform === "win32" ? "where" : "which";
    const output = execFileSync(resolver, [command], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    }).trim();
    const firstMatch = output.split(/\r?\n/).find(Boolean);
    return firstMatch || null;
  } catch {
    return null;
  }
}

export function resolveChromiumExecutable() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured && existsSync(configured)) return configured;

  const candidates: string[] = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    candidates.push(
      path.join(local, "ms-playwright", "chromium-1217", "chrome-win", "chrome.exe"),
      path.join(local, "ms-playwright", "chromium-1217", "chrome-win64", "chrome.exe"),
      path.join(local, "ms-playwright", "chromium_headless_shell-1217", "chrome-win", "headless_shell.exe")
    );
  }

  if (process.platform === "linux") {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium"
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    );
  }

  const foundCandidate = candidates.find((candidate) => existsSync(candidate));
  if (foundCandidate) return foundCandidate;

  const commandCandidates =
    process.platform === "win32"
      ? ["chrome", "msedge", "chromium"]
      : ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"];

  const resolvedCommand = commandCandidates
    .map((candidate) => commandExists(candidate))
    .find((candidate): candidate is string => Boolean(candidate));

  if (resolvedCommand) return resolvedCommand;

  throw new Error(`Chromium executable not found for platform ${process.platform}.`);
}

export function startNextDevServer(root: string, port: number, extraEnv: Record<string, string> = {}): ChildProcess {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(npmCommand, ["run", "dev", "--", "-p", String(port)], {
    cwd: root,
    detached: false,
    stdio: "ignore",
    windowsHide: true,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NEXTAUTH_URL: `http://localhost:${port}`,
      ...extraEnv
    }
  });
}
