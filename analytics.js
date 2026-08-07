// Vercel Web Analytics initialization
// Import and inject analytics tracking
import { inject } from '/core/lib/vercel-analytics.mjs';

inject({
  mode: 'auto',
  debug: false
});
