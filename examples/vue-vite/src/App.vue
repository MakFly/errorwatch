<script setup lang="ts">
import { ref } from "vue";
import { captureException, captureMessage, addBreadcrumb } from "@errorwatch/sdk";
import { useErrorMonitoring } from "@errorwatch/sdk/vue";

const { captureException: monitoringCaptureException } = useErrorMonitoring();

const lastAction = ref<string>("");
const errorCount = ref<number>(0);

function throwVueError(): void {
  lastAction.value = "Throwing Vue component error...";
  // This error will be caught by the Vue error handler set up in createPlugin()
  throw new Error("Test Vue component error — caught by ErrorWatch plugin");
}

function captureManualException(): void {
  try {
    throw new Error("Manual exception captured via useErrorMonitoring()");
  } catch (e) {
    monitoringCaptureException(e, {
      extra: { source: "manual-button", timestamp: Date.now() },
    });
    errorCount.value++;
    lastAction.value = `captureException() called (total: ${errorCount.value})`;
  }
}

function captureTestMessage(): void {
  captureMessage("User triggered a test message from Vue example", {
    level: "info",
    extra: { component: "App.vue", action: "captureMessage-button" },
  });
  lastAction.value = 'captureMessage() — "User triggered a test message"';
}

function addTestBreadcrumb(): void {
  addBreadcrumb({
    category: "user",
    message: "User clicked the add-breadcrumb button",
    level: "info",
    data: { component: "App.vue" },
  });
  lastAction.value = 'addBreadcrumb() — category: "user"';
}

function captureSdkException(): void {
  try {
    const obj = null as unknown as { value: string };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = obj.value; // Will throw TypeError
  } catch (e) {
    captureException(e, {
      extra: { source: "sdk-direct", note: "Direct import from @errorwatch/sdk" },
    });
    errorCount.value++;
    lastAction.value = `captureException() via @errorwatch/sdk (total: ${errorCount.value})`;
  }
}
</script>

<template>
  <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 24px;">
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0 0 8px;">
        ErrorWatch — Vue + Vite Example
      </h1>
      <p style="color: #666; margin: 0;">
        Demonstrates the ErrorWatch SDK integration with Vue 3.
        Open your browser console and the ErrorWatch dashboard to see events.
      </p>
    </header>

    <section style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
      <button
        style="padding: 10px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; text-align: left;"
        @click="throwVueError"
      >
        Throw Vue error
        <span style="display: block; font-size: 0.75rem; opacity: 0.85;">
          Caught by Vue errorHandler (createPlugin)
        </span>
      </button>

      <button
        style="padding: 10px 16px; background: #ea580c; color: white; border: none; border-radius: 6px; cursor: pointer; text-align: left;"
        @click="captureManualException"
      >
        captureException() via useErrorMonitoring()
        <span style="display: block; font-size: 0.75rem; opacity: 0.85;">
          Uses the composable from @errorwatch/sdk/vue
        </span>
      </button>

      <button
        style="padding: 10px 16px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; text-align: left;"
        @click="captureSdkException"
      >
        captureException() via @errorwatch/sdk
        <span style="display: block; font-size: 0.75rem; opacity: 0.85;">
          Direct import — triggers a TypeError internally
        </span>
      </button>

      <button
        style="padding: 10px 16px; background: #0891b2; color: white; border: none; border-radius: 6px; cursor: pointer; text-align: left;"
        @click="captureTestMessage"
      >
        captureMessage()
        <span style="display: block; font-size: 0.75rem; opacity: 0.85;">
          Sends an info-level message event
        </span>
      </button>

      <button
        style="padding: 10px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; text-align: left;"
        @click="addTestBreadcrumb"
      >
        addBreadcrumb()
        <span style="display: block; font-size: 0.75rem; opacity: 0.85;">
          Adds a breadcrumb attached to the next event
        </span>
      </button>
    </section>

    <section
      v-if="lastAction"
      style="padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;"
    >
      <p style="margin: 0; font-size: 0.875rem; color: #166534;">
        <strong>Last action:</strong> {{ lastAction }}
      </p>
    </section>

    <footer style="margin-top: 40px; font-size: 0.75rem; color: #999;">
      SDK initialized with
      <code>debug: true</code> — check the browser console for SDK logs.
    </footer>
  </div>
</template>
