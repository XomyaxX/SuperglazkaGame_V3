docker compose up --build -d
if ($?) {
    Write-Output "Project started. Frontend: http://localhost:80, Backend: http://localhost:3000"
    docker compose logs -f
}
