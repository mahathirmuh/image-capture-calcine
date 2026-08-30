# Mobile Product Principles

## 1. Operator First

The mobile app exists to help operators finish routine capture work quickly and correctly. UI and flows should optimize for clarity, speed, and low cognitive load.

## 2. English UI, Practical Tone

All mobile UI text must stay in English. Wording should be operational, short, and unambiguous.

## 3. One Job Per Screen

Each screen should support a clear operator task:
- log in
- inspect today sessions
- capture
- verify recent output
- inspect assigned device
- manage lightweight personal settings

## 4. Long-Lived Sessions

The app should avoid unnecessary logout/login churn. Token refresh and device-side persistence are required parts of the product experience.

## 5. Backend-Led Truth

Operational data, device health, session state, and capture history must come from backend contracts rather than duplicated client logic.

## 6. Minimal Role Surface

The mobile app is operator-only for the current phase. Do not expose admin-only capabilities by convenience.

## 7. Verification Over Assumption

Every meaningful implementation must end with explicit evidence:
- build success
- contract alignment
- workflow verification
- known gaps recorded as open questions
