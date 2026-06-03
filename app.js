const featuredGrid = document.getElementById('destacados');
const bannersGrid = document.getElementById('banners');
const googleLogin = document.getElementById('google-login');
const microsoftLogin = document.getElementById('microsoft-login');

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function setErrorState(message) {
  bannersGrid.innerHTML = '';
  featuredGrid.innerHTML = '';

  const bannerError = document.createElement('p');
  bannerError.textContent = message;
  bannersGrid.appendChild(bannerError);

  const featuredError = document.createElement('p');
  featuredError.textContent = message;
  featuredGrid.appendChild(featuredError);
}

function setOAuthLinkState(anchor, url) {
  if (isSafeHttpUrl(url)) {
    anchor.href = url;
    anchor.removeAttribute('aria-disabled');
    anchor.removeAttribute('tabindex');
    anchor.classList.remove('disabled');
    return;
  }

  anchor.href = '#';
  anchor.setAttribute('aria-disabled', 'true');
  anchor.setAttribute('tabindex', '-1');
  anchor.classList.add('disabled');
}

function setOAuthUrls(oauth = {}) {
  setOAuthLinkState(googleLogin, oauth.googleAuthUrl);
  setOAuthLinkState(microsoftLogin, oauth.microsoftAuthUrl);
}

function appendBanner(item) {
  if (!isSafeHttpUrl(item?.image)) return;

  const block = document.createElement('article');
  block.className = 'banner';

  const image = document.createElement('img');
  image.src = item.image;
  image.alt = item.title || 'Banner';

  const label = document.createElement('span');
  label.textContent = item.title || 'Banner';

  block.appendChild(image);
  block.appendChild(label);
  bannersGrid.appendChild(block);
}

function appendFeaturedCard(item) {
  if (!isSafeHttpUrl(item?.image)) return;

  const card = document.createElement('article');
  card.className = 'card';

  const image = document.createElement('img');
  image.src = item.image;
  image.alt = item.title || 'Contenido';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const title = document.createElement('h3');
  title.textContent = item.title || 'Sin título';

  const description = document.createElement('p');
  description.textContent = item.description || 'Sin descripción';

  meta.appendChild(title);
  meta.appendChild(description);
  card.appendChild(image);
  card.appendChild(meta);
  featuredGrid.appendChild(card);
}

async function loadContent() {
  try {
    const response = await fetch('data/mock-db.json');
    if (!response.ok) {
      throw new Error(`No se pudo leer mock-db.json (HTTP ${response.status}).`);
    }

    const data = await response.json();
    setOAuthUrls(data.oauth);

    bannersGrid.innerHTML = '';
    featuredGrid.innerHTML = '';

    (data.banners || []).forEach(appendBanner);

    const sections = ['inicio', 'anime', 'series', 'exclusivos'];
    sections.forEach((section) => {
      const item = data.sections?.[section]?.[0];
      if (!item) return;
      appendFeaturedCard(item);
    });
  } catch (error) {
    const message = `Error cargando contenido de prueba: ${error.message}`;
    setErrorState(message);
  }
}

[googleLogin, microsoftLogin].forEach((link) => {
  link.addEventListener('click', (event) => {
    if (link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
    }
  });
});

loadContent();
