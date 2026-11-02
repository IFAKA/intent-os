import { eyebrow } from './atoms.js';
import { productGrid } from './product-card.js';
import { requestTrace } from './request-trace.js';
import { codeViewer } from './code-viewer.js';

export function playground({ products, variant, trace, source, cartIds }) {
  return `<main class="lab-shell" id="top">
    <header class="site-header"><a class="brand" href="#top"><span class="brand-mark">i</span><span>intent os</span></a><nav><a href="#lab">Playground</a><a href="#parts">Parts</a><a href="#source">Source</a></nav><span class="header-status"><i></i> local runtime</span></header>
    <section class="lab-hero"><div>${eyebrow('Runtime laboratory / v0.2')}<h1>Build the surface.<br /><em>Inspect the system.</em></h1><p>Every part is small enough to understand, every behavior is close enough to test. Change the variant, trigger the intent, then read the code that made it happen.</p></div><div class="hero-stamp"><span>01—04</span><strong>atomic<br />commerce</strong><small>browser-native / server-shaped</small></div></section>
    <section class="lab-grid" id="lab">
      <aside class="control-panel" id="parts"><div class="panel-kicker">PLAYGROUND / 01</div><h2>Change the rules.</h2><p class="panel-copy">Use the same intent surface with different visual and runtime conditions.</p>
        <fieldset><legend>Grid layout</legend><label><input type="radio" name="layout" value="cards" ${variant.layout === 'cards' ? 'checked' : ''} /> Cards <span>three-up</span></label><label><input type="radio" name="layout" value="list" ${variant.layout === 'list' ? 'checked' : ''} /> List <span>one-up</span></label></fieldset>
        <fieldset><legend>Density</legend><label><input type="radio" name="density" value="roomy" ${variant.density === 'roomy' ? 'checked' : ''} /> Roomy <span>more air</span></label><label><input type="radio" name="density" value="tight" ${variant.density === 'tight' ? 'checked' : ''} /> Tight <span>more signal</span></label></fieldset>
        <fieldset><legend>Surface theme</legend><label><input type="radio" name="theme" value="paper" ${variant.theme === 'paper' ? 'checked' : ''} /> Paper <span>default</span></label><label><input type="radio" name="theme" value="ink" ${variant.theme === 'ink' ? 'checked' : ''} /> Ink <span>dark mode</span></label></fieldset>
        <button class="reset-button" data-reset>Reset playground <span>↺</span></button>
      </aside>
      <div class="demo-column"><div class="demo-label"><span>LIVE CANVAS</span><span data-variant-label>${variant.layout} / ${variant.density} / ${variant.theme}</span></div><div class="shop-surface theme-${variant.theme}"><div class="shop-toolbar"><span class="route">pages/products/index.html</span><span class="cart-pill">Cart <strong data-fragment="cart-count" aria-label="Cart item count">0</strong></span></div><div class="shop-intro">${eyebrow('Resource / Product')}<h2>Objects with intent.</h2><p>Try the action. The trace and fragment are updated together.</p></div>${productGrid(products, variant, cartIds)}<div class="cart-fragment" aria-live="polite"><span>LOCAL CART SIMULATION</span><strong>€<span data-fragment="cart-total">0.00</span></strong><p data-fragment="cart-summary">Empty · waiting for cart.add</p></div></div>${requestTrace(trace)}</div>
      <div class="source-column" id="source"><div class="demo-label"><span>IMPLEMENTATION</span><span>click a file to inspect</span></div>${codeViewer(source)}</div>
    </section>
    <section class="parts-strip"><div>${eyebrow('The atomic surface')}</div><div class="part-list"><button type="button" data-source="surface"><b>01</b> Resource</button><button type="button" data-source="runtime"><b>02</b> Action</button><button type="button" data-source="fragment"><b>03</b> Fragment</button><button type="button" data-source="variant"><b>04</b> Form</button><button type="button" data-source="variant"><b>05</b> Layout hint</button></div></section>
    <footer class="site-footer"><a class="brand" href="#top"><span class="brand-mark">i</span><span>intent os</span></a><span>Constrained by design. Built for the work.</span><span class="footer-code">runtime lab / v0.2</span></footer>
  </main>`;
}
