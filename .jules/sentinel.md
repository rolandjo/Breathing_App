## 2026-08-16 - DOM-Based XSS Prevention in UI Rendering
**Vulnerability:** No currently exploitable XSS path was identified. However, interpolated innerHTML in UI helpers relied on values remaining trusted and could become unsafe if future callers provide user-controlled content.
**Learning:** Constructing UI through interpolated HTML creates an unnecessary trust dependency that can be overlooked during future development.
**Prevention:** Use document.createElement, textContent, setAttribute, and append when rendering dynamic values. Assignments used only to clear content, such as innerHTML = '', are not injection risks and may remain or be replaced with replaceChildren().
