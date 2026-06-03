const wrapper = document.querySelector('.slides');
const title = document.getElementById('section-name');
const lead = document.getElementById('section-lead');

const sectionKey = document.body.dataset.section;
const labels = {
  inicio: 'Inicio',
  anime: 'Anime',
  series: 'Series',
  exclusivos: 'Exclusivos'
};

const leads = {
  inicio: 'Pantalla principal de novedades y recomendaciones.',
  anime: 'Colección anime con acción, fantasía y épico visual.',
  series: 'Series destacadas para maratón nocturno.',
  exclusivos: 'Producciones únicas solo en Blazar On Ready.'
};

let index = 0;

function moverSlide(next) {
  index = next;
  const max = wrapper.children.length - 1;
  if (index < 0) index = max;
  if (index > max) index = 0;
  wrapper.style.transform = `translateX(-${index * 100}%)`;
}

async function iniciar() {
  title.textContent = labels[sectionKey] || 'Sección';
  lead.textContent = leads[sectionKey] || '';

  const res = await fetch('data/mock-db.json');
  const data = await res.json();
  const items = data.sections[sectionKey] || [];

  wrapper.innerHTML = '';
  items.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'slide';
    article.innerHTML = `
      <img src="${item.image}" alt="${item.title}">
      <div class="meta">
        <h2>${item.title}</h2>
        <p>${item.description}</p>
      </div>
    `;
    wrapper.appendChild(article);
  });
}

document.getElementById('prev').addEventListener('click', () => moverSlide(index - 1));
document.getElementById('next').addEventListener('click', () => moverSlide(index + 1));

iniciar().catch(() => {
  wrapper.innerHTML = '<article class="slide"><div class="meta"><h2>Error</h2><p>No se pudieron cargar los datos de prueba.</p></div></article>';
});
