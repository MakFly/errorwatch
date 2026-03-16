import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSSE } from "@/hooks/useSSE";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  readyState = 0;
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  dispatchEvent(type: string, data: unknown) {
    const handlers = this.listeners[type] ?? [];
    const event = { data: JSON.stringify(data) } as MessageEvent;
    handlers.forEach((h) => h(event));
  }

  close() {
    this.closed = true;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// ---------------------------------------------------------------------------
// Mock toast (sonner) — useSSE calls toast.info on alert:triggered
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Wrapper helper
// ---------------------------------------------------------------------------
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useSSE", () => {
  beforeEach(() => {
    MockEventSource.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'disconnected' initially when orgId is undefined", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSSE(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe("disconnected");
    // No EventSource should have been created
    expect(MockEventSource.instances).toHaveLength(0);
  });

  test("opens an EventSource connection when orgId is provided and transitions to 'connected'", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSSE("org-123"), {
      wrapper: Wrapper,
    });

    expect(MockEventSource.instances).toHaveLength(1);

    // Simulate connection open
    act(() => {
      MockEventSource.instances[0].onopen?.();
    });

    expect(result.current).toBe("connected");
  });

  test("transitions to 'connecting' when an error event fires (auto-reconnect behavior)", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSSE("org-456"), {
      wrapper: Wrapper,
    });

    act(() => {
      MockEventSource.instances[0].onopen?.();
    });
    expect(result.current).toBe("connected");

    act(() => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(result.current).toBe("connecting");
  });

  test("closes the EventSource and returns 'disconnected' on unmount", () => {
    const { Wrapper } = makeWrapper();
    const { result, unmount } = renderHook(() => useSSE("org-789"), {
      wrapper: Wrapper,
    });

    act(() => {
      MockEventSource.instances[0].onopen?.();
    });
    expect(result.current).toBe("connected");

    unmount();

    // The cleanup function calls es.close()
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
