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

## When stored credentials are used

Storing an account does not by itself connect anything. Each channel decides whether to load credentials, and only `forge-sim dev` does so without being asked:

| Channel | Default | Turn it on | Turn it off |
|---------|---------|------------|-------------|
| `forge-sim dev` | **connects** (announced on the console) | — | `--offline` or `FORGE_SIM_CONNECT=0` |
| MCP server (`forge-sim-mcp`) | offline | `--connect` (in the server's `args` in `.mcp.json`, after the binary) or `FORGE_SIM_CONNECT=1` in its env | default |
| CLI daemon (`forge-sim deploy`) | offline, decided per deploy | `forge-sim deploy --connect`, or `FORGE_SIM_CONNECT=1` set for that `forge-sim deploy` command | default (a deploy without `--connect` unloads what an earlier one loaded) |
| Test library (`createSimulator()`) | offline | call `sim.loadAuthFromEnv()` after `deploy()` | default |

`FORGE_SIM_CONNECT` accepts `1`/`true`/`yes`/`on` and `0`/`false`/`no`/`off`; any other value is an error. A `--connect`/`--offline` flag beats the env var, and passing both flags is an error. It applies to the three command-line channels; the test library ignores it and connects only when a test calls `sim.loadAuthFromEnv()`.

"Connecting" loads everything below in one step: the default Atlassian account (or the `FORGE_SIM_SITE`/`FORGE_SIM_EMAIL`/`FORGE_SIM_PAT` env trio, which wins over the store), its third-party provider tokens and any `FORGE_SIM_PROVIDER_<KEY>_TOKEN`, the provider client secrets in `<app>/.forge-sim/providers.json`, and the Anthropic key from `forge-sim auth --llm`. The env credentials are read only when the channel connects, same as the store. (An `ANTHROPIC_API_KEY` in the process environment is the exception: `@forge/llm` calls read it directly on every channel.)

The daemon decides per deploy: the CLI resolves the policy for each `forge-sim deploy` and sends it along, so `forge-sim serve --connect` or a `FORGE_SIM_CONNECT` in the daemon's own environment does nothing. A deploy without `--connect` (`--no-reset` included) unloads everything an earlier `--connect` loaded (the account, provider tokens — refreshed ones too — provider secrets and the `auth --llm` key), and so does `forge-sim reset`; the CLI prints what it unloaded. A deploy *with* `--connect` reloads from the store, so a credential removed with `forge-sim auth` since the last deploy is gone. The credentials themselves are read by the daemon, though: the `FORGE_SIM_SITE`/`FORGE_SIM_EMAIL`/`FORGE_SIM_PAT` trio and `FORGE_SIM_PROVIDER_<KEY>_TOKEN` come from the environment of the shell that started the daemon (the first `forge-sim` command that needed it), not from each `forge-sim deploy --connect`. Run `forge-sim stop` to pick up new ones.

Whatever is connected, **mocks always win**: a mocked route answers for `jira`/`confluence`/`bitbucket`, remotes, provider remotes and `stargate`, whether it was registered before or after the connection, and whatever status it returns (a mocked `404` is the answer, not a cue to ask the site). A call no mock answers goes on as follows: for `jira`/`confluence`/`bitbucket`, to the connected site; for a remote or provider remote, to its real backend only if nothing at all is mocked for that key (otherwise `404 "No mock route matched"`); for `stargate` (the gateway: `requestGraph`, `requestAtlassian`), to the site's `/gateway/api`.

An offline MCP server still tells you when credentials exist that `--connect` would load: `forge_deploy` returns `auth.atlassian.credentialsFound` with a hint, and `forge_auth_status` returns `atlassian.available` and the connect `policy`.

## Environment variables

For CI/CD or non-interactive environments (read only by a channel that connects, see above):

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
