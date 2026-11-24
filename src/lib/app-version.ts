import packageJson from "../../package.json";

/** App semver from package.json (build-time). */
export const APP_VERSION =
  typeof packageJson.version === "string" && packageJson.version.trim()
    ? packageJson.version.trim()
    : "0.0.0";
