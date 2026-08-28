const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const uploadedImage = "C:\\Users\\gimha\\.gemini\\antigravity-ide\\brain\\46cc71fc-cdef-4c78-8aae-5a1baa5c83ab\\.user_uploaded\\media_1787909226572.jpg";
const publicDir = path.join(__dirname, "..", "public");
const iconsDir = path.join(publicDir, "icons");
const srcAppDir = path.join(__dirname, "..", "src", "app");

if (!fs.existsSync(uploadedImage)) {
  console.error("Uploaded image not found:", uploadedImage);
  process.exit(1);
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate powershell script to produce PNGs and icons
const psScript = `
Add-Type -AssemblyName System.Drawing

$src = "${uploadedImage.replace(/\\/g, "\\\\")}"
$pubDir = "${publicDir.replace(/\\/g, "\\\\")}"
$icoDir = "${iconsDir.replace(/\\/g, "\\\\")}"
$appDir = "${srcAppDir.replace(/\\/g, "\\\\")}"

$img = [System.Drawing.Image]::FromFile($src)
Write-Host "Original Image Size: $($img.Width)x$($img.Height)"

# 1. Save main public/logo.png (1024x1024 / max quality)
$logoBmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($logoBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($img, 0, 0, 1024, 1024)
$logoPath = Join-Path $pubDir "logo.png"
$logoBmp.Save($logoPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$logoBmp.Dispose()
Write-Host "Saved: $logoPath"

# 2. Save public/vortex-mark.png (512x512)
$markBmp = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($markBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($img, 0, 0, 512, 512)
$markPath = Join-Path $pubDir "vortex-mark.png"
$markBmp.Save($markPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$markBmp.Dispose()
Write-Host "Saved: $markPath"

# 3. Generate icon sizes
$sizes = @(16, 32, 48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512)
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $s, $s)
    $outPath = Join-Path $icoDir "icon-$($s)x$($s).png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Saved icon: $outPath"
}

# 4. Generate .ico for favicon in src/app/favicon.ico and public/favicon.ico
$icoBmp = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($icoBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($img, 0, 0, 64, 64)

$hIcon = $icoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)

$fav1 = Join-Path $appDir "favicon.ico"
$stream1 = New-Object System.IO.FileStream($fav1, [System.IO.FileMode]::Create)
$icon.Save($stream1)
$stream1.Close()
Write-Host "Saved favicon: $fav1"

$fav2 = Join-Path $pubDir "favicon.ico"
$stream2 = New-Object System.IO.FileStream($fav2, [System.IO.FileMode]::Create)
$icon.Save($stream2)
$stream2.Close()
Write-Host "Saved favicon: $fav2"

$icon.Dispose()
$g.Dispose()
$icoBmp.Dispose()
$img.Dispose()
Write-Host "All icons successfully created!"
`;

const tempPsFile = path.join(__dirname, "temp_gen_icons.ps1");
fs.writeFileSync(tempPsFile, psScript, "utf8");

try {
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tempPsFile], {
    stdio: "inherit"
  });
} finally {
  if (fs.existsSync(tempPsFile)) {
    fs.unlinkSync(tempPsFile);
  }
}
