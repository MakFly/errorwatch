import { createApp } from "vue";
import { init } from "@errorwatch/sdk";
import { createPlugin } from "@errorwatch/sdk/vue";
import App from "./App.vue";

// Initialize ErrorWatch
init({
  dsn: import.meta.env.VITE_ERRORWATCH_DSN || "http://localhost:3333",
  apiKey: import.meta.env.VITE_ERRORWATCH_API_KEY || "ew_test_xxx",
  debug: true,
});

const app = createApp(App);
app.use(createPlugin());
app.mount("#app");
