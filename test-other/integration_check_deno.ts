/**
 * Live integration test entrypoint for Deno. This is essentially the same as
 * `integration_check.mjs` but is TypeScript for usage in Deno.
 */

import { main } from './integration_check_lib.mjs';

main({ tagSuffix: 'deno' }).catch(error => {
    process.exitCode = 1;
    console.error(error);
});
