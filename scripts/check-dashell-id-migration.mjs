import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  readSession,
  inspect,
  evaluate,
} from "./dashell-host-session.mjs";

const session = readSession(process.argv[2]);
const identity = inspect(session);
const legacyDirectory = path.join(
  session.vault,
  session.configDir,
  "plugins",
  "rss-dashboard",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(session.pluginDir, "manifest.json"), "utf8"),
);
if (manifest.id !== "dashell-rss")
  throw new Error("The candidate manifest does not use the new plugin ID.");

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function treeSnapshot(root) {
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

const oldLearning = JSON.parse(
  fs.readFileSync(path.join(legacyDirectory, "dashell-learning.json"), "utf8"),
);
const before = evaluate(
  session,
  `(()=>{const p=app.plugins.getPlugin("rss-dashboard");if(!p)throw new Error("Legacy RSS Dashboard is not loaded");const feeds=p.settings.feeds||[];return {feedCount:feeds.length,articleCount:feeds.reduce((n,f)=>n+(f.items||[]).length,0),readCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.read).length,0),starredCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.starred).length,0),learningCount:${oldLearning.materials.length},theme:app.vault.getConfig("cssTheme")};})()`,
);
const legacyFilesBefore = treeSnapshot(legacyDirectory);

const loadCandidate = () =>
  evaluate(
    session,
    '(async()=>{await app.plugins.disablePluginAndSave("rss-dashboard");await app.plugins.loadManifests();await app.plugins.enablePluginAndSave("dashell-rss");const p=app.plugins.getPlugin("dashell-rss");if(!p)throw new Error("Dashell RSS did not load");await p.activateView();return true;})()',
  );
const readCandidate = () =>
  evaluate(
    session,
    '(()=>{const p=app.plugins.getPlugin("dashell-rss");const feeds=p.settings.feeds||[];return {pluginId:p.manifest.id,version:p.manifest.version,feedCount:feeds.length,articleCount:feeds.reduce((n,f)=>n+(f.items||[]).length,0),readCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.read).length,0),starredCount:feeds.reduce((n,f)=>n+(f.items||[]).filter(i=>i.starred).length,0),learningCount:p.dashellLearning?.store.state.materials.length??0,storageFolder:p.settings.storageFolder,metadataStorageFolder:p.settings.metadataStorageFolder,theme:app.vault.getConfig("cssTheme")};})()',
  );

loadCandidate();
const firstLoad = readCandidate();
if (firstLoad.pluginId !== "dashell-rss" ||
    firstLoad.feedCount !== before.feedCount ||
    firstLoad.articleCount !== before.articleCount ||
    firstLoad.readCount !== before.readCount ||
    firstLoad.starredCount !== before.starredCount ||
    firstLoad.learningCount !== before.learningCount ||
    firstLoad.theme !== before.theme)
  throw new Error(`Migrated data differs: ${JSON.stringify({ before, after: firstLoad })}`);
if (firstLoad.storageFolder.includes("/plugins/rss-dashboard/") ||
    firstLoad.metadataStorageFolder.includes("/plugins/rss-dashboard/"))
  throw new Error("Plugin-local storage still points to the old plugin ID.");

evaluate(
  session,
  '(async()=>{await app.plugins.disablePluginAndSave("dashell-rss");await app.plugins.loadManifests();await app.plugins.enablePluginAndSave("dashell-rss");return true;})()',
);
const afterRestart = readCandidate();
if (JSON.stringify(afterRestart) !== JSON.stringify(firstLoad))
  throw new Error("Candidate data changed after a plugin reload.");
const legacyFilesAfter = treeSnapshot(legacyDirectory);
if (JSON.stringify(legacyFilesAfter) !== JSON.stringify(legacyFilesBefore))
  throw new Error("The old RSS Dashboard data changed during migration.");
const result = {
  actualVault: identity.vault,
  previous: before,
  candidate: firstLoad,
  reload: afterRestart,
  legacyFilesPreserved: Object.keys(legacyFilesAfter).length,
  oldDirectory: legacyDirectory,
  newDirectory: session.pluginDir,
};
fs.writeFileSync(
  path.join(session.sessionRoot, "id-migration-result.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
