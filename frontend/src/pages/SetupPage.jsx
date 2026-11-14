/**
 * pages/SetupPage.jsx
 * Preference questionnaire: time, distance, 5 preference questions.
 * Submits to backend and navigates to /main with the generated route.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { huntApi } from '../api/client.js';

const QUESTIONS = [
  {
    id: 'movie',
    label: '🎬 Filmul tău preferat',
    options: ['Comedie', 'Acțiune', 'Dramă', 'Romantic'],
  },
  {
    id: 'food',
    label: '🍽️ Tipul de mâncare preferat',
    options: ['Picant', 'Sărat', 'Dulce', 'Tradițional'],
  },
  {
    id: 'drink',
    label: '☕ Băutura preferată',
    options: ['Ceai', 'Cafea', 'Alcool', 'Suc'],
  },
  {
    id: 'domain',
    label: '🧠 Domeniu preferat',
    options: ['Știință', 'Artă', 'Istorie', 'Natură'],
  },
  {
    id: 'hobby',
    label: '🎯 Hobby-ul tău',
    options: ['Citit', 'Sport', 'Crafting', 'Filme'],
  },
];

const DEFAULT_PREFS = Object.fromEntries(QUESTIONS.map((q) => [q.id, '']));

export default function SetupPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [days, setDays]       = useState(1);
  const [distance, setDistance] = useState(2);
  const [prefs, setPrefs]     = useState(DEFAULT_PREFS);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handlePref(id, value) {
    setPrefs((prev) => ({ ...prev, [id]: value }));
  }

  function validate() {
    const unanswered = QUESTIONS.filter((q) => !prefs[q.id]);
    if (unanswered.length > 0) {
      setError(`Te rog răspunde la toate întrebările (lipsesc ${unanswered.length}).`);
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = { days, maxDistanceKm: distance, preferences: prefs };
      const data = await huntApi.generateRoute(payload);
      // Pass route data via navigation state
      navigate('/main', { state: { route: data } });
    } catch (err) {
      // Backend not ready yet → navigate with mock data
      console.warn('Backend not ready, using mock route:', err.message);
      navigate('/main', { state: { route: getMockRoute() } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-page">
      <header className="setup-header">
        <h2>🧭 Configurează-ți aventura</h2>
        <p>Bun venit, <strong>{user?.username || 'explorator'}</strong>!</p>
        <button className="link-btn logout-btn" onClick={logout}>Ieșire</button>
      </header>

      <form onSubmit={handleSubmit} className="setup-form">
        {/* Time & Distance */}
        <section className="setup-section">
          <h3>⏱️ Timp & Distanță</h3>
          <div className="slider-group">
            <label>
              Zile în Timișoara: <strong>{days}</strong>
              <input
                type="range" min="1" max="14" value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
            <label>
              Distanță maximă: <strong>{distance} km</strong>
              <input
                type="range" min="1" max="20" value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
              />
            </label>
          </div>
        </section>

        {/* Preference questions */}
        <section className="setup-section">
          <h3>🎲 Preferințele tale</h3>
          {QUESTIONS.map((q) => (
            <div key={q.id} className="question-group">
              <p className="question-label">{q.label}</p>
              <div className="options-row">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`option-chip ${prefs[q.id] === opt ? 'selected' : ''}`}
                    onClick={() => handlePref(q.id, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {error && <p className="form-error">⚠️ {error}</p>}

        <button type="submit" className="btn-primary btn-large" disabled={loading}>
          {loading ? 'Se generează...' : '🗺️ Generează Traseu'}
        </button>
      </form>
    </div>
  );
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
function getMockRoute() {
  return {
    locations: [
      { id: 1, name: 'Catedrala Mitropolitană',    description: 'Simbolul Timișoarei',           category: 'Istorie',  emoji: '⛪' },
      { id: 2, name: 'Piața Unirii',               description: 'Inima Barocului european',       category: 'Artă',     emoji: '🏛️' },
      { id: 3, name: 'Parcul Rozelor',             description: 'Oaza verde a orașului',          category: 'Natură',   emoji: '🌹' },
      { id: 4, name: 'Bastionul Maria Theresia',   description: 'Fortăreață istorică renovată',   category: 'Istorie',  emoji: '🏰' },
      { id: 5, name: 'Muzeu de Artă',              description: 'Colecție de pictură românească',  category: 'Artă',     emoji: '🖼️' },
      { id: 6, name: 'Fabrica de Cultură',         description: 'Hub creativ al orașului',        category: 'Artă',     emoji: '🎨' },
      { id: 7, name: 'Piața Victoriei',            description: 'Locul Revoluției din \'89',      category: 'Istorie',  emoji: '🌟' },
      { id: 8, name: 'Grădina Zoologică',          description: 'Oaza de natură pentru toți',    category: 'Natură',   emoji: '🦁' },
      { id: 9, name: 'Cazino',                     description: 'Clădire Art Nouveau superbă',   category: 'Artă',     emoji: '🎰' },
      { id: 10, name: 'Palatul Culturii',          description: 'Cultură și evenimente locale',  category: 'Cultură',  emoji: '🎭' },
      { id: 11, name: 'Cetatea Timișoarei',        description: 'Vestigii medievale',             category: 'Istorie',  emoji: '🏯' },
      { id: 12, name: 'Parcul Central',            description: 'Plimbare la lacul din centru',  category: 'Natură',   emoji: '🌳' },
      { id: 13, name: 'Casa Brück',                description: 'Arhitectură austro-ungară',     category: 'Artă',     emoji: '🏠' },
      { id: 14, name: 'Sinagoga Mare',             description: 'Capodoperă maurescă',           category: 'Istorie',  emoji: '✡️' },
      { id: 15, name: 'Bega Riverside',            description: 'Plimbare romantică pe Bega',    category: 'Natură',   emoji: '🌊' },
      { id: 16, name: 'Piața 700',                 description: 'Piața modernă a orașului',      category: 'Social',   emoji: '☕' },
      { id: 17, name: 'Turnul cu Apă',             description: 'Punct panoramic unic',          category: 'Știință',  emoji: '🗼' },
      { id: 18, name: 'Teatrul Național',          description: 'Teatru de operă și balet',      category: 'Artă',     emoji: '🎶' },
      { id: 19, name: 'Strada Alba Iulia',         description: 'Promenadă pietonală',           category: 'Social',   emoji: '🚶' },
      { id: 20, name: 'Universitate',              description: 'Campus universitar vibrant',     category: 'Știință',  emoji: '📚' },
      { id: 21, name: 'Biserica Sf. Ioan',         description: 'Mânăstire istorică',            category: 'Istorie',  emoji: '🕌' },
      { id: 22, name: 'Piața Libertății',          description: 'Spațiu public central',         category: 'Social',   emoji: '🗽' },
      { id: 23, name: 'Strada Mărășești',          description: 'Artă urbană și cafenele',       category: 'Artă',     emoji: '🎸' },
      { id: 24, name: 'Parcul Justiției',          description: 'Liniște în mijlocul orașului',  category: 'Natură',   emoji: '🌿' },
      { id: 25, name: 'FREE SPACE',                description: 'Fotografiază-te în Timișoara!', category: 'Special',  emoji: '⭐', free: true },
    ],
  };
}
