$folder = "images\products\product-4"
if (Test-Path $folder) {
    Remove-Item $folder -Recurse -Force
    Write-Host "Deleted: $folder" -ForegroundColor Green
}
