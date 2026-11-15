# AWS production evidence — 15/11/2026

- Commit: 081de7c715661bbc2bea98c26288a927080dfcae
- Workflow: https://github.com/LLiang-g/SOFTWARE_ENGINEERING_BREWLITE/actions/runs/43676797649
- Deploy job: 132701448347; publish job: 132701296399.
- Website: https://13.228.196.157 ; health: https://13.228.196.157:8443/health
- jobs.json: job/step metadata from GitHub API.
- deploy-summary.log: selected original UTC log lines, ANSI removed.
- live-check.json: direct HTTPS HTTP status and health response; default certificate validation enabled.
- Report screenshots aws-web.png and aws-health.png were captured directly with Edge/Playwright. aws-cd-evidence.png is a clearly labelled summary of metadata/log, not a GitHub UI screenshot.
- Deployment diagram source: docs/diagrams/a2-deployment-aws.puml, based on deploy/aws at this commit. Mock payment enabled, VNPay disabled in this deployment configuration.
- Successful deployment does not establish that a failure-triggered rollback has been tested.
