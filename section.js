const wrapper = document.querySelector('.slides');
const title = document.getElementById('section-name');
const lead = document.getElementById('section-lead');
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');

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

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function moveSlide(targetIndex) {
  const total = wrapper.children.length;
  if (total === 0) return;

  let newIndex = targetIndex;
  const max = total - 1;
  if (newIndex < 0) newIndex = max;
  if (newIndex > max) newIndex = 0;
  index = newIndex;
  wrapper.style.transform = `translateX(-${index * 100}%)`;
}

function appendSlide(item) {
  if (!isSafeHttpUrl(item?.image)) return;

  const article = document.createElement('article');
  article.className = 'slide';

  const image = document.createElement('img');
  image.src = item.image;
  image.alt = item.title || 'Contenido';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const heading = document.createElement('h2');
  heading.textContent = item.title || 'Sin título';

  const description = document.createElement('p');
  description.textContent = item.description || 'Sin descripción';

  meta.appendChild(heading);
  meta.appendChild(description);
  article.appendChild(image);
  article.appendChild(meta);
  wrapper.appendChild(article);
}

async function initialize() {
  title.textContent = labels[sectionKey] || 'Sección';
  lead.textContent = leads[sectionKey] || '';

  let response;
  try {
    response = await fetch('data/mock-db.json');
  } catch (networkError) {
    throw new Error(`Fallo de red al solicitar mock-db.json: ${networkError.message}`);
  }

  if (!response.ok) {
    throw new Error(`No se pudo leer mock-db.json (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const items = data.sections?.[sectionKey] || [];

  wrapper.innerHTML = '';
  items.forEach(appendSlide);

  if (wrapper.children.length === 0) {
    throw new Error('No hay contenido disponible para esta sección.');
  }

  prevButton.addEventListener('click', () => moveSlide(index - 1));
  nextButton.addEventListener('click', () => moveSlide(index + 1));
}

initialize().catch((error) => {
  wrapper.innerHTML = '';
  const fallback = document.createElement('article');
  fallback.className = 'slide';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const heading = document.createElement('h2');
  heading.textContent = 'Error';

  const message = document.createElement('p');
  message.textContent = `Error cargando esta sección: ${error.message}`;

  meta.appendChild(heading);
  meta.appendChild(message);
  fallback.appendChild(meta);
  wrapper.appendChild(fallback);
});
