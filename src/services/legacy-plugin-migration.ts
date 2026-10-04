import { normalizePath, type App, type PluginManifest } from "obsidian";

const LEGACY_PLUGIN_ID = "rss-dashboard";
const MIGRATION_MARKER = "legacy-rss-migration.json";
const ROOT_DATA_FILES = new Set([
  "data.json",
  "data.json.backup",
  "dashell-learning.json",
  "dashell-learning.json.backup",
  "feeds.opml",
  "feeds.opml.backup",
  "portable-data-bundle.json.backup",
  "rss-dashboard-user-preferences.json",
  "rss-dashboard-user-preferences.json.backup",
  "userdata.json",
  "userdata.json.backup",
  "usersettings.json",
  "usersettings.json.backup",
]);
const SETTINGS_FILES = new Set([
  "data.json",
  "data.json.backup",
  "portable-data-bundle.json.backup",
  "rss-dashboard-user-preferences.json",
  "rss-dashboard-user-preferences.json.backup",
  "userdata.json",
  "userdata.json.backup",
  "usersettings.json",
  "usersettings.json.backup",
]);

class InvalidLegacyDataError extends Error {}

interface MigrationFile {
  sourcePath: string;
  destinationPath: string;
  content: string;
}

export type LegacyPluginMigrationResult =
  | { status: "no-legacy-data" | "already-migrated"; copiedFiles: 0 }
  | { status: "copied"; copiedFiles: number }
  | { status: "conflict" | "invalid" | "failed"; copiedFiles: number };

function pluginDirectory(app: App, manifest: PluginManifest): string {
  return normalizePath(
    manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`,
  );
}

function rewriteLegacyPath(
  value: unknown,
  sourceRoot: string,
  destinationRoot: string,
): unknown {
  if (typeof value !== "string") return value;
  const normalized = normalizePath(value.replace(/\\/g, "/"));
  const source = normalizePath(sourceRoot).replace(/\/$/, "");
  if (normalized.toLowerCase() === source.toLowerCase()) return destinationRoot;
  if (
    normalized.toLowerCase().startsWith(`${source}/`.toLowerCase())
  ) {
    return normalizePath(`${destinationRoot}/${normalized.slice(source.length + 1)}`);
  }
  return value;
}

function isWithinRoot(path: string, root: string): boolean {
  const normalizedPath = normalizePath(path).toLowerCase();
  const normalizedRoot = normalizePath(root).replace(/\/$/, "").toLowerCase();
  return normalizedPath.startsWith(`${normalizedRoot}/`);
}

function migrateSettingsPaths(
  content: string,
  sourceRoot: string,
  destinationRoot: string,
): string {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidLegacyDataError(
      "Legacy data.json does not contain a settings object",
    );
  }
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        key === "metadataStorageFolder" || key === "storageFolder"
          ? rewriteLegacyPath(nestedValue, sourceRoot, destinationRoot)
          : rewrite(nestedValue),
      ]),
    );
  };
  return JSON.stringify(rewrite(parsed));
}

async function collectDataFiles(
  app: App,
  sourceRoot: string,
  destinationRoot: string,
): Promise<MigrationFile[]> {
  const adapter = app.vault.adapter;
  const files: MigrationFile[] = [];
  const rootListing = await adapter.list(sourceRoot);
  for (const sourcePath of rootListing.files) {
    if (!isWithinRoot(sourcePath, sourceRoot)) {
      throw new Error("Legacy plugin data listing escaped its source folder");
    }
    const name = sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
    if (!ROOT_DATA_FILES.has(name)) continue;
    const rawContent = await adapter.read(sourcePath);
    let content = rawContent;
    if (SETTINGS_FILES.has(name)) {
      try {
        content = migrateSettingsPaths(rawContent, sourceRoot, destinationRoot);
      } catch (error) {
        if (name === "data.json") throw error;
      }
    }
    files.push({
      sourcePath,
      destinationPath: normalizePath(
        `${destinationRoot}/${sourcePath.slice(sourceRoot.length + 1)}`,
      ),
      content,
    });
  }

  const dataRoot = normalizePath(`${sourceRoot}/data`);
  if (await adapter.exists(dataRoot)) {
    const visit = async (folder: string): Promise<void> => {
      const listing = await adapter.list(folder);
      for (const sourcePath of listing.files) {
        if (!isWithinRoot(sourcePath, dataRoot)) {
          throw new Error("Legacy data listing escaped its source folder");
        }
        files.push({
          sourcePath,
          destinationPath: normalizePath(
            `${destinationRoot}/${sourcePath.slice(sourceRoot.length + 1)}`,
          ),
          content: await adapter.read(sourcePath),
        });
      }
      for (const childFolder of listing.folders) {
        if (!isWithinRoot(childFolder, dataRoot)) {
          throw new Error("Legacy data listing escaped its source folder");
        }
        await visit(childFolder);
      }
    };
    await visit(dataRoot);
  }
  return files;
}

async function ensureParentFolder(app: App, path: string): Promise<void> {
  const adapter = app.vault.adapter;
  const parent = path.slice(0, path.lastIndexOf("/"));
  if (parent && !(await adapter.exists(parent))) await adapter.mkdir(parent);
}

export async function migrateLegacyPluginData(
  app: App,
  manifest: PluginManifest,
): Promise<LegacyPluginMigrationResult> {
  const destinationRoot = pluginDirectory(app, manifest);
  const sourceRoot = normalizePath(
    `${app.vault.configDir}/plugins/${LEGACY_PLUGIN_ID}`,
  );
  if (sourceRoot.toLowerCase() === destinationRoot.toLowerCase()) {
    return { status: "no-legacy-data", copiedFiles: 0 };
  }

  let copiedFiles = 0;
  try {
    const markerPath = normalizePath(`${destinationRoot}/${MIGRATION_MARKER}`);
    if (await app.vault.adapter.exists(markerPath)) {
      const marker: unknown = JSON.parse(await app.vault.adapter.read(markerPath));
      if (!marker || typeof marker !== "object" ||
          !("version" in marker) || marker.version !== 1 ||
          !("sourceRoot" in marker) || marker.sourceRoot !== sourceRoot) {
        throw new InvalidLegacyDataError("Invalid legacy migration marker");
      }
      return { status: "already-migrated", copiedFiles: 0 };
    }
    if (!(await app.vault.adapter.exists(sourceRoot))) {
      return { status: "no-legacy-data", copiedFiles: 0 };
    }
    const files = await collectDataFiles(app, sourceRoot, destinationRoot);
    if (files.length === 0) {
      return { status: "no-legacy-data", copiedFiles: 0 };
    }

    for (const file of files) {
      if (!(await app.vault.adapter.exists(file.destinationPath))) continue;
      if ((await app.vault.adapter.read(file.destinationPath)) !== file.content) {
        return { status: "conflict", copiedFiles: 0 };
      }
    }

    for (const file of files) {
      if (await app.vault.adapter.exists(file.destinationPath)) continue;
      await ensureParentFolder(app, file.destinationPath);
      await app.vault.adapter.write(file.destinationPath, file.content);
      copiedFiles++;
    }
    await ensureParentFolder(app, markerPath);
    await app.vault.adapter.write(
      markerPath,
      JSON.stringify({ version: 1, sourceRoot, completedAt: Date.now() }),
    );
    return copiedFiles > 0
      ? { status: "copied", copiedFiles }
      : { status: "already-migrated", copiedFiles: 0 };
  } catch (error) {
    return {
      status:
        error instanceof SyntaxError || error instanceof InvalidLegacyDataError
          ? "invalid"
          : "failed",
      copiedFiles,
    };
  }
}
