document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (navMenu.classList.contains('active')) {
          navMenu.classList.remove('active');
        }
      }
    });
  });

  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Merci pour votre intérêt ! (Démo)');
      form.reset();
    });
  });

  window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (!header) return;
    if (window.scrollY > 50) {
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
  });
});
