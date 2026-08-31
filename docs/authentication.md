# Authentication

pbctl uses OIDC device authorization flow to log in to the backend.

## Microsoft Entra ID Specific scopes

Add the scope of the backend's app registration to the profile:

```json
"scopes": ["openid", "profile", "api://<backend-application-id>/.default"]
```

> [!IMPORTANT]
> Do not commit tenant IDs, application IDs to this repository.

## Troubleshooting

- 401 on every request: the backend rejects the token itself. Add the API scope mentioned above.
- 403 on some requests: the token is valid but the user lacks a role.
