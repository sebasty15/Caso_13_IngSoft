# Pruebas rápidas de la API (PowerShell)

Ejecuta estos comandos con el backend iniciado. El POST usa el criminal `c-luffy` del SQL de ejemplo; confirma que exista en tu base.

## Consultar salud
```powershell
Invoke-RestMethod http://localhost:3000/api/db-health
```

## Consultar criminales
```powershell
Invoke-RestMethod http://localhost:3000/api/criminales
```

## Crear un avistamiento
```powershell
$body = @{
  criminal_id = "c-luffy"
  fecha_hora = "2026-10-20T10:30"
  ubicacion = "Isla del Nuevo Mundo"
} | ConvertTo-Json

$created = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/avistamientos" `
  -Method Post -ContentType "application/json" -Body $body

$created
```

Copia el `id` devuelto para las pruebas PUT y DELETE.

## Listar
```powershell
Invoke-RestMethod http://localhost:3000/api/avistamientos
```

## Editar (sustituye ID_AQUI por el id devuelto)
```powershell
$id = "ID_AQUI"
$body = @{
  criminal_id = "c-luffy"
  fecha_hora = "2026-10-20T11:15"
  ubicacion = "Archipiélago Sabaody, muelle norte"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/avistamientos/$id" `
  -Method Put -ContentType "application/json" -Body $body
```

## Eliminar (sustituye ID_AQUI por el id devuelto)
```powershell
$id = "ID_AQUI"
Invoke-RestMethod -Uri "http://localhost:3000/api/avistamientos/$id" -Method Delete
```
