class ComponentLoader {
    constructor() {
        this.components = {};
    }
    
    async loadComponent(name, filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Error loading ${filePath}: ${response.status}`);
            }
            const html = await response.text();
            this.components[name] = html;
            
            // Insertar en todos los elementos con data-component="nombre"
            const elements = document.querySelectorAll(`[data-component="${name}"]`);
            elements.forEach(element => {
                element.innerHTML = html;
                
                // Reactivar los dropdowns de Bootstrap si existen
                this.initializeBootstrapComponents();
            });
            
            console.log(`✅ Componente "${name}" cargado correctamente`);
        } catch (error) {
            console.error(`❌ Error cargando ${name}:`, error);
        }
    }
    
    initializeBootstrapComponents() {
        // Reinicializar dropdowns de Bootstrap si están disponibles
        if (typeof bootstrap !== 'undefined') {
            const dropdowns = document.querySelectorAll('.dropdown-toggle');
            dropdowns.forEach(dropdown => {
                new bootstrap.Dropdown(dropdown);
            });
        }
    }
    
    // Método para marcar la página activa automáticamente
    setActivePage() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html' ;
        
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkHref = link.getAttribute('href');
            if (linkHref && linkHref.includes(currentPage)) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    }
}

// Instancia global y carga automática
const componentLoader = new ComponentLoader();

// Cargar componentes cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar header - usa rutas relativas según la ubicación
    const headerPath = window.location.pathname.includes('/modelos/') 
        ? '../src/components/header.html' 
        : './src/components/header.html';
    
    componentLoader.loadComponent('header', headerPath)
        .then(() => {
            // Una vez cargado el header, marcar la página activa
            componentLoader.setActivePage();
        });
});