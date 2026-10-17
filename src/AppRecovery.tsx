import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isModuleLoadError, reloadAfterModuleFailure } from './module-recovery';

/** Keep an actionable screen when a render or deferred module fails. */
export default class AppRecovery extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Journas could not display this screen', error, info.componentStack);
    reloadAfterModuleFailure(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const moduleFailure = isModuleLoadError(this.state.error);
    return <main className="app-recovery" role="alert">
      <div className="app-recovery-card">
        <img src="/favicon.svg" width="64" height="64" alt="Journas" />
        <h1>{moduleFailure ? 'Unable to load this screen' : 'Something went wrong'}</h1>
        <p>{moduleFailure ? 'Check your connection and try again. Your account remains signed in.' : 'Please try loading Journas again.'}</p>
        <button type="button" className="button primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </main>;
  }
}
