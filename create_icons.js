const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const source = path.join(__dirname, "public", "logo.png");
const dir = path.join(__dirname, "public", "icons");

if (!fs.existsSync(source)) {
  throw new Error(`Source logo not found: ${source}`);
}

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const script = `
Add-Type -AssemblyName System.Drawing
$sourcePath = '${source.replace(/'/g, "''")}'
$iconDir = '${dir.replace(/'/g, "''")}'
foreach ($size in @(192, 512)) {
  $image = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($image, 0, 0, $size, $size)
  $out = Join-Path $iconDir "icon-$($size)x$($size).png"
  $bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  $image.Dispose()
}
`;

execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
  stdio: "inherit",
});

console.log("Icons created from public/logo.png.");
