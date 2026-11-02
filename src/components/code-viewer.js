import { sourceFiles } from '../data/products.js';

export function codeViewer(activeFile = 'surface') {
  const file = sourceFiles[activeFile];
  return `<section class="code-viewer" aria-label="Inspectable source code">
    <div class="code-tabs" role="tablist">${Object.entries(sourceFiles).map(([key]) => `<button class="code-tab ${key === activeFile ? 'active' : ''}" role="tab" aria-selected="${key === activeFile}" data-source="${key}">${key}</button>`).join('')}</div>
    <div class="code-heading"><span>${file.label}</span><button class="copy-button" data-copy>Copy</button></div>
    <div class="code-title">${file.title}</div>
    <p class="code-explanation">${file.explanation}</p>
    <pre data-code>${file.code}</pre>
    <div class="code-foot"><span>source / inspectable</span><span><i></i> live mapping</span></div>
  </section>`;
}
