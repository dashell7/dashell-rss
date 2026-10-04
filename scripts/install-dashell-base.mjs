import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  readSession,
  inspect,
  evaluate,
  PLUGIN_ID,
  ASSETS,
  normalize,
} from "./dashell-host-session.mjs";

const session = readSession(process.argv[2]);
const identity = inspect(session);
if (identity.pluginLoaded)
  throw new Error("Dashell RSS is already loaded; refusing to replace live assets.");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (manifest.id !== PLUGIN_ID)
  throw new Error("Candidate ID must match the Dashell RSS installation.");

const target = session.pluginDir;
const legacyTarget = path.join(
  session.vault,
  session.configDir,
  "plugins",
  "rss-dashboard",
);
if (normalize(target) === normalize(legacyTarget))
  throw new Error("The new plugin ID must use a separate plugin directory.");
if (fs.existsSync(target) && fs.readdirSync(target).length > 0)
  throw new Error("Dashell plugin folder contains data; inspect it before testing migration.");
if (!fs.existsSync(legacyTarget))
  throw new Error("The legacy RSS Dashboard plugin folder is missing.");

const configPath = path.join(session.vault, session.configDir, "community-plugins.json");
const enabledPlugins = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!Array.isArray(enabledPlugins) || !enabledPlugins.includes("rss-dashboard"))
  throw new Error("The existing RSS Dashboard plugin is not enabled in this vault.");
const backup = path.join(session.sessionRoot, `dashell-id-migration-backup-${Date.now()}`);
fs.mkdirSync(backup);
fs.copyFileSync(configPath, path.join(backup, "community-plugins.json"));
fs.writeFileSync(
  path.join(backup, "workspace.json"),
  JSON.stringify(evaluate(session, "app.workspace.getLayout()")),
);

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function dataSnapshot(root) {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    if (fs.statSync(directory).isFile()) {
      files.push([path.relative(root, directory), hash(fs.readFileSync(directory))]);
      return;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else files.push([path.relative(root, fullPath), hash(fs.readFileSync(fullPath))]);
    }
  };
  for (const name of [
    "data.json",
    "data.json.backup",
    "data",
    "dashell-learning.json",
    "dashell-learning.json.backup",
    "feeds.opml.backup",
    "rss-dashboard-user-preferences.json.backup",
  ]) visit(path.join(root, name));
  return Object.fromEntries(files.sort(([left], [right]) => left.localeCompare(right)));
}

const legacyDataBefore = dataSnapshot(legacyTarget);
const legacyLearningPath = path.join(legacyTarget, "dashell-learning.json");
const legacyLearningState = JSON.parse(fs.readFileSync(legacyLearningPath, "utf8"));
const legacyLearningCount = Array.isArray(legacyLearningState.materials)
  ? legacyLearningState.materials.length
  : 0;

const previous = evaluate(
  session,
  `(()=>{const p=app.plugins.getPlugin("rss-dashboard");if(!p)throw new Error("Legacy RSS Dashboard is not loaded");const feeds=p.settings.feeds||[];return {feedCount:feeds.length,articleCount:feeds.reduce((n,f)=>n+(f.items||[]).length,0),readCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.read).length,0),starredCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.starred).length,0),learningCount:${legacyLearningCount},theme:app.vault.getConfig("cssTheme")};})()`,
);
if (!Object.keys(legacyDataBefore).some((name) => name === "data.json"))
  throw new Error("Legacy settings file is missing; refusing to test the ID migration.");

fs.mkdirSync(target, { recursive: true });
for (const asset of ASSETS) fs.copyFileSync(asset, path.join(target, asset));
const nextEnabledPlugins = enabledPlugins.filter((id) => id !== "rss-dashboard");
if (!nextEnabledPlugins.includes(PLUGIN_ID)) nextEnabledPlugins.push(PLUGIN_ID);
fs.writeFileSync(configPath, JSON.stringify(nextEnabledPlugins, null, 2));

try {
  evaluate(
    session,
    '(async()=>{await app.plugins.disablePluginAndSave("rss-dashboard");return true;})()',
  );
  fs.cpSync(legacyTarget, path.join(backup, "legacy-plugin"), { recursive: true });
  evaluate(
    session,
    '(async()=>{await app.plugins.loadManifests();await app.plugins.enablePluginAndSave("dashell-rss");const p=app.plugins.getPlugin("dashell-rss");if(!p)throw new Error("Dashell RSS did not load");await p.activateView();return true;})()',
  );
  const after = evaluate(
    session,
    '(()=>{const p=app.plugins.getPlugin("dashell-rss");return {version:p.manifest.version,pluginId:p.manifest.id,feedCount:p.settings.feeds.length,articleCount:p.settings.feeds.reduce((n,f)=>n+(f.items||[]).length,0),readCount:p.settings.feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.read).length,0),starredCount:p.settings.feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.starred).length,0),learningCount:p.dashellLearning?.store.state.materials.length??0,storageFolder:p.settings.storageFolder,metadataStorageFolder:p.settings.metadataStorageFolder,theme:app.vault.getConfig("cssTheme")};})()',
  );
  if (after.pluginId !== PLUGIN_ID || after.feedCount !== previous.feedCount ||
      after.articleCount !== previous.articleCount || after.readCount !== previous.readCount ||
      after.starredCount !== previous.starredCount || after.learningCount !== previous.learningCount ||
      after.theme !== previous.theme)
    throw new Error("The new plugin did not preserve all observed RSS and learning records.");
  if (after.storageFolder.startsWith(`${session.configDir}/plugins/rss-dashboard/`))
    throw new Error("The feed shard path still points into the legacy plugin folder.");
  const legacyDataAfter = dataSnapshot(legacyTarget);
  if (JSON.stringify(legacyDataAfter) !== JSON.stringify(legacyDataBefore))
    throw new Error("The legacy plugin data changed during migration.");
  const result = {
    target,
    backup,
    previous,
    candidate: after,
    legacyDataFilesUnchanged: Object.keys(legacyDataAfter).length,
    actualVault: identity.vault,
    assets: Object.fromEntries(
      ASSETS.map((asset) => [asset, hash(fs.readFileSync(path.join(target, asset)))]),
    ),
  };
  fs.writeFileSync(
    path.join(session.sessionRoot, "id-migration-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const restored = JSON.parse(fs.readFileSync(path.join(backup, "community-plugins.json"), "utf8"));
  fs.writeFileSync(configPath, JSON.stringify(restored, null, 2));
  try {
    evaluate(
      session,
      '(async()=>{await app.plugins.disablePluginAndSave("dashell-rss");await app.plugins.loadManifests();await app.plugins.enablePluginAndSave("rss-dashboard");return true;})()',
    );
  } catch {
    // Keep all migrated files and report the host error without deleting user data.
  }
  throw error;
}
