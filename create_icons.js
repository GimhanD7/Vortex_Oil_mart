const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const source = path.join(__dirname, "public", "logo.png");
const dir = path.join(__dirname, "public", "icons");
const appDir = path.join(__dirname, "src", "app");
const pubDir = path.join(__dirname, "public");

if (!fs.existsSync(source)) {
  throw new Error(`Source logo not found: ${source}`);
}

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const ps = (value) => value.replace(/'/g, "''");

const script = `
Add-Type -AssemblyName System.Drawing
$sourcePath = '${ps(source)}'
$iconDir = '${ps(dir)}'
$appPath = '${ps(appDir)}'
$pubPath = '${ps(pubDir)}'

$image = [System.Drawing.Image]::FromFile($sourcePath)
$sizes = @(16, 32, 48, 64, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512)

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.DrawImage($image, 0, 0, $size, $size)

  $out = Join-Path $iconDir "icon-$($size)x$($size).png"
  $bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

  if ($size -eq 32) {
    $bitmap.Save((Join-Path $pubPath "favicon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }

  if ($size -eq 180) {
    $bitmap.Save((Join-Path $appPath "apple-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }

  if ($size -eq 512) {
    $bitmap.Save((Join-Path $appPath "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }

  $graphics.Dispose()
  $bitmap.Dispose()
}

$icoBmp = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($icoBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($image, 0, 0, 64, 64)
$hIcon = $icoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$appFavicon = Join-Path $appPath "favicon.ico"
$appStream = New-Object System.IO.FileStream($appFavicon, [System.IO.FileMode]::Create)
$icon.Save($appStream)
$appStream.Close()

$publicFavicon = Join-Path $pubPath "favicon.ico"
$publicStream = New-Object System.IO.FileStream($publicFavicon, [System.IO.FileMode]::Create)
$icon.Save($publicStream)
$publicStream.Close()

$icon.Dispose()
$g.Dispose()
$icoBmp.Dispose()
$image.Dispose()
`;

const tempFile = path.join(__dirname, "temp_create_icons.ps1");
fs.writeFileSync(tempFile, script, "utf8");

try {
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tempFile], {
    stdio: "inherit",
  });
} finally {
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}

console.log("Icons created successfully from public/logo.png.");
