import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
type Metric = { name: string; value: number; at: number };
const samples: Metric[] = [];
/** Local bounded diagnostics: no user identifiers, URLs, tokens or remote telemetry. */
export function recordMetric(name: string, value: number) {
  if (!Number.isFinite(value)) return;
  samples.push({ name, value, at: performance.now() });
  if (samples.length > 100) samples.shift();
}
export function startPerformanceMetrics() {
  Object.defineProperty(window, '__SHARKSET_PERFORMANCE__', { configurable: true, value: {
    read: () => samples.map(sample => ({ ...sample })),
  } });
  const report = (metric: { name: string; value: number }) => recordMetric(metric.name, metric.value);
  onCLS(report, { reportAllChanges: true });
  onLCP(report, { reportAllChanges: true });
  onINP(report, { reportAllChanges: true });
  onFCP(report); onTTFB(report);
}
