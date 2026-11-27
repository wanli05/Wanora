import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

/**
 * On Windows, CLI must use soffice.com (console). soffice.exe is a GUI
 * subsystem binary — `--version` / headless convert often hang or produce
 * no captured stdout when spawned from Node.
 */
function expandWindowsBinary(path: string): string[] {
  if (process.platform !== "win32") return [path];
  const lower = path.toLowerCase();
  if (lower.endsWith("soffice.exe")) {
    const com = `${path.slice(0, -4)}.com`;
    return [com, path];
  }
  if (lower.endsWith("soffice.com")) return [path];
  // Env may point at the program/ directory.
  if (lower.endsWith(`${"\\"}program`) || lower.endsWith("/program")) {
    return [join(path, "soffice.com"), join(path, "soffice.exe")];
  }
  return [path];
}

function windowsInstallDirs(): string[] {
  if (process.platform !== "win32") return [];
  const local = process.env.LOCALAPPDATA;
  const home = homedir();
  const dirs = [
    join(process.env.ProgramFiles ?? "C:\\Program Files", "LibreOffice", "program"),
    join(
      process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
      "LibreOffice",
      "program",
    ),
    local ? join(local, "Programs", "LibreOffice", "program") : "",
    join(home, "AppData", "Local", "Programs", "LibreOffice", "program"),
  ].filter(Boolean);
  return [...new Set(dirs)];
}

function sofficeCandidates(): string[] {
  const raw: string[] = [
    process.env.LIBREOFFICE_PATH,
    process.env.SOFFICE_PATH,
    ...windowsInstallDirs().flatMap((dir) => [
      join(dir, "soffice.com"),
      join(dir, "soffice.exe"),
    ]),
    "soffice.com",
    "soffice",
    "soffice.exe",
    "libreoffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
  ].filter((v): v is string => Boolean(v));

  const expanded = raw.flatMap(expandWindowsBinary);
  return [...new Set(expanded)];
}

function looksAbsolute(path: string): boolean {
  return path.includes("/") || path.includes("\\") || /^[a-zA-Z]:/.test(path);
}

function run(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      // soffice.com is a console shim; shell is not required when path is absolute.
      env: {
        ...process.env,
        // Keep user profile for LibreOffice user config, but isolate temp work via cwd.
        HOME: process.env.HOME ?? homedir(),
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(`docx→pdf timed out after ${opts?.timeoutMs ?? 120_000}ms`),
      );
    }, opts?.timeoutMs ?? 120_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function probeLooksLikeLibreOffice(probe: {
  code: number;
  stdout: string;
  stderr: string;
}): boolean {
  const text = `${probe.stdout}\n${probe.stderr}`;
  if (/LibreOffice|OpenOffice/i.test(text)) return true;
  // soffice.com --version often returns 0 with a short banner.
  if (probe.code === 0) return true;
  return false;
}

async function resolveSoffice(): Promise<string> {
  const tried: string[] = [];
  for (const candidate of sofficeCandidates()) {
    tried.push(candidate);
    if (looksAbsolute(candidate) && !existsSync(candidate)) continue;
    try {
      // Short probe — hung soffice.exe should not block for 15s each.
      const probe = await run(candidate, ["--version"], { timeoutMs: 8_000 });
      if (probeLooksLikeLibreOffice(probe)) return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "LibreOffice (soffice) is not available for DOCX→PDF conversion. " +
      "On Windows install LibreOffice and prefer soffice.com, e.g. set " +
      'LIBREOFFICE_PATH="C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.com", ' +
      "then restart the dev server. " +
      `Tried: ${tried.join(", ")}`,
  );
}

/**
 * Convert a DOCX buffer to PDF via headless LibreOffice.
 * Used for 履歴書 so preview / print / PDF download share the filled template.
 */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const soffice = await resolveSoffice();
  const dir = await mkdtemp(join(tmpdir(), "wanora-docx2pdf-"));
  const inputPath = join(dir, "input.docx");
  const outputPath = join(dir, "input.pdf");
  try {
    await writeFile(inputPath, docx);
    // User profile lock files under %APPDATA%\LibreOffice can block headless runs
    // when a GUI LibreOffice is already open — use a disposable UserInstallation.
    const userInstall = join(dir, "user-profile").replace(/\\/g, "/");
    const result = await run(
      soffice,
      [
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--norestore",
        `-env:UserInstallation=file:///${userInstall}`,
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        inputPath,
      ],
      { cwd: dir, timeoutMs: 120_000 },
    );
    if (result.code !== 0) {
      throw new Error(
        `LibreOffice convert failed (code ${result.code}): ${result.stderr || result.stdout}`,
      );
    }
    const pdf = await readFile(outputPath);
    if (
      pdf.byteLength < 100 ||
      pdf.subarray(0, 4).toString("utf8") !== "%PDF"
    ) {
      throw new Error("LibreOffice produced an invalid PDF");
    }
    return pdf;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function isDocxToPdfAvailable(): Promise<boolean> {
  try {
    await resolveSoffice();
    return true;
  } catch {
    return false;
  }
}

/** Test helper — exported for unit assertions on Windows path expansion. */
export function listSofficeCandidatesForTest(): string[] {
  return sofficeCandidates();
}
