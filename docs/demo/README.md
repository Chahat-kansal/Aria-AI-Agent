# Aria Agent Training Demo

Video: `docs/demo/aria-agent-training-demo.mp4`

This demo uses only dummy BrightPath Migration Demo data. The local recording script seeds fake users, fake matters, fake documents, fake extracted fields, a fake invoice, a fake pathway analysis, and a secure client portal link. The raw portal token is not written into this README or transcript.

## Dummy users

- owner@brightpath-demo.com
- admin@brightpath-demo.com
- agent.sarah@brightpath-demo.com
- agent.james@brightpath-demo.com
- client.aarav@brightpath-demo.com
- client.emma@brightpath-demo.com

Demo password for local/staging only: `BrightPath-Demo-Only-2026!`

## Covered matters

- Aarav Sharma - Subclass 500 Student
- Emma Collins - 482 Skills in Demand style employer sponsored
- Lina Chen - 820/801 Partner
- Miguel Santos - 600 Visitor

## How to regenerate

1. Start or allow the script to start the local app on `http://localhost:3007`.
2. Run: `npx tsx scripts/record-agent-training-demo.ts`.
3. Review `docs/demo/aria-agent-training-demo.mp4` and the screenshots.

## Recording limitations

This environment records silent browser video only. Use `aria-agent-training-script.md` as the voiceover script. Platform admin is intentionally skipped unless a safe platform-admin demo account is configured.
