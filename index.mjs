import express from 'express';
import fetch from 'node-fetch';

const planets = (await import('npm-solarsystem')).default;

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Local test keys for tonight.
// Swap to process.env before Render/public repo.
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
const NASA_API_KEY = process.env.NASA_API_KEY || '';


// Main planet getters for the single /planetInfo route.
const PLANET_GETTERS = {
  mercury: planets.getMercury,
  venus: planets.getVenus,
  earth: planets.getEarth,
  mars: planets.getMars,
  jupiter: planets.getJupiter,
  saturn: planets.getSaturn,
  uranus: planets.getUranus,
  neptune: planets.getNeptune
};

// Small-body getters handled separately.
const SMALL_BODY_GETTERS = {
  asteroids: planets.getAsteroids,
  comets: planets.getComets
};

// Local fallback images stored in public/images.
const LOCAL_IMAGE_FALLBACKS = {
  home: '/images/home-fallback.png',
  mars: '/images/mars-fallback.png',
  jupiter: '/images/jupiter-fallback.png',
  uranus: '/images/uranus-fallback.png',
  asteroids: '/images/asteroids-fallback.png',
  comets: '/images/comets-fallback.png'
};

// Emergency fallback if APOD fails.
const NASA_POD_FALLBACK = {
  title: 'Fallback: NASA Picture of the Day',
  date: 'March 11',
  explanation:
    'Fallback image used because the current NASA Picture of the Day could not be retrieved.',
  url: 'https://apod.nasa.gov/apod/image/2403/M16_Hubble_1080.jpg',
  media_type: 'image'
};

// Clean display label for page titles.
function toDisplayName(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// Random item picker for Pixabay results.
function pickRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

// Shared fetch + JSON helper.
// Keeps route code shorter.
async function fetchJson(url, label = 'API request') {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${label} failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`${label} error:`, error.message);
    return null;
  }
}

// Home page image:
// try Pixabay first, then local fallback.
async function getHomeImageUrl() {
  const fallbackImage = LOCAL_IMAGE_FALLBACKS.home;

  if (!PIXABAY_API_KEY) {
    return fallbackImage;
  }

  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(
    'solar system'
  )}&image_type=photo&per_page=60`;

  const data = await fetchJson(url, 'Pixabay request');
  const randomHit = pickRandomItem(data?.hits);

  return randomHit?.webformatURL || randomHit?.largeImageURL || fallbackImage;
}

// Planet data loader.
// Known broken images get forced to local fallbacks.
function getPlanetData(name) {
  if (PLANET_GETTERS[name]) {
    const rawPlanetData = PLANET_GETTERS[name]();

    if (LOCAL_IMAGE_FALLBACKS[name]) {
      return {
        ...rawPlanetData,
        image: LOCAL_IMAGE_FALLBACKS[name]
      };
    }

    return rawPlanetData;
  }

  if (SMALL_BODY_GETTERS[name]) {
    const rawSmallBodyData = SMALL_BODY_GETTERS[name]();

    return {
      description: rawSmallBodyData?.def || 'Information about this group of bodies.',
      distanceFromSun: 'Varies',
      yearLength: 'N/A',
      oneEarthDay: 'N/A',
      radius: 'N/A',
      moons: 'N/A',
      items: Array.isArray(rawSmallBodyData?.items) ? rawSmallBodyData.items : null,
      image: LOCAL_IMAGE_FALLBACKS[name] || rawSmallBodyData?.image || '',
      websiteLink: rawSmallBodyData?.link || 'https://solarsystem.nasa.gov'
    };
  }

  return null;
}

// APOD loader.
// Current image first, fallback only on failure.
async function getNasaPodResult() {
  if (!NASA_API_KEY) {
    return {
      podData: NASA_POD_FALLBACK,
      podError: 'NASA API key is missing. Showing fallback image.'
    };
  }

  const endpoint = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`;
  const podData = await fetchJson(endpoint, 'NASA APOD request');

  if (podData && podData.url && !podData.error) {
    return {
      podData,
      podError: null
    };
  }

  return {
    podData: NASA_POD_FALLBACK,
    podError: "Unable to fetch today's picture. Showing fallback image."
  };
}

// Home route.
app.get('/', async (req, res) => {
  const pixabayImageUrl = await getHomeImageUrl();
  res.render('home', { pixabayImageUrl });
});

// Shared route for planets + small bodies.
app.get('/planetInfo', (req, res) => {
  const requestedPlanet = (req.query.planet || 'Mercury').toString().trim();
  const key = requestedPlanet.toLowerCase();

  const planetData = getPlanetData(key);
  const planetName = toDisplayName(requestedPlanet);

  if (!planetData) {
    return res.status(404).render('planet', {
      planetData: null,
      planetName: null
    });
  }

  res.render('planet', {
    planetData,
    planetName
  });
});

// NASA Picture of the Day route.
app.get('/nasa', async (req, res) => {
  const { podData, podError } = await getNasaPodResult();
  res.render('pod', { podData, podError });
});

// Server start.
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});