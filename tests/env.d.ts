import type { Bindings } from '../src/lib/types';
import type { D1Migration } from 'cloudflare:test';
declare global {
  namespace Cloudflare {
    interface Env extends Bindings {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
