/**
 * SDK Instructions for each supported platform
 * Used to generate setup guides after project creation
 */

export const PLATFORMS = {
  symfony: {
    name: "Symfony",
    icon: "symfony",
    category: "php",
    package: "makfly/error-monitoring-bundle",
    installCommand: "composer require makfly/error-monitoring-bundle",
    configSnippet: (apiKey: string, endpoint: string) => `# config/packages/error_monitoring.yaml
error_monitoring:
  enabled: true
  endpoint: '${endpoint}'
  api_key: '${apiKey}'
  replay:
    enabled: true
    sample_rate: 1.0`,
  },
  laravel: {
    name: "Laravel",
    icon: "laravel",
    category: "php",
    package: "errorwatch/sdk-laravel",
    installCommand: "composer require errorwatch/sdk-laravel",
    configSnippet: (apiKey: string, endpoint: string) => `# .env
ERRORWATCH_ENABLED=true
ERRORWATCH_ENDPOINT=${endpoint}
ERRORWATCH_API_KEY=${apiKey}`,
  },
  react: {
    name: "React",
    icon: "react",
    category: "frontend",
    package: "@error-monitoring/sdk-react",
    installCommand: "npm install @error-monitoring/sdk-react",
    configSnippet: (apiKey: string, endpoint: string) => `// src/main.tsx
import { ErrorMonitoringProvider } from '@error-monitoring/sdk-react';

createRoot(document.getElementById('root')!).render(
  <ErrorMonitoringProvider
    apiKey="${apiKey}"
    endpoint="${endpoint}"
    environment={import.meta.env.MODE}
  >
    <App />
  </ErrorMonitoringProvider>
);`,
  },
  vuejs: {
    name: "Vue.js",
    icon: "vue",
    category: "frontend",
    package: "@error-monitoring/sdk-vue",
    installCommand: "npm install @error-monitoring/sdk-vue",
    configSnippet: (apiKey: string, endpoint: string) => `// main.ts
import { createApp } from 'vue';
import { createErrorMonitoring } from '@error-monitoring/sdk-vue';

const app = createApp(App);

app.use(createErrorMonitoring({
  apiKey: '${apiKey}',
  endpoint: '${endpoint}',
  environment: import.meta.env.MODE,
}));

app.mount('#app');`,
  },
  nextjs: {
    name: "Next.js",
    icon: "nextjs",
    category: "fullstack",
    package: "@error-monitoring/sdk-nextjs",
    installCommand: "npm install @error-monitoring/sdk-nextjs",
    configSnippet: (apiKey: string, endpoint: string) => `// next.config.js
const { withErrorMonitoring } = require('@error-monitoring/sdk-nextjs');

module.exports = withErrorMonitoring({
  apiKey: '${apiKey}',
  endpoint: '${endpoint}',
})({
  // your next config
});`,
  },
  nuxtjs: {
    name: "Nuxt.js",
    icon: "nuxt",
    category: "fullstack",
    package: "@error-monitoring/sdk-nuxt",
    installCommand: "npm install @error-monitoring/sdk-nuxt",
    configSnippet: (apiKey: string, endpoint: string) => `// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@error-monitoring/sdk-nuxt'],
  errorMonitoring: {
    apiKey: '${apiKey}',
    endpoint: '${endpoint}',
  },
});`,
  },
  nodejs: {
    name: "Node.js",
    icon: "nodejs",
    category: "backend",
    package: "@error-monitoring/sdk-core",
    installCommand: "npm install @error-monitoring/sdk-core",
    configSnippet: (apiKey: string, endpoint: string) => `// app.ts
import { init, captureException } from '@error-monitoring/sdk-core';

init({
  apiKey: '${apiKey}',
  endpoint: '${endpoint}',
  environment: process.env.NODE_ENV,
});

// Capture errors
try {
  // your code
} catch (error) {
  captureException(error);
}`,
  },
  hono: {
    name: "Hono.js",
    icon: "hono",
    category: "backend",
    package: "@error-monitoring/sdk-hono",
    installCommand: "npm install @error-monitoring/sdk-hono",
    configSnippet: (apiKey: string, endpoint: string) => `// src/index.ts
import { Hono } from 'hono';
import { errorMonitoring } from '@error-monitoring/sdk-hono';

const app = new Hono();

app.use('*', errorMonitoring({
  apiKey: '${apiKey}',
  endpoint: '${endpoint}',
}));

export default app;`,
  },
  fastify: {
    name: "Fastify",
    icon: "fastify",
    category: "backend",
    package: "@error-monitoring/sdk-fastify",
    installCommand: "npm install @error-monitoring/sdk-fastify",
    configSnippet: (apiKey: string, endpoint: string) => `// app.ts
import Fastify from 'fastify';
import errorMonitoring from '@error-monitoring/sdk-fastify';

const fastify = Fastify();

fastify.register(errorMonitoring, {
  apiKey: '${apiKey}',
  endpoint: '${endpoint}',
});

fastify.listen({ port: 3000 });`,
  },
} as const;

export type Platform = keyof typeof PLATFORMS;

export const PLATFORM_LIST = Object.entries(PLATFORMS).map(([id, config]) => ({
  id: id as Platform,
  name: config.name,
  icon: config.icon,
  category: config.category,
}));

export function isValidPlatform(platform: string): platform is Platform {
  return platform in PLATFORMS;
}

export function getSdkInstructions(platform: Platform, apiKey: string, endpoint: string = "https://api.errorwatch.io") {
  const config = PLATFORMS[platform];
  return {
    platform,
    name: config.name,
    icon: config.icon,
    category: config.category,
    package: config.package,
    installCommand: config.installCommand,
    configSnippet: config.configSnippet(apiKey, endpoint),
  };
}
