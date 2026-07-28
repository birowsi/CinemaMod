param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$baseUri = [Uri]$BaseUrl
if ($baseUri.Scheme -ne 'https') {
    throw 'BaseUrl must use HTTPS.'
}

$normalizedBase = $BaseUrl.TrimEnd('/')
$checks = @(
    @{ Path = '/'; Type = 'text/html'; Marker = 'CinemaMod player host is online.' },
    @{ Path = '/service/v1/youtube.html'; Type = 'text/html'; Marker = 'data-service="youtube"' },
    @{ Path = '/service/v1/twitch.html'; Type = 'text/html'; Marker = 'data-service="twitch"' },
    @{ Path = '/service/v1/file.html'; Type = 'text/html'; Marker = 'data-service="file"' },
    @{ Path = '/service/v1/hls.html'; Type = 'text/html'; Marker = 'data-service="hls"' },
    @{ Path = '/assets/player.js'; Type = 'javascript'; Marker = 'window.th_video' },
    @{ Path = '/assets/player.css'; Type = 'text/css'; Marker = '#player' }
)

$results = foreach ($check in $checks) {
    $uri = $normalizedBase + $check.Path
    $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 10
    $contentType = [string]$response.Headers.'Content-Type'

    if ([int]$response.StatusCode -ne 200) {
        throw "$uri returned HTTP $($response.StatusCode)."
    }
    if ($contentType -notlike "*$($check.Type)*") {
        throw "$uri returned unexpected Content-Type: $contentType"
    }
    if ([string]$response.Content -notlike "*$($check.Marker)*") {
        throw "$uri is missing marker: $($check.Marker)"
    }

    [PSCustomObject]@{
        Url = $uri
        Status = [int]$response.StatusCode
        ContentType = $contentType
        Bytes = [int]$response.RawContentLength
    }
}

$playerSource = [string](
    Invoke-WebRequest -UseBasicParsing -Uri "$normalizedBase/assets/player.js" -TimeoutSec 10
).Content

foreach ($required in @(
    'window.th_video',
    'window.th_volume',
    'window.th_seek',
    'DRIFT_CHECK_MS = 5000',
    'DRIFT_LIMIT_SECONDS = 1.25'
)) {
    if ($playerSource -notlike "*$required*") {
        throw "player.js is missing required implementation: $required"
    }
}

$results | Format-Table -AutoSize
Write-Output 'DEPLOYMENT_VERIFICATION=PASS'
