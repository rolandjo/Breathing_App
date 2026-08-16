## 2024-05-24 - DOM-Based XSS Prevention in UI Rendering
**Vulnerability:** Use of `innerHTML` in `script.js` UI rendering functions (like `iconButton` and `renderRetentionCard`) could lead to Cross-Site Scripting (XSS) if user input (like exercise names or custom labels) is accidentally passed into these strings in the future.
**Learning:** Even if current inputs are hardcoded or sanitized, using `innerHTML` to construct UI elements with variables is a brittle pattern. A future refactor or feature addition could easily introduce user input here.
**Prevention:** Replace all `innerHTML` assignments with safe DOM manipulation methods (`document.createElement`, `textContent`, `setAttribute`, etc.). This provides a robust defense-in-depth against XSS.
