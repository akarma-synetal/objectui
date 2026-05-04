
import { Spinner, Button } from '@object-ui/components';
import { Database, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

interface LoadingScreenProps {
  /** Optional message override */
  message?: string;
  /** When set, renders an error block instead of the step list */
  error?: string | null;
  /** Optional retry callback; renders a Retry button when provided alongside `error` */
  onRetry?: () => void;
  /** When true, disables the retry button and shows a spinner */
  retrying?: boolean;
}

// Bootstrap-critical UI: must render before i18n is loaded (especially when the
// server is unreachable, which is also when i18n can't load translations).
// We deliberately do NOT use useObjectTranslation here — it suspends on first
// render and would prevent the splash from rendering at all on a server-down
// boot. Strings stay hardcoded English; localized error UX should happen
// post-bootstrap, after i18n has loaded successfully.
const STRINGS = {
  title: 'ObjectUI Console',
  initializing: 'Initializing…',
  steps: {
    connecting: 'Connecting to server',
    loadingConfig: 'Loading configuration',
    preparingWorkspace: 'Preparing workspace',
  },
  error: {
    connectionFailed: 'Cannot connect to server',
    checkServer: 'Please check your network connection or that the backend is running.',
  },
  actions: {
    retry: 'Retry',
    retrying: 'Retrying…',
  },
};

export function LoadingScreen({ message, error, onRetry, retrying }: LoadingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const loadingSteps = useMemo(() => [
    STRINGS.steps.connecting,
    STRINGS.steps.loadingConfig,
    STRINGS.steps.preparingWorkspace,
  ], []);

  useEffect(() => {
    if (message || error) return; // skip auto-progression when overridden or in error state
    const timer = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 1200);
    return () => clearInterval(timer);
  }, [message, error, loadingSteps.length]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
          <div className="relative bg-linear-to-br from-primary to-primary/80 p-4 rounded-2xl shadow-lg">
            <Database className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{STRINGS.title}</h1>
          <p className="text-sm text-muted-foreground">{STRINGS.initializing}</p>
        </div>

        {/* Error block */}
        {error ? (
          <div className="flex flex-col items-center gap-4 max-w-md w-full px-6">
            <div className="flex flex-col items-center gap-3 p-5 rounded-lg border border-destructive/30 bg-destructive/5 w-full">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold">
                  {STRINGS.error.connectionFailed}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center break-words">
                {error}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {STRINGS.error.checkServer}
              </p>
            </div>
            {onRetry && (
              <Button
                onClick={onRetry}
                disabled={retrying}
                variant="default"
                size="sm"
                className="gap-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {STRINGS.actions.retrying}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {STRINGS.actions.retry}
                  </>
                )}
              </Button>
            )}
          </div>
        ) : message ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
            <Spinner className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-64">
            {loadingSteps.map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-2.5 text-sm transition-opacity duration-300"
                style={{ opacity: index <= currentStep ? 1 : 0.3 }}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : index === currentStep ? (
                  <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className={index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
