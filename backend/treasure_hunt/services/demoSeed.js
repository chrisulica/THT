/**
 * Serviciu pentru inițializarea datelor demo (seed) pentru prezentare.
 * Se activează automat DOAR când DEMO_MODE=true în fișierul .env.
 */

export function seedDemoDataIfEnabled(userStore, allLocations) {
  if (process.env.DEMO_MODE !== 'true') {
    return;
  }

  const userId = 'demo_user';

  // Răspunsurile la quiz pentru utilizatorul demo
  const quizAnswers = {
    stayDays: 3,
    zile_ramase: 3,
    distanta_max_km: 5,
    maxDistance: 5,
    userLat: 45.7538,
    userLng: 21.2257,
    lat: 45.7538,
    lng: 21.2257,
    film: 'comedie',
    favoriteMovie: 'comedie',
    mancare: 'traditional',
    favoriteFood: 'traditional',
    bautura: 'cafea',
    favoriteDrink: 'cafea',
    alegere: 'istorie',
    category: 'istorie',
    hobby: 'citit'
  };

  // Helper pentru a extrage detalii complete ale unei locații din lista de locații
  const findLoc = (id) => allLocations.find(l => l.id === id) || {
    id,
    nume: id,
    descriere: '',
    lat: 45.7538,
    lng: 21.2257,
    categorie: 'istorie',
    taguri: []
  };

  // 1. Cardul anterior (terminat / finalizat în istoric)
  const previousLocationsIds = [
    'bastionul_theresia',
    'opera_nationala',
    'castelul_huniade',
    'muzeul_satului_banatean',
    'fabrica_de_bere',
    'biserica_millennium',
    'piata_libertatii',
    'sinagoga_din_cetate',
    'muzeul_consumatorului_comunist'
  ];

  const completedCard = {
    bingoId: 'bingo_demo_completed',
    userId,
    dayNumber: 0, // Călătoria anterioară completată
    totalDays: 3,
    createdAt: '2026-11-13T10:00:00.000Z',
    completed: true,
    completedAt: '2026-11-13T18:30:00.000Z',
    albumPhoto: 'https://images.unsplash.com/photo-1584448141569-69f342da535c?auto=format&fit=crop&w=1200&q=80',
    completionMessage: 'Felicitări! Ești un adevărat timișorean! Ai descoperit cu succes cele 9 comori din turul anterior!',
    locations: previousLocationsIds.map((id, index) => {
      const loc = findLoc(id);
      return {
        id: loc.id,
        location_id: loc.id,
        locationId: loc.id,
        name: loc.nume,
        description: loc.descriere,
        lat: loc.lat,
        lng: loc.lng,
        category: loc.categorie,
        tags: loc.taguri,
        distanceKm: 0.8 + index * 0.2,
        visited: true,
        visitedAt: `2026-11-13T1${index}:00:00.000Z`,
        photoUrl: `https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=60`
      };
    })
  };

  // 2. Cardul curent (Ziua 1) - activ, cu 4 din 9 locații deja vizitate (cu poze de test)
  const activeLocationsData = [
    // 4 locații vizitate
    {
      id: 'piata_victoriei',
      visited: true,
      visitedAt: '2026-11-14T10:30:00.000Z',
      photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'piata_unirii',
      visited: true,
      visitedAt: '2026-11-14T11:45:00.000Z',
      photoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'catedrala_mitropolitana',
      visited: true,
      visitedAt: '2026-11-14T13:15:00.000Z',
      photoUrl: 'https://images.unsplash.com/photo-1548625361-195fe57871b6?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'parcul_rozelor',
      visited: true,
      visitedAt: '2026-11-14T14:40:00.000Z',
      photoUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop&q=60'
    },
    // 5 locații nevizitate (pregătite pentru testare / demonstrație)
    {
      id: 'parcul_botanic',
      visited: false,
      visitedAt: null,
      photoUrl: null
    },
    {
      id: 'muzeul_de_arta',
      visited: false,
      visitedAt: null,
      photoUrl: null
    },
    {
      id: 'iulius_gardens',
      visited: false,
      visitedAt: null,
      photoUrl: null
    },
    {
      id: 'planetariul_uvt',
      visited: false,
      visitedAt: null,
      photoUrl: null
    },
    {
      id: 'experimentarium_tm',
      visited: false,
      visitedAt: null,
      photoUrl: null
    }
  ];

  const activeCard = {
    bingoId: 'bingo_demo_activ',
    userId,
    dayNumber: 1, // Cardul pentru Ziua 1
    totalDays: 3,
    createdAt: '2026-11-14T09:00:00.000Z',
    completed: false,
    completedAt: null,
    albumPhoto: null,
    completionMessage: null,
    locations: activeLocationsData.map((item, index) => {
      const loc = findLoc(item.id);
      return {
        id: loc.id,
        location_id: loc.id,
        locationId: loc.id,
        name: loc.nume,
        description: loc.descriere,
        lat: loc.lat,
        lng: loc.lng,
        category: loc.categorie,
        tags: loc.taguri,
        distanceKm: 0.3 + index * 0.15,
        visited: item.visited,
        visitedAt: item.visitedAt,
        photoUrl: item.photoUrl
      };
    })
  };

  // Colectăm toate ID-urile locațiilor folosite
  const usedLocationIds = new Set([
    ...previousLocationsIds,
    ...activeLocationsData.map(l => l.id)
  ]);

  // Populăm userStore pentru "demo_user"
  userStore.set(userId, {
    userId,
    quizAnswers,
    usedLocationIds,
    cards: [completedCard, activeCard],
    activeCardId: activeCard.bingoId
  });

  console.log(`[Treasure Hunt] DEMO_MODE=true detectat: Seed-ul pentru "${userId}" a fost inițializat cu succes!`);
}
