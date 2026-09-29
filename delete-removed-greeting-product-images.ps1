$folders = @(
  "images\products\product-5",
  "images\products\product-3",
  "images\products\product-6",
  "images\products\product-7",
  "images\products\product-8",
  "images\products\product-9"
)

foreach ($folder in $folders) {
  if (Test-Path $folder) {
    Remove-Item $folder -Recurse -Force
    Write-Host "Deleted: $folder" -ForegroundColor Green
  }
}
