PROJECT: FreightWise B2B Logistics Operator (Web/PWA First)
STACK: React (TypeScript), Vite (PWA plugin), TailwindCSS, Node.js (Express), Docker.

CORE DIRECTIVES:

Architecture: This is a WebApp first, designed to work on Windows and Android browsers. It must be PWA-compliant (Service Workers, offline caching) so it can be wrapped in Capacitor later for iOS.

Security-First: Assume the DOM is hostile. Use WebAuthn for biometric signing (Windows Hello/Android Fingerprint). Do not use localStorage for sensitive tokens; use HttpOnly secure cookies or encrypted in-memory state.

Defensive Data Flow: All API calls must include explicit timeouts, exponential backoff retries, and graceful offline-fallback UI states.

Code Quality: Output highly modular, stateless functions. Strict TypeScript only. No any types.

Output Format: Do not explain basic concepts. Provide the terminal commands, file paths, and the exact code blocks.
