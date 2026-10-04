// Developer-only transport. Never imported by the distributed plugin.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const configuredVault = process.env.DASHELL_TEST_VAULT?.trim();
if (!configuredVault)
  throw new Error("Set DASHELL_TEST_VAULT to the existing Obsidian test vault.");
export const VAULT = path.win32.resolve(configuredVault);
export const PLUGIN_ID = "dashell-rss";
export const PURPOSE = "designated-existing-vault-test";
export const ASSETS = ["main.js", "manifest.json", "styles.css"];
const RESULT_MARKER = "DASHELL_HOST_RESULT:";
export const normalize = (value) =>
  path.win32
    .resolve(value)
    .replace(/[\\/]+$/, "")
    .toLowerCase();

function run(binary, args) {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Host helper failed (${path.basename(binary)}): ${result.error?.message || `exit ${result.status}`}`,
    );
  return result.stdout.trim();
}

export function mainProcesses() {
  if (process.platform !== "win32")
    throw new Error("The designated host harness requires Windows.");
  const command =
    "@(Get-CimInstance Win32_Process -Filter \"Name='Obsidian.exe'\" | Where-Object { -not $_.CommandLine -or $_.CommandLine -notmatch '(?:^|\\s)--type=' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress";
  const raw = run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    command,
  ]);
  const entries = raw ? JSON.parse(raw) : [];
  return (Array.isArray(entries) ? entries : [entries]).map((entry) => {
    if (!entry.CommandLine)
      throw new Error(
        "An Obsidian main process has an unreadable command line; refusing to guess its profile.",
      );
    const match = /(?:^|\s)--user-data-dir(?:=|\s+)(?:"([^"]+)"|(\S+))/i.exec(
      entry.CommandLine,
    );
    return {
      processId: entry.ProcessId,
      profile:
        match?.[1] || match?.[2] || path.join(process.env.APPDATA, "obsidian"),
    };
  });
}

export function designatedRegistration(profile) {
  const registry = JSON.parse(
    fs.readFileSync(path.join(profile, "obsidian.json"), "utf8"),
  );
  const matches = Object.entries(registry.vaults || {}).filter(
    ([, item]) => item.path && normalize(item.path) === normalize(VAULT),
  );
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one registration for ${VAULT} in the selected profile.`,
    );
  const [vaultId, record] = matches[0];
  if (!record.open)
    throw new Error(
      "The designated vault is not recorded as open; open that existing vault before attaching.",
    );
  return vaultId;
}

export function assertRunning(session) {
  const running = mainProcesses();
  const owner = running.find(
    (item) =>
      item.processId === session.processId &&
      normalize(item.profile) === normalize(session.profile),
  );
  if (!owner)
    throw new Error(
      "The recorded Obsidian PID/profile is no longer running; attach a new session instead of launching another instance.",
    );
  if (designatedRegistration(session.profile) !== session.vaultId)
    throw new Error("The designated vault registration changed.");
  for (const item of running.filter(
    (item) => item.processId !== session.processId,
  )) {
    let registry;
    try {
      registry = JSON.parse(
        fs.readFileSync(path.join(item.profile, "obsidian.json"), "utf8"),
      );
    } catch {
      throw new Error(
        `Cannot verify the vaults in another running Obsidian profile (PID ${item.processId}).`,
      );
    }
    if (
      Object.values(registry.vaults || {}).some(
        (vault) =>
          vault.open &&
          vault.path &&
          normalize(vault.path) === normalize(VAULT),
      )
    ) {
      throw new Error(
        `Another Obsidian process also has ${VAULT} open; refusing concurrent host operations.`,
      );
    }
  }
}

