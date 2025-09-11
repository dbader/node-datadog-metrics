/**
 * A basic test of our complete integration with Datadog. This check sends some
 * metrics, then queries to make sure they actually got ingested correctly by
 * Datadog and will show up as expected.
 */

import { main } from './integration_check_lib.mjs';

main().catch(error => {
    process.exitCode = 1;
    console.error(error);
});
