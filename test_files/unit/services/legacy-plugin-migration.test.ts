import { App, type PluginManifest } from "obsidian";
import { describe, expect, it } from "vitest";
import { migrateLegacyPluginData } from "../../../src/services/legacy-plugin-migration";

const legacyRoot = ".vault-config/plugins/rss-dashboard";
const targetRoot = ".vault-config/plugins/dashell-rss";
const previousDashellRoot = ".vault-config/plugins/dshell-rss";

function manifest(
  app: ReturnType<typeof App.createMock>,
  id = "dashell-rss",
): PluginManifest {
  return {
    id,
    name: "Dashell RSS",
    version: "2.7.3",
    minAppVersion: "1.8.7",
    description: "",
    author: "dashell",
    dir: `${app.vault.configDir}/plugins/${id}`,
  };
}

async function write(app: ReturnType<typeof App.createMock>, path: string, content: string): Promise<void> {
  const parent = path.slice(0, path.lastIndexOf("/"));
  await app.vault.adapter.mkdir(parent);
  await app.vault.adapter.write(path, content);
}

describe("legacy plugin data migration", () => {
  it("copies settings, shards, learning records, and redirects only plugin-local storage paths", async () => {
    const app = App.createMock();
    const settings = JSON.stringify({
      storageMode: "vault-shards-v2",
      storageFolder: `${legacyRoot}/data/feeds`,
      metadataStorageFolder: `${legacyRoot}/data`,
      customFolder: "My English Data",
      portableBundle: {
        settings: {
          storageFolder: `${legacyRoot}/data/feeds`,
        },
      },
    });
    await write(app, `${legacyRoot}/data.json`, settings);
    await write(app, `${legacyRoot}/data/feeds/feed-1.json`, "{\"items\":[]}");
    await write(app, `${legacyRoot}/data/user-state.json`, "{\"states\":{}}");
    await write(app, `${legacyRoot}/dashell-learning.json`, "{\"materials\":[]}");

    const result = await migrateLegacyPluginData(app, manifest(app));

    expect(result).toEqual({ status: "copied", copiedFiles: 4 });
    const migrated = JSON.parse(
      await app.vault.adapter.read(`${targetRoot}/data.json`),
    ) as Record<string, unknown>;
    expect(migrated.storageFolder).toBe(`${targetRoot}/data/feeds`);
    expect(migrated.metadataStorageFolder).toBe(`${targetRoot}/data`);
    expect(migrated.customFolder).toBe("My English Data");
    expect(migrated.portableBundle).toEqual({
      settings: { storageFolder: `${targetRoot}/data/feeds` },
    });
    expect(await app.vault.adapter.read(`${targetRoot}/data/feeds/feed-1.json`))
      .toBe("{\"items\":[]}");
    expect(await app.vault.adapter.exists(`${legacyRoot}/data/feeds/feed-1.json`))
      .toBe(true);
  });

  it("does not overwrite an existing Dashell data file when contents differ", async () => {
    const app = App.createMock();
    await write(app, `${legacyRoot}/dashell-learning.json`, "legacy");
    await write(app, `${targetRoot}/dashell-learning.json`, "newer");

    const result = await migrateLegacyPluginData(app, manifest(app));

    expect(result).toEqual({ status: "conflict", copiedFiles: 0 });
    expect(await app.vault.adapter.read(`${legacyRoot}/dashell-learning.json`))
      .toBe("legacy");
    expect(await app.vault.adapter.read(`${targetRoot}/dashell-learning.json`))
      .toBe("newer");
  });

  it("keeps user-selected vault storage paths unchanged", async () => {
    const app = App.createMock();
    await write(
      app,
      `${legacyRoot}/data.json`,
      JSON.stringify({
        storageFolder: "My English Data/Feeds",
        metadataStorageFolder: "My English Data/Metadata",
      }),
    );

    await migrateLegacyPluginData(app, manifest(app));

    const migrated = JSON.parse(
      await app.vault.adapter.read(`${targetRoot}/data.json`),
    ) as Record<string, unknown>;
    expect(migrated.storageFolder).toBe("My English Data/Feeds");
    expect(migrated.metadataStorageFolder).toBe("My English Data/Metadata");
  });

  it("updates plugin-local storage paths inside settings backups", async () => {
    const app = App.createMock();
    await write(
      app,
      `${legacyRoot}/data.json.backup`,
      JSON.stringify({
        settings: {
          storageFolder: `${legacyRoot}/data/feeds`,
        },
      }),
    );

    await migrateLegacyPluginData(app, manifest(app));

    expect(
      JSON.parse(await app.vault.adapter.read(`${targetRoot}/data.json.backup`)),
    ).toEqual({ settings: { storageFolder: `${targetRoot}/data/feeds` } });
  });

  it("does not copy a malformed settings file", async () => {
    const app = App.createMock();
    await write(app, `${legacyRoot}/data.json`, "not json");
    await write(app, `${legacyRoot}/data/feeds/feed-1.json`, "{\"items\":[]}");

    const result = await migrateLegacyPluginData(app, manifest(app));

    expect(result).toEqual({ status: "invalid", copiedFiles: 0 });
    expect(await app.vault.adapter.exists(`${targetRoot}/data/feeds/feed-1.json`))
      .toBe(false);
    expect(await app.vault.adapter.read(`${legacyRoot}/data.json`)).toBe("not json");
  });

  it("can retry after a complete copy without creating a second copy", async () => {
    const app = App.createMock();
    await write(app, `${legacyRoot}/dashell-learning.json`, "{\"materials\":[]}");

    expect(await migrateLegacyPluginData(app, manifest(app))).toEqual({
      status: "copied",
      copiedFiles: 1,
    });
    expect(await migrateLegacyPluginData(app, manifest(app))).toEqual({
      status: "already-migrated",
      copiedFiles: 0,
    });
  });

  it("resumes a partial copy on the next startup", async () => {
    const app = App.createMock();
    await write(app, `${legacyRoot}/first.json`, "ignored");
    await write(app, `${legacyRoot}/dashell-learning.json`, "learning");
    await write(app, `${legacyRoot}/data.json`, JSON.stringify({ feeds: [] }));
    const originalWrite = app.vault.adapter.write.bind(app.vault.adapter);
    let failOnce = true;
    app.vault.adapter.write = async (path, content) => {
      if (path === `${targetRoot}/data.json` && failOnce) {
        failOnce = false;
        throw new Error("disk unavailable");
      }
      await originalWrite(path, content);
    };

    expect(await migrateLegacyPluginData(app, manifest(app))).toEqual({
      status: "failed",
      copiedFiles: 1,
    });
    expect(await migrateLegacyPluginData(app, manifest(app))).toEqual({
      status: "copied",
      copiedFiles: 1,
    });
    expect(await app.vault.adapter.read(`${targetRoot}/data.json`)).toBe(
      JSON.stringify({ feeds: [] }),
    );
  });

  it("keeps normal edits after migration when the plugin restarts", async () => {
    const app = App.createMock();
    await write(app, `${legacyRoot}/data.json`, JSON.stringify({ feeds: [] }));
    await migrateLegacyPluginData(app, manifest(app));
    const edited = JSON.stringify({ feeds: [{ title: "New subscription" }] });
    await app.vault.adapter.write(`${targetRoot}/data.json`, edited);

    expect(await migrateLegacyPluginData(app, manifest(app))).toEqual({
      status: "already-migrated",
      copiedFiles: 0,
    });
    expect(await app.vault.adapter.read(`${targetRoot}/data.json`)).toBe(edited);
  });

  it("copies previous Dashell RSS data into the final plugin folder and keeps the source", async () => {
    const app = App.createMock();
    const oldSettings = JSON.stringify({
      storageFolder: `${previousDashellRoot}/data/feeds`,
      metadataStorageFolder: `${previousDashellRoot}/data`,
    });
    await write(app, `${previousDashellRoot}/data.json`, oldSettings);
    await write(app, `${previousDashellRoot}/data/feeds/feed-1.json`, "feed-data");
    await write(app, `${previousDashellRoot}/dashell-learning.json`, "learning-data");

    const result = await migrateLegacyPluginData(
      app,
      manifest(app),
      "dshell-rss",
    );

    expect(result).toEqual({ status: "copied", copiedFiles: 3 });
    const migratedSettings = JSON.parse(
      await app.vault.adapter.read(`${targetRoot}/data.json`),
    ) as Record<string, unknown>;
    expect(migratedSettings.storageFolder).toBe(`${targetRoot}/data/feeds`);
    expect(migratedSettings.metadataStorageFolder).toBe(`${targetRoot}/data`);
    expect(await app.vault.adapter.read(`${targetRoot}/data/feeds/feed-1.json`))
      .toBe("feed-data");
    expect(await app.vault.adapter.read(`${targetRoot}/dashell-learning.json`))
      .toBe("learning-data");
    expect(await app.vault.adapter.read(`${previousDashellRoot}/data.json`))
      .toBe(oldSettings);
    expect(await app.vault.adapter.exists(`${previousDashellRoot}/data/feeds/feed-1.json`))
      .toBe(true);
  });
});
