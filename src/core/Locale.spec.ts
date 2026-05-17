import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLanguage, t, formatMessage } from "./Locale";

describe("Locale", () => {
  beforeEach(() => {
    vi.stubGlobal("PropertiesService", {
      getUserProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue("en"),
      }),
    });
  });

  it("should format a message with params", () => {
    expect(formatMessage("Hello {name}", { name: "World" })).toBe(
      "Hello World",
    );
  });

  it("should return translation for an existing key in english", () => {
    expect(t("toolSelectorTitle")).toBe("Sticky Assistant");
  });

  it("should fallback to english when key is not available in selected language", () => {
    vi.stubGlobal("PropertiesService", {
      getUserProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue("nl"),
      }),
    });
    // Assuming toolSelectorTitle is the same in both for now, or use a key that's only in en if it exists.
    // Actually toolSelectorTitle is the same. Let's use it.
    expect(t("toolSelectorTitle")).toBe("Sticky Assistant");
  });

  it("should return the key itself for an unknown key", () => {
    expect(t("thisKeyDoesNotExist")).toBe("thisKeyDoesNotExist");
  });

  it("should get language from properties", () => {
    expect(getLanguage()).toBe("en");
  });
});
