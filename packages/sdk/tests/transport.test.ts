import { describe, test, expect, beforeEach, mock } from "bun:test"
import { sendEvent, EventQueue } from "../src/transport.ts"
import type { ErrorEvent } from "../src/types.ts"

// Minimal valid event matching the Zod schema in transport.ts
function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    fingerprint: "Error:test message:::",
    message: "test message",
    level: "error",
    timestamp: new Date().toISOString(),
    environment: "test",
    ...overrides,
  }
}

const ENDPOINT = "http://localhost:3333"
const API_KEY = "ew_test_transport_key"

describe("sendEvent()", () => {
  test("sends a POST to the correct endpoint", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    )
    globalThis.fetch = mockFetch as any

    await sendEvent(ENDPOINT, API_KEY, makeEvent())

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${ENDPOINT}/api/v1/event`)
  })

  test("includes X-API-Key header with the provided key", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    )
    globalThis.fetch = mockFetch as any

    await sendEvent(ENDPOINT, API_KEY, makeEvent())

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>)["X-API-Key"]).toBe(API_KEY)
  })

  test("uses POST method", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    )
    globalThis.fetch = mockFetch as any

    await sendEvent(ENDPOINT, API_KEY, makeEvent())

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe("POST")
  })

  test("calls onSuccess callback on 200 response", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    )
    globalThis.fetch = mockFetch as any

    const onSuccess = mock(() => {})
    await sendEvent(ENDPOINT, API_KEY, makeEvent(), { onSuccess })

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test("calls onError callback on 401 AUTH_ERROR and does not retry", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }))
    )
    globalThis.fetch = mockFetch as any

    const onError = mock((_err: any) => {})
    await sendEvent(ENDPOINT, API_KEY, makeEvent(), { onError, maxRetries: 3 })

    // 401 is not retryable — only 1 attempt
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0] as [any]
    expect(err.code).toBe("AUTH_ERROR")
  })

  test("calls onError callback on 403 INGESTION_DISABLED and does not retry", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Ingestion disabled" }), { status: 403 }))
    )
    globalThis.fetch = mockFetch as any

    const onError = mock((_err: any) => {})
    await sendEvent(ENDPOINT, API_KEY, makeEvent(), { onError, maxRetries: 3 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0] as [any]
    expect(err.code).toBe("INGESTION_DISABLED")
  })

  test("retries up to maxRetries on 500 SERVER_ERROR", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response("{}", { status: 500 }))
    )
    globalThis.fetch = mockFetch as any

    const onError = mock((_err: any) => {})
    // maxRetries=2, retryDelay=0 to avoid waiting in tests
    await sendEvent(ENDPOINT, API_KEY, makeEvent(), { onError, maxRetries: 2, retryDelay: 0 })

    // 1 initial attempt + 2 retries = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0] as [any]
    expect(err.code).toBe("SERVER_ERROR")
  })

  test("retries on network errors and calls onError after exhausting retries", async () => {
    const mockFetch = mock(() => Promise.reject(new Error("Network failure")))
    globalThis.fetch = mockFetch as any

    const onError = mock((_err: any) => {})
    await sendEvent(ENDPOINT, API_KEY, makeEvent(), { onError, maxRetries: 1, retryDelay: 0 })

    // 1 initial + 1 retry = 2 total
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0] as [any]
    expect(err.code).toBe("NETWORK_ERROR")
  })
})

describe("EventQueue", () => {
  test("calls sender immediately when queue reaches maxQueueSize", () => {
    const queue = new EventQueue(3, 60000)
    const sender = mock((_event: any) => {})

    queue.add({ id: 1 }, sender)
    queue.add({ id: 2 }, sender)
    // Third event triggers flush
    queue.add({ id: 3 }, sender)

    expect(sender).toHaveBeenCalledTimes(3)
  })

  test("flush() drains all queued events via sender", () => {
    const queue = new EventQueue(100, 60000)
    const sender = mock((_event: any) => {})

    queue.add({ id: 1 }, sender)
    queue.add({ id: 2 }, sender)
    queue.flush(sender)

    expect(sender).toHaveBeenCalledTimes(2)
  })

  test("queue is empty after flush()", () => {
    const queue = new EventQueue(100, 60000)
    const sender = mock((_event: any) => {})

    queue.add({ id: 1 }, sender)
    queue.flush(sender)

    // Flushing again should call sender 0 additional times
    const callsBefore = sender.mock.calls.length
    queue.flush(sender)
    expect(sender.mock.calls.length).toBe(callsBefore)
  })
})
