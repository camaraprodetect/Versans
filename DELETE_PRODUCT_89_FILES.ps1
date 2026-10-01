$Store = $PSScriptRoot
$Target = Join-Path $Store 'images\products\product-89'
if (Test-Path $Target) {
    Remove-Item -LiteralPath $Target -Recurse -Force
    Write-Host 'Deleted images\products\product-89' -ForegroundColor Green
} else {
    Write-Host 'product-89 image folder already absent.' -ForegroundColor Yellow
}
