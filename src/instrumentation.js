// OpenTelemetry tracing, di-load via `node --require ./src/instrumentation.js`
// Hanya aktif jika OTEL_EXPORTER_OTLP_ENDPOINT di-set. Gagal init tidak menghentikan aplikasi.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

if (endpoint) {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')

    const sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME || process.env.APP_NAME || 'api-assessment',
      traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }),
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      })],
    })

    sdk.start()

    process.on('SIGTERM', () => {
      sdk.shutdown().finally(() => process.exit(0))
    })
  } catch (err) {
    console.warn(`OpenTelemetry disabled: ${err.message}`)
  }
}
