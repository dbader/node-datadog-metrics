// This file is used to check the typings! It is not mean to be executed.
import { BufferedMetricsLogger } from '..';
import type { BufferedMetricsLoggerOptions } from '..';

function useLogger(logger: BufferedMetricsLogger) {
  logger.gauge('key', 0);
}

useLogger(new BufferedMetricsLogger());