export function assertPaths(session) {
  if (
    session.transport !== "obsidian-cli" ||
    normalize(session.vault) !== normalize(VAULT)
  )
    throw new Error(`Only the designated existing ${VAULT} vault is allowed.`);
  const configDir = session.configDir ?? session.initialIdentity?.configDir;
  if (
    typeof configDir !== "string" ||
    !/^[.a-zA-Z0-9_-]+$/.test(configDir) ||
    [".", ".."].includes(configDir)
  )
    throw new Error(
      "Pass the actual vault configuration directory when attaching.",
    );
  const pluginDir = path.join(VAULT, configDir, "plugins", PLUGIN_ID);
  if (normalize(session.pluginDir) !== normalize(pluginDir))
    throw new Error("Unexpected plugin directory.");
  if (
    normalize(fs.realpathSync(VAULT)) !== normalize(VAULT) ||
    normalize(fs.realpathSync(pluginDir)) !== normalize(pluginDir)
  ) {
    throw new Error(
      "The designated vault/plugin directory must not redirect through a junction or symlink.",
    );
  }
  if (!Number.isInteger(session.processId) || session.processId <= 0)
    throw new Error("Invalid host PID.");
  if (!/^[a-zA-Z0-9_-]+$/.test(session.vaultId))
    throw new Error("Invalid registered vault ID.");
}

export function readSession(sessionPath) {
  const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  const marker = JSON.parse(
    fs.readFileSync(
      path.join(session.sessionRoot, "dashell-host-marker.json"),
      "utf8",
    ),
  );
  if (
    marker.purpose !== PURPOSE ||
    normalize(marker.vault) !== normalize(VAULT)
  )
    throw new Error(
      "Not a designated-vault session. Historical synthetic sessions are disabled.",
    );
  if (
    normalize(sessionPath) !==
    normalize(path.join(session.sessionRoot, "session.json"))
  )
    throw new Error(
      "Session descriptor must remain in its recorded session directory.",
    );
  assertPaths(session);
  return session;
}

const identityCode = `(()=>{const remote=require('@electron/remote');return {vault:app.vault.adapter.getBasePath(),name:app.vault.getName(),profile:remote.app.getPath('userData'),processId:remote.getGlobal('process').pid,executable:remote.getGlobal('process').execPath,userAgent:navigator.userAgent,title:document.title,configDir:app.vault.configDir,pluginLoaded:!!app.plugins.plugins['${PLUGIN_ID}'],pluginVersion:app.plugins.plugins['${PLUGIN_ID}']?.manifest.version};})()`;

export function evaluate(session, expression) {
  assertPaths(session);
  assertRunning(session); // Prevent the CLI redirector from launching a new app.
  const payload = Buffer.from(expression, "utf8").toString("base64");
  if (payload.length > 23000)
    throw new Error(
      "Host expression exceeds the Windows CLI size limit; split it into smaller operations.",
    );
  // Check identity in the SAME renderer evaluation as the requested operation.
  // Names are ambiguous: the C: daily vault has the same name as the F: vault.
  const code = `(async()=>{try{const remote=require('@electron/remote');const norm=p=>require('path').win32.resolve(p).replace(/[\\\\/]+$/,'').toLowerCase();if(norm(app.vault.adapter.getBasePath())!==norm(${JSON.stringify(VAULT)})||norm(remote.app.getPath('userData'))!==norm(${JSON.stringify(session.profile)})||remote.getGlobal('process').pid!==${session.processId}||app.vault.configDir!==${JSON.stringify(session.configDir ?? session.initialIdentity?.configDir)})throw new Error('Actual vault/profile/PID differs from the designated session');const value=await (0,eval)(require('buffer').Buffer.from('${payload}','base64').toString('utf8'));return '${RESULT_MARKER}'+JSON.stringify({ok:true,value});}catch(error){return '${RESULT_MARKER}'+JSON.stringify({ok:false,error:String(error?.message||error)});}})()`;
  const output = run(session.obsidianCli, [
    `vault=${session.vaultId}`,
    "eval",
    `code=${code}`,
  ]);
  const line = output
    .split(/\r?\n/)
    .find((item) => item.includes(RESULT_MARKER));
  if (!line)
    throw new Error(
      "Obsidian CLI returned no verified result. No successful host operation can be inferred.",
    );
  const result = JSON.parse(
    line.slice(line.indexOf(RESULT_MARKER) + RESULT_MARKER.length),
  );
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export function inspect(session) {
  return evaluate(session, identityCode);
}

export function diagnosticCommand(session, command, args = []) {
  if (!["dev:errors", "dev:console", "dev:screenshot"].includes(command))
    throw new Error("Only read-only diagnostic CLI commands are allowed here.");
  inspect(session);
  return run(session.obsidianCli, [
    `vault=${session.vaultId}`,
    command,
    ...args,
  ]);
}
