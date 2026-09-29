$folders = @(
  "images\products\product-76",
  "images\products\product-85",
  "images\products\product-86",
  "images\products\product-87",
  "images\products\product-88"
)

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Remove-Item $folder -Recurse -Force
        Write-Host "Deleted: $folder" -ForegroundColor Green
    }
}
