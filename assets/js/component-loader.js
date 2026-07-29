class ComponentLoader {
  constructor() {
    this.components = {};
  }

  getRoot() {
    return window.ROOT || '.';
  }

  async loadComponent(name, filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Error loading ${filePath}: ${response.status}`);
      }
      const html = await response.text();
      this.components[name] = html;

      const root = this.getRoot();
      const processed = html.replace(/\{\{ROOT\}\}/g, root);

      const elements = document.querySelectorAll(`[data-component="${name}"]`);
      elements.forEach(element => {
        element.innerHTML = processed;
        this.initializeBootstrapComponents();
      });
    } catch (error) {
      console.error(`Error loading component "${name}":`, error);
    }
  }

  initializeBootstrapComponents() {
    if (typeof bootstrap !== 'undefined') {
      document.querySelectorAll('.dropdown-toggle').forEach(dropdown => {
        new bootstrap.Dropdown(dropdown);
      });
    }
  }

  setActivePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes(currentPage)) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }
}

const componentLoader = new ComponentLoader();

document.addEventListener('DOMContentLoaded', async () => {
  const root = componentLoader.getRoot();

  await componentLoader.loadComponent('header', `${root}/components/header.html`);
  componentLoader.setActivePage();

  await componentLoader.loadComponent('footer', `${root}/components/footer.html`);
});
