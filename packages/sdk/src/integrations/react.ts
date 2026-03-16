/**
 * React Integration for ErrorWatch SDK
 *
 * @example
 * // In your app entry point
 * import React from 'react'
 * import { init, createErrorBoundary } from '@errorwatch/sdk/react'
 *
 * const ErrorBoundary = createErrorBoundary(React)
 *
 * init({
 *   dsn: 'http://localhost:3333',
 *   apiKey: 'ew_live_...'
 * })
 *
 * function App() {
 *   return (
 *     <ErrorBoundary fallback={<ErrorPage />}>
 *       <MyApp />
 *     </ErrorBoundary>
 *   )
 * }
 */

import {
  init as coreInit,
  captureException as coreCaptureException,
  captureMessage as coreCaptureMessage,
  setUser as coreSetUser,
  addBreadcrumb as coreAddBreadcrumb,
  getReplaySessionId as coreGetReplaySessionId,
  getClient,
  close,
  flush,
} from '../index.js'

import type { SDKConfig, User, CaptureOptions, Breadcrumb } from '../types.js'

// Re-export core functions
export {
  coreInit as init,
  close,
  flush,
  getClient,
}

// Re-export types
export type {
  SDKConfig,
  User,
  CaptureOptions,
  Breadcrumb,
  BreadcrumbCategory,
  BreadcrumbLevel,
  TransportConfig,
  TransportError,
  TransportErrorCode,
  ReplayConfig,
} from '../types.js'

export { ReplayCapture, type ReplayMode, type SessionInfo } from '../replay/index.js'

/**
 * React hook for error monitoring
 *
 * @example
 * function MyComponent() {
 *   const { captureException, captureMessage } = useErrorMonitoring()
 *
 *   const handleError = () => {
 *     try {
 *       riskyOperation()
 *     } catch (e) {
 *       captureException(e)
 *     }
 *   }
 * }
 */
export function useErrorMonitoring() {
  return {
    captureException: (error: Error | unknown, options?: CaptureOptions) => {
      coreCaptureException(error, options)
    },
    captureMessage: (message: string, options?: CaptureOptions) => {
      coreCaptureMessage(message, options)
    },
    setUser: (user: User | null) => {
      coreSetUser(user)
    },
    addBreadcrumb: (breadcrumb: Omit<Breadcrumb, 'timestamp'>) => {
      coreAddBreadcrumb(breadcrumb)
    },
    getReplaySessionId: () => coreGetReplaySessionId(),
  }
}

/**
 * Get the current replay session ID
 */
export function getReplaySessionId(): string | null {
  return coreGetReplaySessionId()
}

// Types for ErrorBoundary (React-agnostic)
interface ErrorBoundaryProps {
  children: any
  fallback?: any
  onError?: (error: Error, errorInfo: any) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Create an ErrorBoundary component
 * This is framework-agnostic and works with any React-like library
 *
 * @example
 * // Using with React
 * import React from 'react'
 * const ErrorBoundary = createErrorBoundary(React)
 *
 * function App() {
 *   return (
 *     <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *       <MyApp />
 *     </ErrorBoundary>
 *   )
 * }
 */
export function createErrorBoundary(React: any) {
  return class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
      super(props)
      this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: any): void {
      // Capture the error with ErrorWatch
      coreCaptureException(error, {
        extra: {
          componentStack: errorInfo?.componentStack,
        }
      })

      // Call custom error handler if provided
      this.props.onError?.(error, errorInfo)
    }

    render() {
      if (this.state.hasError) {
        return this.props.fallback || React.createElement('div', null, 'Something went wrong')
      }
      return this.props.children
    }
  }
}

// NOTE: The pre-built `ErrorBoundary` export has been removed because it called
// `React.createElement` at module load time, which fails in SSR environments
// where React may not yet be available.
//
// Use `createErrorBoundary(React)` instead:
//
//   import React from 'react'
//   import { createErrorBoundary } from '@errorwatch/sdk/react'
//   const ErrorBoundary = createErrorBoundary(React)
