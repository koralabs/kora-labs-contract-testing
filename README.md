# kora-labs-contract-testing

## Contributor test policy

Tests and coverage run locally only, never in GitHub Actions, directly or through lifecycle scripts, composites, workflow templates, or shared helpers. Preserve local test commands. Build, lint, publication, deployment, and production guards remain permitted. Remove obsolete required test checks when retiring them.