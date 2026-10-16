import { installObsidianDomPolyfills } from "./test-dom-polyfills";
import { resetFeedIconFailureCache } from "../../src/utils/favicon-utils";
import { beforeEach, afterEach } from "vitest";
import { disposeReadRequests } from "../../src/utils/read-request";

installObsidianDomPolyfills();

beforeEach(() => {
  disposeReadRequests();
  resetFeedIconFailureCache();
});
afterEach(() => disposeReadRequests());
