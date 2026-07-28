# CinemaMod player host

This directory contains the static player pages used by this fork.

Production URL: `https://hanbi-cinemamod-player.bshanbi.workers.dev`

## Test

Requires Node.js 18 or newer. No packages need to be installed.

```bash
node test/test-package.mjs
node test/test-player.mjs
```

The tests cover all four service pages, the CinemaMod JavaScript API (`th_video`, `th_volume`, and `th_seek`), volume and seeking, startup delay compensation, periodic drift correction, and simulated two-client synchronization.

## Deploy to Cloudflare Workers

Create a Workers static-assets project and upload the contents of `public/` while preserving the directory structure. After deployment, verify it from PowerShell:

```powershell
./verify-deployment.ps1 -BaseUrl "https://your-worker.workers.dev"
```

If the host URL changes, update all four values in `bukkit/src/main/java/com/cinemamod/bukkit/service/VideoServiceType.java`.