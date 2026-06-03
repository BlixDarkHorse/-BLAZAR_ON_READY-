const destacados = document.getElementById('destacados');
const banners = document.getElementById('banners');

async function cargarContenido() {
  try {
    const res = await fetch('data/mock-db.json');
    const data = await res.json();

    data.banners.forEach((item) => {
      const block = document.createElement('article');
      block.className = 'banner';
      block.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <span>${item.title}</span>
      `;
      banners.appendChild(block);
    });

    const secciones = ['inicio', 'anime', 'series', 'exclusivos'];
    secciones.forEach((sec) => {
      const item = data.sections[sec][0];
      if (!item) return;
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <div class="meta">
          <h3>${item.title}</h3>
          <p>${item.description}</p>
        </div>
      `;
      destacados.appendChild(card);
    });
  } catch (error) {
    destacados.innerHTML = '<p>No se pudo cargar el contenido de prueba.</p>';
  }
}

cargarContenido();
