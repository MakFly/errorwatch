import { describe, test, expect, beforeEach, mock } from "bun:test"

// Mock fetch to prevent network calls
globalThis.fetch = mock(() =>
  Promise.resolve(new Response("{}", { status: 200 }))
) as any

import {
  createPlugin,
  useErrorMonitoring,
  init,
  close,
  getClient,
} from "../src/integrations/vue.ts"

beforeEach(() => {
  close()
})

describe("createPlugin()", () => {
  test("returns an object with an install method", () => {
    const plugin = createPlugin()
    expect(plugin).toBeDefined()
    expect(typeof plugin.install).toBe("function")
  })

  test("plugin.install sets app.config.errorHandler", () => {
    const plugin = createPlugin()
    const app = {
      config: { errorHandler: undefined as any, globalProperties: {} as any },
      provide: mock(() => {}),
    }
    plugin.install(app)
    expect(typeof app.config.errorHandler).toBe("function")
  })

  test("plugin.install provides the client via app.provide when SDK is initialized", () => {
    init({
      apiKey: "ew_vue_test",
      replay: { enabled: false },
      breadcrumbs: { enabled: false },
    })

    const plugin = createPlugin()
    const app = {
      config: { errorHandler: undefined as any, globalProperties: {} as any },
      provide: mock((_key: string, _value: any) => {}),
    }
    plugin.install(app)

    expect(app.provide).toHaveBeenCalledWith("errorwatch", getClient())
    expect(app.config.globalProperties.$errorwatch).toBe(getClient())
  })

  test("errorHandler calls captureException on errors", () => {
    init({
      apiKey: "ew_vue_test_2",
      replay: { enabled: false },
      breadcrumbs: { enabled: false },
    })

    const plugin = createPlugin()
    const app = {
      config: { errorHandler: undefined as any, globalProperties: {} as any },
      provide: mock(() => {}),
    }
    plugin.install(app)

    const captureExceptionSpy = mock(() => {})
    getClient()!.captureException = captureExceptionSpy

    const error = new Error("Vue render error")
    app.config.errorHandler(error, { $options: { name: "MyComponent" } }, "render")

    expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
    const [capturedError] = captureExceptionSpy.mock.calls[0] as [Error]
    expect(capturedError).toBe(error)
  })
})

describe("useErrorMonitoring() — Vue", () => {
  test("returns an object with captureException, captureMessage, setUser, addBreadcrumb, getReplaySessionId", () => {
    const monitoring = useErrorMonitoring()
    expect(typeof monitoring.captureException).toBe("function")
    expect(typeof monitoring.captureMessage).toBe("function")
    expect(typeof monitoring.setUser).toBe("function")
    expect(typeof monitoring.addBreadcrumb).toBe("function")
    expect(typeof monitoring.getReplaySessionId).toBe("function")
  })

  test("getReplaySessionId returns null when no client is initialized", () => {
    const monitoring = useErrorMonitoring()
    expect(monitoring.getReplaySessionId()).toBeNull()
  })
})
