# CinemaMod player-host restoration

This fork restores CinemaMod's retired embedded web player.
The restoration is maintained by [@birowsi](https://github.com/birowsi).

Production player host:
[`hanbi-cinemamod-player.bshanbi.workers.dev`](https://hanbi-cinemamod-player.bshanbi.workers.dev)

## What was broken

CinemaMod's Bukkit service definitions pointed YouTube, Twitch, file, and HLS
players to a retired Vultr Object Storage bucket. The embedded Chromium client
opened that URL correctly, but the storage service returned a `NoSuchBucket`
XML page instead of a video player.

## How this fork fixes it

- Replaces the four retired service-page URLs in Bukkit's
  `VideoServiceType` with the public HTTPS player host.
- Adds the complete static player implementation under [`static-host/`](static-host/).
- Preserves CinemaMod's existing JavaScript API: `th_video`, `th_volume`, and
  `th_seek`.
- Compensates for player startup latency and checks playback drift every five
  seconds, correcting offsets greater than 1.25 seconds.
- Leaves CinemaMod's server-authoritative playback time, volume commands,
  seek commands, video IDs, and network protocol unchanged.
- Provides a client-side redirect fallback for users on servers that cannot
  update their Bukkit plugin immediately. The fallback changes only the exact
  retired player host and does not run a localhost server.

Because the timing protocol is unchanged, users with the client fallback and
users receiving the repaired URL from an updated server follow the same server
playback timeline.

## Applying the fix

### Server-wide

Use the current server plugin version and replace only its four service URLs
with the matching endpoints under:

```text
https://hanbi-cinemamod-player.bshanbi.workers.dev/service/v1/
```

Rebuild and restart the server. Clients then receive the repaired URL directly
and do not need a separate redirect mod.

### Client-side fallback

When the server cannot be changed, each viewer can install the compatible
Cinema URL Fix client mod. It redirects the retired URL to the same public
player host while preserving all server-provided synchronization commands.

## Verification

The static host requires no npm dependencies. With Node.js 18 or newer:

```bash
cd static-host
npm test
```

The tests cover all four service pages, volume, seeking, startup-delay
compensation, drift correction, and simulated two-client synchronization.
Verify a production deployment from PowerShell with:

```powershell
./static-host/verify-deployment.ps1 `
  -BaseUrl "https://hanbi-cinemamod-player.bshanbi.workers.dev"
```

## Scope

This restoration repairs the embedded video player pages. Other retired bucket
assets such as legacy thumbnails or preview textures are not replaced.
YouTube VOD and regular files provide the strongest synchronization; Twitch
Live and HLS retain the seek limitations of CinemaMod's original protocol.

## Credits

CinemaMod and its original source were created by the CinemaMod contributors.
The player-host restoration, deployment, compatibility work, and tests in this
fork are maintained by [@birowsi](https://github.com/birowsi).

## License

This fork retains CinemaMod's original MIT license.