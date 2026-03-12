Start-Sleep -Seconds 1
$response = Invoke-RestMethod `
    -Uri "http://localhost:8000/token" `
    -Method Post `
    -Headers @{"Content-Type"="application/x-www-form-urlencoded"} `
    -Body "username=admin&password=admin"

$response | ConvertTo-Json
Write-Host "Token: $($response.access_token)"
