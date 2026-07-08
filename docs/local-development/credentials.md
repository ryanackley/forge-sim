# Credentials

Reference for how forge-sim stores and manages credentials. 

## Managing accounts

```bash
forge-sim auth                # Add account or switch default
forge-sim auth --list         # List configured accounts + LLM key status
forge-sim auth --remove ID    # Remove a specific account
forge-sim auth --clear        # Remove all credentials (service config preserved)
forge-sim auth --clear-all    # Remove credentials AND service config
forge-sim auth --local        # Store credentials per-app instead of global
forge-sim auth --llm          # Configure Anthropic API key (for @forge/llm)
```

## Storage

| File | Contents |
|------|----------|
| `~/.forge-sim/credentials.json` | Atlassian PAT accounts + third-party tokens (`0600`) |
| `~/.forge-sim/config.json` | Service config (Anthropic API key, future settings) |
| `<app>/.forge-sim/credentials.json` | Per-app override (`--local`) |
| `<app>/.forge-sim/providers.json` | External provider client secrets (`0600`) |

Add `.forge-sim/` to your `.gitignore`.

## Environment variables

For CI/CD or non-interactive environments:

```bash
export FORGE_SIM_SITE=mysite.atlassian.net
export FORGE_SIM_EMAIL=user@example.com
export FORGE_SIM_PAT=ATATT3x...
```

Per-provider third-party tokens:

```bash
export FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN=ya29.your-test-token
# Convention: FORGE_SIM_PROVIDER_<KEY_UPPERCASE_WITH_UNDERSCORES>_TOKEN
```

Anthropic key (for `@forge/llm`):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
