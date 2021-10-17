const promisfy = require('util').promisify
const metrics = require('../index')

metrics.init({
  apiKey: '<!-- datadog api key -->',
  flushIntervalSeconds: 0,
})

metrics.flush = promisfy(metrics.flush)

;(async () => {
  metrics.increment('node-datadog-metrics.test')

  await metrics.flush()
})()

