import { format } from 'prettier';
import { writeFileSync } from 'node:fs';
import { openapi } from '../src/openapi';
writeFileSync(
  'docs/openapi.json',
  await format(JSON.stringify(openapi), { parser: 'json' }),
);
