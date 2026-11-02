export function requestTrace(trace = []) {
  const body = trace.length
    ? trace.map((step, index) => `<div class="trace-step"><span>0${index + 1}</span><code>${step.code}</code><b>${step.label}</b></div>`).join('')
    : '<p class="trace-empty">Add a product to watch the mapping happen.</p>';
  return `<section class="trace-card" aria-label="Local request trace" aria-live="polite">
    <div class="trace-header"><span>REQUEST TRACE</span><span class="trace-status"><i></i> ${trace.length ? 'fragment fresh' : 'ready'}</span></div>
    <div class="trace-body">${body}</div>
  </section>`;
}
