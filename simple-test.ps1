# Simple registration test
$BaseUrl = "http://localhost:3005/api"

Write-Host "🔍 Testing registration..." -ForegroundColor Cyan

$body = @{
    username = "testcloneA"
    password = "password123"
    deviceFingerprint = "test_device_123abc"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method POST -Uri "$BaseUrl/auth/register" `
        -Headers @{
            "Content-Type" = "application/json"
            "X-Forwarded-For" = "192.168.1.1"
        } `
        -Body $body
    
    Write-Host "✅ SUCCESS! Response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor White
}
catch {
    Write-Host "❌ FAILED! Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Try to read error body
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Backend response: $errorBody" -ForegroundColor Gray
    }
    catch {
        Write-Host "Could not read error body" -ForegroundColor Gray
    }
}
