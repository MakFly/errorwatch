# Research: Refonte ErrorWatch v2 — Alignement Sentry

## Summary

ErrorWatch a accumulé une complexité UI/fonctionnelle disproportionnée par rapport à la maturité du backend (features squelettiques : replays, performance, crons, infrastructure — routes présentes mais non finalisées). Le modèle de données events est trop pauvre (pas de tags, contexts, request, user enrichi) tandis que l'UI essaie d'afficher des données qui n'existent pas (ContextCards browser/os vides). **La refonte doit partir du modèle de données, simplifier l'UI autour des features réellement fonctionnelles, et restructurer les SDKs PHP en 3 packages (core + laravel + symfony).**

**Confiance: 90%** — Clear recommendation. Les patterns sont prouvés (Sentry, Bugsnag, Flare utilisent tous la même architecture).

---

## Findings

### Finding 1: Le modèle de données events est le problème racine

- **Evidence**: strong
- **Layer**: 1 (tried-and-true — comparaison directe avec Sentry)
- **Source**: `apps/api/src/db/schema.ts`, Sentry event protocol docs
- **Recency**: Avril 2026

**ErrorWatch `error_events` actuel** : `id, fingerprint, projectId, stack, url, env, statusCode, level, breadcrumbs, sessionId, userId, release, createdAt`

**Ce qui manque vs Sentry (essentiel pour un monitoring utile)** :
| Champ | Pourquoi c'est essentiel |
|-------|-------------------------|
| `exception` (type + value séparés) | Permet grouping par type d'exception |
| `tags` (jsonb) | Filtrage custom (version, feature flag, etc.) |
| `user` (id + email + ip) | Comptage users affectés, contexte utilisateur |
| `request` (url + method + headers) | Debug contexte HTTP |
| `contexts` (os, browser, runtime) | Les ContextCards actuelles sont vides faute de données |
| `platform` | Multi-SDK support |
| `server_name` | Identifier le serveur source |
| `extra` (jsonb) | Données custom du développeur |
| `in_app` flag sur les frames | Filtrer vendor vs app dans la stack trace |

### Finding 2: L'UI affiche des pages sans backend fonctionnel

- **Evidence**: strong
- **Layer**: 1 (observation directe du code)
- **Source**: `apps/web/src/app/[locale]/dashboard/`

