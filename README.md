# Sistema de avistamientos de la Marina

Módulo funcional para registrar, consultar, editar y eliminar avistamientos de criminales.

## Tecnologías

- Frontend: React, TypeScript y Vite.
- Backend: Node.js, Express y TypeScript.
- Base de datos: MySQL/MariaDB mediante `mysql2`.
- No incluye autenticación ni inicio de sesión, tal como se definió para esta primera versión.

## Requisitos

- Node.js y npm.
- XAMPP con MySQL/MariaDB iniciado, o un servidor MySQL compatible.
- Base de datos `marina_inteligencia` con las tablas del script SQL original.

## 1. Configurar el backend

Abre una terminal en la carpeta `backend`:

```powershell
cd backend
npm install
```

Copia `.env.example` como `.env`. En Windows PowerShell puedes ejecutar:

```powershell
Copy-Item .env.example .env
```

Abre `backend/.env` y configura el usuario y contraseña que realmente usas en MySQL Workbench:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=marina_inteligencia
PORT=3000
FRONTEND_URL=http://localhost:5173
```

`DB_PASSWORD` queda vacío solo si tu usuario MySQL no tiene contraseña. No compartas el archivo `.env`.

Inicia el backend:

```powershell
npm run dev
```

La API quedará disponible en `http://localhost:3000`.

Comprueba:
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/db-health`
- `http://localhost:3000/api/criminales`
- `http://localhost:3000/api/avistamientos`

## 2. Configurar el frontend

Abre una segunda terminal en la carpeta `frontend`:

```powershell
cd frontend
npm install
```

Copia el archivo de variables de ejemplo:

```powershell
Copy-Item .env.example .env
```

El contenido por defecto apunta al backend local:

```dotenv
VITE_API_URL=http://localhost:3000
```

Inicia el frontend:

```powershell
npm run dev
```

Abre la URL que Vite muestre, normalmente `http://localhost:5173`.

## 3. Construir para producción

Desde `backend`, ejecuta `npm run build`; desde `frontend`, ejecuta `npm run build`. El backend compilado se ejecuta con `npm start` dentro de `backend`. Para desarrollo, usa `npm run dev` en cada carpeta.

## 4. Funcionalidad implementada

- Listado de avistamientos con nombre del criminal.
- Búsqueda por criminal o ubicación.
- Registro de avistamientos.
- Edición de avistamientos existentes.
- Eliminación con confirmación.
- Selector de criminales alimentado desde la base de datos.
- Indicador de conexión del backend y de la base de datos.
- Validación de campos en frontend y backend.
- Respuestas HTTP adecuadas (`201`, `400`, `404`, `500`).
- Consultas SQL parametrizadas.
- Identificadores UUID para nuevos avistamientos.

## 5. Estructura de la tabla utilizada

El módulo se adapta al esquema SQL existente:

```sql
avistamientos (
  id VARCHAR(36) PRIMARY KEY,
  criminal_id VARCHAR(36) NOT NULL,
  fecha_hora TIMESTAMP NOT NULL,
  ubicacion TEXT NOT NULL
)
```

La tabla no tiene columnas `testigo` ni `verificado`; por eso no se usan en este módulo. La relación exige que `criminal_id` exista en `criminales`.

## 6. SQL de inicialización

El archivo `database/schema.sql` contiene el script original adaptado al nombre `marina_inteligencia`.

**Advertencia importante:** ese script elimina y vuelve a crear varias tablas antes de insertar datos de prueba. Como ya ejecutaste el script y tienes la base funcionando, **no lo ejecutes de nuevo sobre tu base actual**, porque podrías borrar datos. Solo úsalo para una instalación nueva o después de hacer un respaldo.

El archivo `database/verificacion.sql` contiene consultas de solo lectura para comprobar la base.

## 7. Probar el CRUD manualmente

### Listar
```http
GET http://localhost:3000/api/avistamientos
```

### Crear
```http
POST http://localhost:3000/api/avistamientos
Content-Type: application/json
```

```json
{
  "criminal_id": "c-luffy",
  "fecha_hora": "2026-10-20T10:30",
  "ubicacion": "Isla del Nuevo Mundo"
}
```

El identificador `c-luffy` corresponde al dato de prueba del script incluido. Usa un ID que exista en tu base de datos.

### Actualizar
```http
PUT http://localhost:3000/api/avistamientos/ID_DEL_AVISTAMIENTO
Content-Type: application/json
```

Usa el mismo formato JSON del ejemplo de creación.

### Eliminar
```http
DELETE http://localhost:3000/api/avistamientos/ID_DEL_AVISTAMIENTO
```

## 8. Problemas frecuentes

- **`ECONNREFUSED`**: confirma que MySQL/MariaDB esté iniciado en XAMPP y que el puerto configurado sea correcto.
- **`Access denied`**: revisa `DB_USER` y `DB_PASSWORD`.
- **`Unknown database`**: confirma que existe `marina_inteligencia`.
- **El frontend no conecta**: confirma que ambos servidores estén activos y que `VITE_API_URL` apunte al backend.
- **No hay avistamientos**: la lista vacía `[]` es válida si todavía no has registrado ninguno.

## 9. Ejecutar en cada sesión

1. Inicia MySQL en XAMPP.
2. En una terminal, ejecuta `npm run dev` desde `backend`.
3. En otra terminal, ejecuta `npm run dev` desde `frontend`.
4. Abre `http://localhost:5173`.
