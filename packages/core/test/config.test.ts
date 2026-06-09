import { describe, expect, it } from "vitest";
import {
  configured,
  deriveErrorEndpoint,
  deriveReportBaseUrl,
  environmentEnabled,
  errorTrackingEnabled,
  resolveConfig,
} from "../src/config";

describe("config derivations", () => {
  it("derives the error endpoint by swapping the last path segment to /store", () => {
    expect(deriveErrorEndpoint("https://dispatchit.app/api/v1/tickets")).toBe(
      "https://dispatchit.app/api/v1/store",
    );
    expect(deriveErrorEndpoint("https://acme.dispatchit.app/api/v1/tickets")).toBe(
      "https://acme.dispatchit.app/api/v1/store",
    );
  });

  it("derives the report base URL from the endpoint origin", () => {
    expect(deriveReportBaseUrl("https://acme.dispatchit.app/api/v1/tickets")).toBe(
      "https://acme.dispatchit.app",
    );
    expect(deriveReportBaseUrl("not a url")).toBeNull();
  });

  it("applies defaults", () => {
    const c = resolveConfig({ apiKey: "dsp_live_x" });
    expect(c.endpoint).toBe("https://dispatchit.app/api/v1/tickets");
    expect(c.errorEndpoint).toBe("https://dispatchit.app/api/v1/store");
    expect(c.enabledEnvironments).toEqual(["production", "staging"]);
    expect(c.errorSampleRate).toBe(1.0);
    expect(c.captureExceptions).toBe(true);
    expect(c.sdk.name).toBe("dispatch-js");
    expect(c.shutdownTimeout).toBe(3000);
  });

  it("honours an explicit shutdownTimeout (including 0 to disable the exit flush)", () => {
    expect(resolveConfig({ apiKey: "x", shutdownTimeout: 0 }).shutdownTimeout).toBe(0);
  });

  it("honours an explicit errorEndpoint override", () => {
    const c = resolveConfig({ apiKey: "x", errorEndpoint: "https://eu.example/ingest" });
    expect(c.errorEndpoint).toBe("https://eu.example/ingest");
  });

  it("gates on configured / environment / capture flags", () => {
    const c = resolveConfig({ apiKey: "x", environment: "production" });
    expect(configured(c)).toBe(true);
    expect(environmentEnabled(c)).toBe(true);
    expect(errorTrackingEnabled(c)).toBe(true);

    const dev = resolveConfig({ apiKey: "x", environment: "development" });
    expect(environmentEnabled(dev)).toBe(false);

    const all = resolveConfig({ apiKey: "x", environment: "development", enabledEnvironments: [] });
    expect(environmentEnabled(all)).toBe(true);

    const off = resolveConfig({ apiKey: "x", environment: "production", captureExceptions: false });
    expect(errorTrackingEnabled(off)).toBe(false);

    const noKey = resolveConfig({ apiKey: "" });
    expect(configured(noKey)).toBe(false);
  });
});
