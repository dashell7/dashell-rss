import fs from "node:fs";
import path from "node:path";
import {
  VAULT,
  PLUGIN_ID,
  PURPOSE,
  mainProcesses,
  normalize,
  designatedRegistration,
  inspect,
} from "./dashell-host-session.mjs";
const [sessionRoot, configDir] = process.argv.slice(2);
if (!configDir)
  throw new Error(
    "Pass the actual vault configuration directory as the second argument.",
  );
if (!sessionRoot || fs.existsSync(sessionRoot))
  throw new Error("Pass a new host report folder outside the vault.");
if (normalize(sessionRoot).startsWith(normalize(VAULT)))
  throw new Error("Reports must be outside the vault.");
const profile = path.join(process.env.APPDATA, "obsidian");
const owners = mainProcesses().filter(
  (item) => normalize(item.profile) === normalize(profile),
);
if (owners.length !== 1)
  throw new Error("Expected one running Obsidian main process.");
const session = {
  transport: "obsidian-cli",
  sessionRoot: path.resolve(sessionRoot),
  profile,
  vault: VAULT,
  vaultId: designatedRegistration(profile),
  processId: owners[0].processId,
  configDir,
  pluginDir: path.join(VAULT, configDir, "plugins", PLUGIN_ID),
  obsidianCli:
    process.env.OBSIDIAN_CLI_PATH ||
    path.join(process.env.ProgramFiles || "C:/Program Files", "Obsidian", "Obsidian.com"),
};
if (!fs.existsSync(session.pluginDir)) fs.mkdirSync(session.pluginDir);
if (!fs.statSync(session.pluginDir).isDirectory())
  throw new Error("The Dashell RSS target is not a plugin directory.");
session.initialIdentity = inspect(session);
fs.mkdirSync(sessionRoot);
fs.writeFileSync(
  path.join(sessionRoot, "dashell-host-marker.json"),
  JSON.stringify({ purpose: PURPOSE, vault: VAULT }),
);
fs.writeFileSync(
  path.join(sessionRoot, "session.json"),
  JSON.stringify(session, null, 2),
);
console.log(
  JSON.stringify({
    session: path.join(sessionRoot, "session.json"),
    vault: session.initialIdentity.vault,
  }),
);
