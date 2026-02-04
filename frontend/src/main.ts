console.log('App Main Entry Point Loaded - vCheck');
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
// Force rebuild 02/03/2026 16:38:11
// Force rebuild 02/03/2026 16:45:54
