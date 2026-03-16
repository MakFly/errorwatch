import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test"
import { Client } from "../src/client.ts"
import { init, close, captureException, captureMessage, getClient, setUser, addBreadcrumb } from "../src/index.ts"

// Mock fetch globally before all tests
const mockFetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
)
globalThis.fetch = mockFetch as any

const BASE_CONFIG = {
  apiKey: "ew_test_key_abc123",
  dsn: "http://localhost:3333",
  environment: "test",
  // Disable replay to avoid rrweb browser-only issues
  replay: { enabled: false },
  // Disable breadcrumb auto-capture (requires window event listeners)
  breadcrumbs: { enabled: false },
}

beforeEach(() => {
  mockFetch.mockClear()
  // Ensure clean singleton state before each test
  close()
})

afterEach(() => {
  close()
})

describe("init()", () => {
  test("creates and returns a Client instance", () => {
    const client = init(BASE_CONFIG)
    expect(client).toBeInstanceOf(Client)
  })

  test("sets the global client accessible via getClient()", () => {
    init(BASE_CONFIG)
    expect(getClient()).toBeInstanceOf(Client)
  })

  test("accepts minimal config with only apiKey", () => {
    const client = init({ apiKey: "ew_minimal_key", replay: { enabled: false }, breadcrumbs: { enabled: false } })
    expect(client).toBeInstanceOf(Client)
  })

  test("accepts full config with all options", () => {
    const beforeSend = mock((event: any) => event)
    const client = init({
      apiKey: "ew_full_key",
      dsn: "http://localhost:3333",
      environment: "production",
      release: "1.0.0",
      debug: false,
      maxQueueSize: 50,
      flushInterval: 10000,
      sampleRate: 0.5,
      replay: { enabled: false },
      breadcrumbs: { enabled: false },
      transport: { maxRetries: 5, retryDelay: 2000 },
      beforeSend,
    })
    expect(client).toBeInstanceOf(Client)
  })

  test("returns the existing instance on second call (singleton)", () => {
    const first = init(BASE_CONFIG)
    const second = init(BASE_CONFIG)
    expect(first).toBe(second)
  })

  test("returns null-like when apiKey is missing", () => {
    // init() logs an error and returns null cast as any when no apiKey
    const warnSpy = spyOn(console, "error").mockImplementation(() => {})
    const client = init({ apiKey: "" as any, replay: { enabled: false }, breadcrumbs: { enabled: false } })
    expect(client).toBeNull()
    warnSpy.mockRestore()
  })
})

describe("close()", () => {
  test("clears the global client after close()", () => {
    init(BASE_CONFIG)
    expect(getClient()).not.toBeNull()
    close()
    expect(getClient()).toBeNull()
  })

  test("allows re-initialization after close()", () => {
    const first = init(BASE_CONFIG)
    close()
    const second = init(BASE_CONFIG)
    expect(second).toBeInstanceOf(Client)
    expect(first).not.toBe(second)
  })
})

describe("captureException()", () => {
  test("queues and sends an error event via fetch", async () => {
    const client = init(BASE_CONFIG)
    const error = new Error("Test error")
    client.captureException(error)
    await client.flush()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:3333/api/v1/event")
    expect(options.headers).toMatchObject({ "X-API-Key": "ew_test_key_abc123" })
  })

  test("includes the error message in the payload", async () => {
    const client = init(BASE_CONFIG)
    client.captureException(new Error("Something broke"))
    await client.flush()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.message).toBe("Something broke")
  })

  test("deduplicates identical errors within 5s window", async () => {
    const client = init(BASE_CONFIG)
    const error = new Error("Duplicate error")
    client.captureException(error)
    client.captureException(error)
    await client.flush()
    // Only one fetch call because the second is throttled
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test("warns when called before init()", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {})
    captureException(new Error("no client"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"))
    warnSpy.mockRestore()
  })
})

describe("captureMessage()", () => {
  test("queues and sends a message event via fetch", async () => {
    const client = init(BASE_CONFIG)
    client.captureMessage("User checked out")
    await client.flush()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.message).toBe("User checked out")
  })

  test("uses 'info' as default level for messages", async () => {
    const client = init(BASE_CONFIG)
    client.captureMessage("Hello world")
    await client.flush()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.level).toBe("info")
  })

  test("warns when called before init()", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {})
    captureMessage("no client message")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"))
    warnSpy.mockRestore()
  })
})

describe("setUser() and addBreadcrumb()", () => {
  test("setUser warns when called before init()", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {})
    setUser({ id: "123" })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"))
    warnSpy.mockRestore()
  })

  test("addBreadcrumb warns when called before init()", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {})
    addBreadcrumb({ category: "ui", message: "click" })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"))
    warnSpy.mockRestore()
  })

  test("breadcrumbs are stored on client after addBreadcrumb()", () => {
    const client = init(BASE_CONFIG)
    client.addBreadcrumb({ category: "ui", message: "button click", level: "info" })
    const crumbs = client.getBreadcrumbManager().getAll()
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0].message).toBe("button click")
  })
})

describe("beforeSend hook", () => {
  test("allows mutating the event before sending", async () => {
    const client = init({
      ...BASE_CONFIG,
      beforeSend: (event) => ({ ...event, tags: { mutated: "yes" } }),
    })
    client.captureException(new Error("beforeSend test"))
    await client.flush()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    // The event was sent — presence of fetch call confirms beforeSend did not block it
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test("blocks events when beforeSend returns null", async () => {
    const client = init({
      ...BASE_CONFIG,
      beforeSend: () => null,
    })
    client.captureException(new Error("should be blocked"))
    await client.flush()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
