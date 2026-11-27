import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  process.env.SOFFICE_PATH,
  "soffice",
  "libreoffice",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
].filter((v): v is string => Boolean(v));

function run(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        HOME: opts?.cwd ?? process.env.HOME,
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
      reject(new Error(`docx→pdf timed out after ${opts?.timeoutMs ?? 120_000}ms`));
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

async function resolveSoffice(): Promise<string> {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      const probe = await run(candidate, ["--version"], { timeoutMs: 15_000 });
      if (probe.code === 0 || probe.stdout.includes("LibreOffice")) {
        return candidate;
      }
    } catch {
      // try next
    }
  }
  throw new Error(
    "LibreOffice (soffice) is not available for DOCX→PDF conversion. " +
      "Install libreoffice-writer or set LIBREOFFICE_PATH.",
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
    const result = await run(
      soffice,
      [
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--norestore",
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
    if (pdf.byteLength < 100 || pdf.subarray(0, 4).toString("utf8") !== "%PDF") {
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
