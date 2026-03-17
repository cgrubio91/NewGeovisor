# Manual de Usuario: Geovisor Pro 

¡Bienvenidos a la interfaz avanzada de Geomática (GMab) para reportes de estado y análisis geoespacial del terreno! Aquí encontrará una guía paso a paso sobre las operaciones del Geovisor.

---

## 1. Acceso y Roles (Niveles de Permisos)

El Geovisor resguarda estrictamente sus flujos de trabajo en un modelo de 3 capas. A simple vista el panel cambiará sus atributos según la especialidad del usuario:
* **Colaborador / Usuario**: Nivel estándar. Puede acceder de forma inmediata al panel principal para contemplar los Proyectos Activos o la lista de visualizadores en 2D/3D a su nombre. Módulos gerenciales están ocultos de sus listas de tareas para salvaguardar la intimidad del ecosistema del proyecto.
* **Director (NUEVO ROl)**: Líder Técnico asignado. Al igual que el usuario general, su interfaz excluye la base de datos externa, enfocándose minuciosamente en los proyectos que le fueron encargados. De modo especial, su permiso le libera funcionalidades analíticas restringidas pudiendo consultar **Registros Geográficos, Métricas por ubicación** o depurar información KML hacia un visualizador independiente si el alcance temporal/del proyecto figura a su nombre.
* **Administrador**: Creador Absoluto. Posee visibilidad ilimitada sobre cada subproyecto de usuario en plataforma. Despliega todas sus mallas o carpetas permitiendo asignar roles administrativos entre directores de cualquier frente.

---

## 2. Módulo de Proyectos y Geovisualización
Al acceder al geoportal, verá exclusivamente sus *Proyectos Activos*. 
* **Pestaña Frontal**: Haga clic sobre un proyecto de interés (Tarjetas visuales) o directamente pulse su "Visor de Mapas" si ya sabe a dónde dirigirse.

El panel del *Visor de Mapas*, permite un nivel óptimo de organización donde usted interacciona con:
1. **El menú de visualización (Izquierda)**: Habilite polígonos, apague rastros topográficos o incremente el contraste arrastrando el símbolo del visor de capas cargadas previamente, o cambie su estética (Base maps) en tiempo real al modelo de contraste en relieve libre (Satélite de OpenStreetMap).

---

## 3. Módulo de Registros Geográficos (Uso exclusivo de Director/Admin)

La pestaña central para inspeccionar ubicaciones y cruzar metadatos en MongoDB. Esta herramiemta georreferencia al minuto las actividades de todo colaborador.

**¿Cómo Generar un Reporte Geográfico Exacto?**
1. Haga clic en la pestaña superir de navegación principal con icono *Registros*. Aparecerá un buscador integral si usted tiene Rol de Director o Administrador.
2. Ingrese obligatoriamente la *Fecha Inicial* y la *Fecha Final* requerida bajo el formato de calendario provisto.
3. Si desea rastrear un colaborador exacto u observar el proyecto en singular rellene los *"Filtros Opcionales"*. Seleccione de las listas desplegables (Recuerde que como Director, la barra bloquea subproyectos externos que usted desconozca). 
4. Pulse sobre ** Buscar Registros**.

### Análisis Posterior (Lectura Categórica)
Durante 10-20 segundos la herramienta bajará todo rastro MongoDB de la web y lo superpondrá automáticamente a los límites que delimite este portal. El color y estado de las cuadrículas mostrará:
* **🟩 EN OBRA (Verde)**: Confirmación de coordenadas capturadas estrictamente dentro del polígono primario o *kmz/kml* referenciado al interior del sistema.
* **🟨 EN OFICINA (Amarillo)**: Confirmación paralela del perímetro físico dictaminado en las geocercas satélites. 
* **🟥 UBICACIÓN EXTERNA (Rojo)**: Marcador de alerta roja por desvinculación a cualquier contorno oficial (Evidencia que un colaborador operó o firmó un documento distante).

### Descargas y Geolocalizaciones
Bajo la nueva actualización se habilita el esquema visual KML:
* Haga clic en `Descargar KML (Botón Rosa)`: El proceso producirá un archivo geográfico compatible nativamente con la app de *Google Earth* y mostrará todos los puntos del terreno clasificados por estilos de Obra, Oficina y Externa; cada punto contiene una ventana con fecha e hipervínculos funcionales directos hacia la página de su registro base (SEGMAB).
* Haga clic en `Descargar Excel (Botón Azul)`: El proceso arrojará un bloque masivo de cálculos limpios (Coordenadas crudas en Latitud/Longitud, Formatos y correos de las personas procesadas en el tiempo específico). Paralelamente la tabla virtual expondrá lo hallado de manera online.
