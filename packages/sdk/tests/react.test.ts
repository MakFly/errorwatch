import { describe, test, expect, beforeEach, mock } from "bun:test"

// Mock fetch to prevent network calls
globalThis.fetch = mock(() =>
  Promise.resolve(new Response("{}", { status: 200 }))
) as any

import {
  createErrorBoundary,
  useErrorMonitoring,
  init,
  close,
  getClient,
} from "../src/integrations/react.ts"

beforeEach(() => {
  close()
})

describe("createErrorBoundary()", () => {
  test("returns a class constructor (not null or undefined)", () => {
    // Minimal React-like mock: only Component base class is needed
    const MockReact = {
      Component: class Component {
        constructor(public props: any) {}
      },
      createElement: mock(() => null),
    }

    const ErrorBoundary = createErrorBoundary(MockReact)
    expect(ErrorBoundary).toBeDefined()
    expect(typeof ErrorBoundary).toBe("function")
  })

  test("the returned class has a componentDidCatch method", () => {
    const MockReact = {
      Component: class Component {
        constructor(public props: any) {}
      },
      createElement: mock(() => null),
    }

    const ErrorBoundary = createErrorBoundary(MockReact)
    expect(typeof ErrorBoundary.prototype.componentDidCatch).toBe("function")
  })

  test("the returned class has a static getDerivedStateFromError method", () => {
    const MockReact = {
      Component: class Component {
        constructor(public props: any) {}
      },
      createElement: mock(() => null),
    }

    const ErrorBoundary = createErrorBoundary(MockReact)
    expect(typeof (ErrorBoundary as any).getDerivedStateFromError).toBe("function")
  })

  test("getDerivedStateFromError returns hasError: true with the error", () => {
    const MockReact = {
      Component: class Component {
        constructor(public props: any) {}
      },
      createElement: mock(() => null),
    }

    const ErrorBoundary = createErrorBoundary(MockReact)
    const error = new Error("render crash")
    const state = (ErrorBoundary as any).getDerivedStateFromError(error)
    expect(state.hasError).toBe(true)
    expect(state.error).toBe(error)
  })

  test("componentDidCatch calls captureException on the global client", () => {
    const MockReact = {
      Component: class Component {
        constructor(public props: any) {}
        state: any = {}
        setState = mock((_s: any) => {})
      },
      createElement: mock(() => null),
    }

    // Init SDK so captureException has a client
    init({
      apiKey: "ew_react_test",
      replay: { enabled: false },
      breadcrumbs: { enabled: false },
    })

    const ErrorBoundary = createErrorBoundary(MockReact)
    const instance = new ErrorBoundary({ children: null }) as any
    const captureExceptionSpy = mock(() => {})
    const client = getClient()!
    client.captureException = captureExceptionSpy

    const error = new Error("component crash")
    instance.componentDidCatch(error, { componentStack: "\n  at MyComp" })

    expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
    const [capturedError] = captureExceptionSpy.mock.calls[0] as [Error]
    expect(capturedError).toBe(error)
  })
})

describe("useErrorMonitoring() — React", () => {
  test("returns an object with captureException, captureMessage, setUser, addBreadcrumb, getReplaySessionId", () => {
    const monitoring = useErrorMonitoring()
    expect(typeof monitoring.captureException).toBe("function")
    expect(typeof monitoring.captureMessage).toBe("function")
    expect(typeof monitoring.setUser).toBe("function")
    expect(typeof monitoring.addBreadcrumb).toBe("function")
    expect(typeof monitoring.getReplaySessionId).toBe("function")
  })

  test("getReplaySessionId returns null when no replay is active", () => {
    const monitoring = useErrorMonitoring()
    expect(monitoring.getReplaySessionId()).toBeNull()
  })
})
