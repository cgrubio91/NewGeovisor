# Guía Rápida de Inicio

Sigue estos pasos para poner en marcha el proyecto:

## 1. Backend (FastAPI)
Abre una terminal (PowerShell) y ejecuta:

```powershell
# 1. Navegar a la carpeta raíz
cd "c:\Users\cgrub\OneDrive\Documents\NewGeovisor-1"

# 2. Activar el entorno virtual
.\.venv\Scripts\Activate.ps1

# 3. Ir a la carpeta del backend e iniciar el servidor
cd backend
python main.py
```
*El backend estará disponible en: `http://localhost:8000`*

## 2. Frontend (Angular)
Abre **otra** terminal y ejecuta:

```powershell
# 1. Navegar a la carpeta del frontend
cd "c:\Users\cgrub\OneDrive\Documents\NewGeovisor-1\frontend"

# 2. Iniciar el servidor de desarrollo
npm start
```
*El frontend estará disponible en: `http://localhost:4200`*

---

### Notas Importantes:
- Asegúrate de que el archivo `.env` en la carpeta `backend` tenga las credenciales correctas.
- Si es la primera vez que lo corres, asegúrate de tener las dependencias instaladas (`pip install -r requirements.txt` y `npm install`).
