import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// Global handler: catches async errors (e.g. unhandled guard rejections) that
// would otherwise cause a silent blank screen with no Capacitor/Console output.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason);
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    // Use console.error so the error appears under the Capacitor/Console tag
    // in Android Studio logcat, making bootstrap failures visible.
    console.error('[Bootstrap] Angular module bootstrap failed:', err);
  });
