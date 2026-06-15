# Precomputed Nova V3 scans

This folder stores real Nova V3 JSON responses generated locally.

Use:

```bash
npm run export:scan -- --chain eth --address 0x44b28991b167582f18ba0259e0173176ca125505 --mode fast
```

Rules:

- Only save successful local `/api/scoring/nova-conviction-v3-test` responses.
- Do not create placeholder, random, or manually invented scan data.
- Filenames are keyed as `chain-address-analysisMode.json`.
