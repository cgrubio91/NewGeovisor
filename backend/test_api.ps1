Start-Sleep -Seconds 1
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3MzQxODk3NX0.oMinPu-CTQdVUA-6UFEbDrpBFWc96XWQhmjbtyBSKhs"

$body = @{
    "fecha_inicio" = "2026-01-01"
    "fecha_fin" = "2026-03-31"
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "http://localhost:8000/api/v1/geographic-records/generar-reporte" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body

$response | ConvertTo-Json -Depth 5
