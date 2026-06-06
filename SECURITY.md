# Security Policy

## Credential Safety Notice

Sticky Assistant handles Google Workspace APIs, user documents, and external service credentials (such as Todoist API tokens). Keeping this data secure is our top priority.

We enforce strict architectural separation for private secrets:

- **Secret Isolation**: Private API tokens must only be saved in the secure **Global Layer** (`PropertiesService.getUserProperties()`).
- **Shared Configurations**: Do **not** commit credentials, API keys, or JSON config files (`sticky-assistant.json`) containing private tokens into public git repositories or shared workspace folders.

## Reporting a Vulnerability

If you discover any security vulnerability in this project, please **do not** create a public issue. Instead, report it directly to the maintainers by emailing:

- **Email:** security@rubenbroere.com

We will investigate the report and reply within 48 hours to coordinate a security release.
