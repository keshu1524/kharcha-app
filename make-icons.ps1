# Kharcha Tracker app icons generate karta hai (GDI+ se)
Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  # Purple -> Pink gradient background
  $rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 124, 58, 237),
    [System.Drawing.Color]::FromArgb(255, 236, 72, 153),
    45)
  $g.FillRectangle($brush, $rect)

  # Center me white rupee symbol
  $font = [System.Drawing.Font]::new('Segoe UI', ($size * 0.42), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $box = [System.Drawing.RectangleF]::new(0, ($size * -0.04), $size, $size)
  $g.DrawString([string]::new([char]0x20B9), $font, [System.Drawing.Brushes]::White, $box, $format)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Saved: $path"
}

New-Icon 512 "$PSScriptRoot\icon-512.png"
New-Icon 192 "$PSScriptRoot\icon-192.png"
