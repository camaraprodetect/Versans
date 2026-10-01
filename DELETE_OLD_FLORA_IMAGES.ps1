$Store = (Get-Location).Path
$Files = @(
  (Join-Path $Store 'images\products\product-15\product-15-3.png'),
  (Join-Path $Store 'images\products\product-16\product-16-3.png'),
  (Join-Path $Store 'images\products\product-17\product-17-3.png')
)
foreach ($File in $Files) {
  if (Test-Path $File) { Remove-Item $File -Force }
}
Write-Host 'Old Flora images removed.' -ForegroundColor Green