**Pages qui existent dans le router mais sont squelettiques ou non fonctionnelles** :
- `performance/` — web-vitals, transactions, queries (backend `performanceMetrics` table existe mais ingestion minimale)
- `replays/` — UI de lecture de replay (backend `replaySessions` existe mais pas de SDK d'enregistrement)
- `crons/` — Monitoring de cron jobs
- `infrastructure/` — Monitoring infrastructure
- `logs/` — Logs applicatifs

**Le coeur qui fonctionne** : issues, stats, settings, onboarding.

### Finding 3: Pagination client-side = bombe à retardement

- **Evidence**: strong
- **Layer**: 1
- **Source**: `apps/web/src/app/[locale]/dashboard/.../issues/page.tsx`

La DataTable charge TOUS les events côté client et pagine avec TanStack Table `getPaginationRowModel`. L'API supporte `page/limit` mais ils ne sont pas utilisés depuis le frontend issues. La timeline charge jusqu'à 10000 events en mémoire.

### Finding 4: Le fingerprinting actuel est fragile

- **Evidence**: strong
- **Layer**: 1 + 2
- **Source**: `apps/api/src/queue/workers/event.worker.ts`, Sentry grouping docs

**Actuel** : `SHA1(projectId|errorType|normalizedFile|line|column|stackDepth|top3frames)`

**Problème** : Dépend de `line` et `column` — un simple reformatage de code ou une minification change le grouping. Sentry utilise `exception_type + cleaned_message + top_in_app_function + filename` (pas de numéro de ligne).

### Finding 5: Architecture SDKs PHP — 3 packages est le standard prouvé

- **Evidence**: strong
- **Layer**: 1 (tried-and-true)
- **Source**: sentry-php, bugsnag-php, spatie/ignition

**Tous les acteurs majeurs** utilisent le pattern 3 packages :
| Vendor | Core | Laravel | Symfony |
|--------|------|---------|---------|
| Sentry | `sentry/sentry` | `sentry/sentry-laravel` | `sentry/sentry-symfony` |
| Bugsnag | `bugsnag/bugsnag` | `bugsnag/bugsnag-laravel` | `bugsnag/bugsnag-symfony` |
| Flare | `spatie/ignition` | `spatie/laravel-ignition` | Bundle séparé |

**Raison technique** : `composer.json` `type` ne peut avoir qu'UNE valeur. Un package ne peut pas être `"library"` (Laravel) ET `"symfony-bundle"` (Flex auto-register) en même temps. C'est un **deal-breaker** pour le package unique.

**ErrorWatch a déjà 2 repos** (`sdk-laravel`, `sdk-symfony`) avec 102+ tests. Il faut :
1. Extraire le core commun dans `errorwatch/sdk-php`
2. Refactorer les 2 SDKs existants pour dépendre du core

### Finding 6: Sentry Issues UI — les patterns essentiels

- **Evidence**: strong
- **Layer**: 1
- **Source**: Sentry docs + GitHub UI analysis

**Issues List** (ce qu'il faut garder) :
- Colonnes : level badge, exception type + message, count, users affected, first/last seen
- Tabs : Unresolved, Resolved, Archived (3 suffisent vs 5+ chez Sentry)
- Tri : Last Seen, Events count, Users count
- Filtres : environment, level, search texte
- Bulk actions : resolve, archive, assign

**Issue Detail** (essentiel) :
- Header : message, count, users, status actions
- Stack trace avec `in_app` filtering (vendor toggle)
- Breadcrumbs timeline
- Tags avec valeurs filtrables
- Request context (URL, method, headers)
- OS/Browser/Runtime context
- Event navigator (prev/next dans l'issue)

**Ce qu'on skip** : saved searches, escalation forecasting, AI similarity, merge/unmerge, session replay intégré.

---

## Comparison: Approches SDK

| Critère | 1 Package unique | 3 Packages (core+framework) | Monorepo + split |
|---------|-----------------|----------------------------|-----------------|
| Evidence level | weak | strong | strong |
| Faisabilité technique | Bloqué (`type` composer) | Prouvé par Sentry/Bugsnag/Flare | Prouvé par Symfony |
| DX installation | `composer require errorwatch/sdk-php` | `composer require errorwatch/sdk-laravel` | Idem 3 packages |
| Auto-discovery | Impossible (conflit type) | Natif (Laravel + Flex) | Natif |
| CI/Testing | Matrices impossibles | Indépendant par framework | Unifié |
| Migration depuis existant | Refonte totale | Extraction core + refactor | + setup split CI |
| Maintenance | 1 repo | 3 repos | 1 repo → 3 packages |
| **Completeness** | 3/10 | **9/10** | 8/10 |

---

## Recommendation

### Architecture cible

```
errorwatch/sdk-php           # Core : Client, Transport, ExceptionHandler, Breadcrumbs, Scope
errorwatch/sdk-laravel       # ServiceProvider, Facade, Middleware, Queue/Log listeners
errorwatch/sdk-symfony        # Bundle, DI Extension, EventSubscriber, Monolog handler, Messenger
```

### Event Schema cible (v2)

```typescript
interface ErrorWatchEvent {
  // Identity
  event_id: string;           // UUID
  timestamp: string;          // ISO 8601
  platform: string;           // "php", "javascript", etc.
  
  // Error
  level: "fatal" | "error" | "warning" | "info" | "debug";
  message?: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: {
      frames: Array<{
        filename: string;
        function?: string;
        lineno?: number;
        colno?: number;
        context_line?: string;
        pre_context?: string[];
        post_context?: string[];
        in_app?: boolean;
      }>;
    };
  };
  
  // Context
  environment?: string;
  release?: string;
  server_name?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id?: string; email?: string; ip_address?: string; username?: string; };
  request?: { url?: string; method?: string; headers?: Record<string, string>; query_string?: string; data?: any; };
  breadcrumbs?: Array<{
    timestamp?: string;
    type?: string;
    category?: string;
    message?: string;
    level?: string;
    data?: Record<string, any>;
  }>;
  contexts?: {
    os?: { name?: string; version?: string; };
    browser?: { name?: string; version?: string; };
    runtime?: { name?: string; version?: string; };
    device?: { model?: string; family?: string; };
  };
  
  // SDK metadata
  sdk?: { name: string; version: string; };
}
```

### Fingerprinting cible (v2)

```
SHA256(exception.type + cleanMessage(exception.value) + topInAppFrame.filename + topInAppFrame.function)
```

Avec `cleanMessage` qui remplace nombres, UUIDs, timestamps par des placeholders.

### Pages dashboard cible (v2 — supprimer le reste)

| Page | Status |
|------|--------|
| `/issues` | **KEEP** — refonte UI + pagination serveur |
| `/issues/[fingerprint]` | **KEEP** — refonte avec nouveau schema |
| `/stats` | **KEEP** — déjà fonctionnel |
| `/settings` | **KEEP** — déjà fonctionnel |
| `/performance/*` | **REMOVE** — pas de backend réel |
| `/replays/*` | **REMOVE** — pas de SDK capture |
| `/crons/*` | **REMOVE** — squelettique |
| `/infrastructure/*` | **REMOVE** — squelettique |
| `/logs/*` | **REMOVE** — squelettique |

---

## Unknowns

1. **État exact des SDKs existants** — Les repos `sdk-laravel` et `sdk-symfony` ne sont pas dans ce monorepo. Il faudra les auditer pour identifier le code commun à extraire.
2. **Migration des données existantes** — Les events existants en DB n'ont pas le nouveau schema. Migration ou reset ?
3. **JavaScript SDK** — Pas évoqué mais nécessaire pour les exemples React/Vue. Priorité ?
4. **Sourcemaps** — Le service existe côté API mais n'est pas branché. Priorité v2 ou v3 ?

## Bias Check

- **Sur-simplification** : En supprimant performance/replays/crons, on perd la promesse "Sentry alternative complète". Mais ces features sont non fonctionnelles aujourd'hui — les garder en facade est pire.
- **Biais Sentry** : On copie les patterns Sentry, mais ErrorWatch est self-hosted et petit scale. Certains choix Sentry (ClickHouse, Kafka) sont du over-engineering pour nous. PostgreSQL + Redis reste le bon choix.
- **3 packages PHP** : Plus de maintenance que 1 package, mais c'est le standard prouvé et la contrainte `type` composer rend le package unique techniquement impossible.

---

## Sources

### Layer 1 (Tried-and-True)
- [Sentry Event Payloads](https://develop.sentry.dev/sdk/data-model/event-payloads/) — schema complet
- [Sentry Grouping](https://develop.sentry.dev/backend/application-domains/grouping/) — algorithme fingerprinting
- [Sentry Issues UI](https://docs.sentry.io/product/issues/) — patterns UI
- [sentry-php](https://github.com/getsentry/sentry-php) — architecture SDK core
- [sentry-laravel](https://github.com/getsentry/sentry-laravel) — integration Laravel
- [sentry-symfony](https://github.com/getsentry/sentry-symfony) — integration Symfony
- [bugsnag-php](https://github.com/bugsnag/bugsnag-php) — architecture alternative
- [spatie/ignition](https://packagist.org/packages/spatie/ignition) — pattern Flare

### Layer 2 (New-and-Popular)
- [Laravel Auto-Discovery](https://laravel.com/docs/13.x/packages) — auto-register packages
- [Symfony Flex Recipes](https://symfony.com/doc/current/quick_tour/flex_recipes.html) — auto-configure bundles

### Layer 1 (Codebase)
- `apps/api/src/db/schema.ts` — schema DB actuel
- `apps/api/src/controllers/v1/EventController.ts` — ingestion endpoint
- `apps/api/src/queue/workers/event.worker.ts` — fingerprinting actuel
- `apps/web/src/app/[locale]/dashboard/.../issues/page.tsx` — UI issues actuelle
- `apps/web/src/components/issue-detail/ContextCards.tsx` — cards vides (pas de données)
