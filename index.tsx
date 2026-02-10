import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { ShopifyProvider } from './contexts/ShopifyContext';

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://e4034481b636b9233bed803e504686a8@o4509493232271360.ingest.us.sentry.io/4510860054036480",
  environment: import.meta.env.MODE,
  // Don't send PII in production
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing - lower in production to reduce costs
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  // Distributed tracing for API calls
  tracePropagationTargets: ["localhost", /^https:\/\/sloe-fit.*\.vercel\.app\/api/],
  // Session Replay
  replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  // Ignore common non-actionable errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /^Loading chunk \d+ failed/,
  ],
  beforeSend(event) {
    // Scrub sensitive data from error reports
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }
    return event;
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <ShopifyProvider>
        <App />
      </ShopifyProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
