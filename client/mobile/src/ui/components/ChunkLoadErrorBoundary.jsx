import React from "react";

// Detects the "failed to load a dynamically imported chunk" class of errors that
// React.lazy()/import() throw when a build-chunk is missing or its content hash
// no longer matches (e.g. right after a Meteor hot code push swaps the bundle).
const isChunkLoadError = (error) => {
  if (!error) {
    return false;
  }

  const name = error.name || "";
  const message = error.message || "";

  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk [\w-]+ failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message)
  );
};

const RELOAD_FLAG = "chunkReloadAttempted";

export class ChunkLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error) {
    // A chunk failed to load — almost always because a hot code push swapped the
    // bundle out from under us and the old chunk URLs no longer resolve. Reload
    // once to pull the now-current bundle. A sessionStorage flag prevents an
    // infinite reload loop if the chunk is genuinely unavailable.
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      let alreadyTried = false;
      try {
        alreadyTried = window.sessionStorage.getItem(RELOAD_FLAG) === "1";
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        // sessionStorage unavailable — fall through to the manual fallback UI.
      }

      if (!alreadyTried) {
        window.location.reload();
      }
    }
  }

  handleManualReload = () => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // ignore
      }
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // While the automatic reload is in flight, render the fallback so the user
      // never sees a black screen. If the reload already happened once and we are
      // still here, show a manual retry instead of looping forever.
      return this.props.fallback({
        isChunkError: this.state.isChunkError,
        onRetry: this.handleManualReload,
      });
    }

    return this.props.children;
  }
}
