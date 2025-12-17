# CompuLab

Colección de simuladores científicos y visualizaciones interactivas desarrolladas como proyecto educativo y de portafolio.

## Resumen

CompuLab incluye simuladores y demos estáticas que exploran modelos matemáticos y algoritmos (Lotka–Volterra, ordenación, autómatas, codificación esteganográfica). La interfaz usa páginas HTML modulares, JavaScript moderno para la lógica de simulación y Canvas 2D para la visualización.

## Estructura del repositorio

- `index.html`, `modelos.html`, `sobre.html` — páginas principales.
- `src/components/` — componentes HTML reutilizables (header, footer).
- `src/js/` — lógica del frontend (cargador de componentes, simuladores, utilidades).
- `src/css/` — estilos específicos por simulador.
- `python/` — scripts auxiliares en Python (codificador esteganográfico, modelos, utilidades).

## Stack y tecnologías

- JavaScript (ES6+), DOM API, Canvas 2D
- Bootstrap (incluido en `package.json`) para estilos y componentes UI
- Python para scripts de apoyo y prototipos científicos
- HTML/CSS modular para componentes reutilizables

## Características técnicas destacadas

- Simulaciones numéricas en cliente con integrador Runge–Kutta 4 (RK4) para el modelo Lotka–Volterra.
- Representación y animación en Canvas usando `requestAnimationFrame` para mantener rendimiento.
- Cargador de componentes dinámico (`src/js/component-loader.js`) que inserta header/footer y reinicializa componentes de Bootstrap.
- Controles interactivos (sliders/inputs) para ajustar parámetros en tiempo real y visualizar resultados.
- Utilidades para inicializar y distribuir poblaciones de manera aleatoria y proporcional.

## Cómo ejecutar (local)

Para ver el proyecto localmente sirve la carpeta con un servidor HTTP simple y abre `index.html` en el navegador:

```bash
# desde la raíz del proyecto
python -m http.server 8000
# luego navegar a http://localhost:8000
```

Alternativamente, abrir `index.html` directamente en el navegador (algunas demos necesitan servidor para fetch de componentes).

## Qué demuestra este proyecto (habilidades)

- Desarrollo front-end con JavaScript moderno: asincronía (`fetch`/`async-await`), manipulación del DOM y arquitectura modular.
- Implementación de modelos matemáticos y algoritmos numéricos (RK4) y adaptación a visualizaciones discretas.
- Diseño de UI interactiva y optimización de loops gráficos para animaciones fluidas.
- Integración de herramientas en Python para procesamiento/GUI complementarias.


## Créditos
Autor: Diego Goñas
