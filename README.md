# Bitburner scripts

This is my collection of scripts I'm using in the game Bitburner ([steam](https://bitburner.readthedocs.io/en/latest/), [github](https://github.com/bitburner-official/bitburner-src)).

## Requirements

Basically any version of Node which works with version of typescript in package.json.

Also pnpm 10.28.1, but corepack will sort that out for you.

## Installation

If you have nvm installed:

```bash
nvm use
```

[Install pnpm using corepack:](https://pnpm.io/installation#using-corepack)

```bash
npm i -g corepack@latest
corepack enable pnpm
```

Then finally:

```bash
pnpm install
```

## Usage

Start `bitburner-filesync` with:

```bash
pnpm start
```

When in game:

1. Go to Settings
2. Go to 'Remote API'
3. Enter `12525` as the port, click connect
4. Make changes locally and it should sync to the game

## Scripts Overview

### analyse

#### scan.ts

_WIP_

This is a WIP file to replace `scan-analyze` in game.

#### server.ts

Prints server information to console.

### dedicated

#### ctl.ts

Controls purchased servers (dedicated servers), named after `systemctl` or `journalctl` for example.

### factions

#### share.ts

Calls `ns.share()` in an infinite loop.

### hack

#### access.ts

Gets all nodes within a given depth, checks requirements, opens ports where necessary, and runs `ns.nuke()` if possible.

#### propogate.ts

1. Takes a given script, target, and depth
2. `scp` the script to all servers with root access within the depth
3. executes script with target as argument.

#### server.ts

Basic hacking template in beginners tutorial.

### neighbours

#### hack.ts

_Depreciated_

Used before hack/access.ts with immediate neighbours only.

#### propogate.ts

_Deprecated_

Used before hack/propogate.ts with immediate neighbours only.

#### utils.ts

Contains some badly named util functions to get all nodes within a given depth.
