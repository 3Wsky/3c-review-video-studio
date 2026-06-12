# Create temp directory
$tempDir = Join-Path $env:TEMP "kenney_temp"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$scifiZip = Join-Path $tempDir "scifi.zip"
$uiZip = Join-Path $tempDir "ui.zip"

$scifiExtract = Join-Path $tempDir "scifi_extracted"
$uiExtract = Join-Path $tempDir "ui_extracted"

# Download ZIPs
Write-Host "Downloading kenney_ui-pack-scifi.zip..."
Invoke-WebRequest -Uri "https://opengameart.org/sites/default/files/kenney_ui-pack-scifi.zip" -OutFile $scifiZip -UserAgent "Mozilla/5.0"

Write-Host "Downloading kenney_ui-pack.zip..."
Invoke-WebRequest -Uri "https://opengameart.org/sites/default/files/kenney_ui-pack.zip" -OutFile $uiZip -UserAgent "Mozilla/5.0"

# Extract ZIPs
Write-Host "Extracting ZIPs..."
Expand-Archive -Path $scifiZip -DestinationPath $scifiExtract -Force
Expand-Archive -Path $uiZip -DestinationPath $uiExtract -Force

# Target directory
$destDir = "public/game-assets/sprites/kenney"
if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

# Copy Sci-Fi sprites
$scifiSourceDir = Join-Path $scifiExtract "PNG/Default"
if (!(Test-Path $scifiSourceDir)) {
    # Try alternate directory structure if any
    $scifiSourceDir = Get-ChildItem -Path $scifiExtract -Filter "PNG" -Recurse | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName "Default" }
}

Write-Host "Copying Sci-Fi sprites from $scifiSourceDir..."
$scifiMapping = @(
    @("button_rectangle_depth_flat.png", "btn_panel.png"),
    @("button_rectangle_depth_gloss.png", "btn_panel_gloss.png"),
    @("bar_round_large_m.png", "bar_hp_track.png"),
    @("bar_round_large_m_outline.png", "bar_hp_fill_mask.png"),
    @("panel_rectangle.png", "panel_hud.png"),
    @("panel_corner_tl.png", "corner_tl.png"),
    @("panel_corner_tr.png", "corner_tr.png"),
    @("panel_corner_bl.png", "corner_bl.png"),
    @("panel_corner_br.png", "corner_br.png"),
    @("crosshair_a.png", "crosshair.png"),
    @("icon_checkmark.png", "icon_check.png"),
    @("icon_cross.png", "icon_cross.png"),
    @("progress_bar_round_large.png", "ring_track.png")
)

foreach ($map in $scifiMapping) {
    $src = Join-Path $scifiSourceDir $map[0]
    $dst = Join-Path $destDir $map[1]
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "Copied $($map[0]) to $($map[1])"
    } else {
        Write-Warning "Source file not found: $src"
    }
}

# Copy UI sprites
$uiSourceDir = Join-Path $uiExtract "PNG/Blue/Default"
if (!(Test-Path $uiSourceDir)) {
    # Try alternate directory structure if any
    $uiSourceDir = Get-ChildItem -Path $uiExtract -Filter "Default" -Recurse | Where-Object { $_.FullName -like "*Blue*" } | Select-Object -First 1 | ForEach-Object { $_.FullName }
}

Write-Host "Copying UI sprites from $uiSourceDir..."
$uiMapping = @(
    @("bar_round_gloss_large.png", "bar_stat_track.png"),
    @("bar_round_gloss_small.png", "bar_stat_sm.png"),
    @("button_square_depth_flat.png", "node_off.png"),
    @("button_square_depth_gloss.png", "node_on.png"),
    @("icon_diamond.png", "icon_vs.png")
)

foreach ($map in $uiMapping) {
    $src = Join-Path $uiSourceDir $map[0]
    $dst = Join-Path $destDir $map[1]
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "Copied $($map[0]) to $($map[1])"
    } else {
        Write-Warning "Source file not found: $src"
    }
}

# Clean up
Write-Host "Cleaning up temp files..."
# Remove-Item $tempDir -Recurse -Force
Write-Host "Done!"
