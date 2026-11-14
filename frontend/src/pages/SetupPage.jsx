/**
 * pages/SetupPage.jsx
 * Chestionar interactiv complet (Quiz) pentru Treasure Hunt Timișoara:
 * - Selecție vizuală clară pentru băutură, domeniu, hobby, mâncare, gen film, timp și distanță.
 * - Salvează sesiunea inițială (Ziua 1 din N) în localStorage și navighează la hartă.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { aiApi } from '../api/client.js';
import './SetupPage.css';

const QUESTIONS = [
  {
    id: 'drink',
    label: '☕ Ce băutură preferi în oraș?',
    options: [
      { value: 'Cafea', label: '☕ Cafea de specialitate' },
      { value: 'Ceai', label: '🍵 Ceai aromat' },
      { value: 'Suc', label: '🥤 Suc proaspăt / Limonadă' },
      { value: 'Alcool', label: '🍺 Bere craft / Vin bănățean' },
    ],
  },
  {
    id: 'domain',
    label: '🧠 Ce domeniu te atrage cel mai mult?',
    options: [
      { value: 'Artă', label: '🎨 Artă & Cultură' },
      { value: 'Istorie', label: '🏰 Istorie & Cetate' },
      { value: 'Știință', label: '🔬 Știință & Tehnologie' },
      { value: 'Natură', label: '🌿 Natură & Parcuri' },
    ],
  },
  {
    id: 'hobby',
    label: '🎯 Care este hobby-ul tău principal?',
    options: [
      { value: 'Sport', label: '🏃 Sport & Mișcare' },
      { value: 'Citit', label: '📚 Citit & Librării' },
      { value: 'Crafting', label: '✂️ Crafting & Ateliere' },
      { value: 'Filme', label: '🎬 Filme & Cinema' },
    ],
  },
  {
    id: 'food',
    label: '🍽️ Ce fel de mâncare ai alege?',
    options: [
      { value: 'Tradițional', label: '🍲 Tradițional bănățean' },
      { value: 'Sărat', label: '🍔 Street food & Sărat' },
      { value: 'Dulce', label: '🍰 Deserturi & Dulciuri' },
      { value: 'Picant', label: '🌶️ Bucătărie picantă' },
    ],
  },
  {
    id: 'movie',
    label: '🎬 Ce gen de film te descrie cel mai bine?',
    options: [
      { value: 'Comedie', label: '😄 Comedie relaxantă' },
      { value: 'Acțiune', label: '⚡ Acțiune & Aventură' },
      { value: 'Dramă', label: '🎭 Dramă profundă' },
      { value: 'Romantic', label: '🌹 Romantic & Boem' },
    ],
  },
];

const PRESET_DAYS = [1, 2, 3, 4, 5];
const PRESET_DISTANCES = [1, 2, 3, 5, 10];

export default function SetupPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [days, setDays] = useState(2);
  const [distance, setDistance] = useState(3);
  const [prefs, setPrefs] = useState({
    drink: '',
    domain: '',
    hobby: '',
    food: '',
    movie: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSelect(questionId, value) {
    setPrefs((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setError('');
  }

  function validate() {
    const unanswered = QUESTIONS.filter((q) => !prefs[q.id]);
    if (unanswered.length > 0) {
      setError(`Te rog să răspunzi la toate întrebările (mai ai ${unanswered.length} ${unanswered.length === 1 ? 'întrebare' : 'întrebări'}).`);
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const payload = {
        prefs: {
          distantaMaxima: Number(distance),
          stayDays: Number(days),
          genFilm: prefs.movie,
          tipMancare: prefs.food,
          bautura: prefs.drink,
          domenii: [prefs.domain],
          hobby: prefs.hobby,
        },
        alreadyVisited: [],
        bingoSize: 5, // 5 locații per zi pentru o progresie plăcută
      };

      const data = await aiApi.generateBingo(payload);

      if (!data || !Array.isArray(data.locations) || data.locations.length === 0) {
        throw new Error('Serverul nu a putut genera locații pentru aceste preferințe.');
      }

      // Salvează sesiunea de Treasure Hunt pe mai multe zile în localStorage
      const huntSession = {
        prefs: payload.prefs,
        totalDays: Number(days),
        currentDay: 1,
        visitedLocations: [],
        dayLocations: data.locations,
        message: data.message,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('tht_hunt_session', JSON.stringify(huntSession));

      // Navighează direct la hartă cu traseul personalizat
      navigate('/', { state: { huntSession } });
    } catch (err) {
      console.error('Eroare la generarea traseului AI:', err);
      setError(err.message || 'A apărut o problemă la conectarea cu motorul AI.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <header className="setup-header">
          {logout && (
            <button className="logout-link-btn" onClick={logout} type="button">
              Ieșire
            </button>
          )}
          <h2>🧭 Quiz: Traseul tău prin Timișoara</h2>
          <p>
            Bun venit, <span className="user-highlight">{user?.username || 'exploratorule'}</span>! Alege-ți preferințele pentru un traseu 100% personalizat.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* ── Timp & Distanță ── */}
          <section className="setup-section">
            <h3 className="section-title">⏱️ Planificarea șederii</h3>

            {/* Zile */}
            <div className="question-group has-selection">
              <div className="question-label">
                <span>Câte zile vei explora Timișoara?</span>
                <span className="selected-badge">{days} {days === 1 ? 'zi' : 'zile'}</span>
              </div>
              <div className="quick-pills">
                {PRESET_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`pill-btn ${days === d ? 'active' : ''}`}
                    onClick={() => setDays(d)}
                  >
                    {d} {d === 1 ? 'zi' : 'zile'}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="1"
                max="7"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="range-slider"
              />
            </div>

            {/* Distanță */}
            <div className="question-group has-selection">
              <div className="question-label">
                <span>Distanța maximă față de centru:</span>
                <span className="selected-badge">{distance} km</span>
              </div>
              <div className="quick-pills">
                {PRESET_DISTANCES.map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    className={`pill-btn ${distance === dist ? 'active' : ''}`}
                    onClick={() => setDistance(dist)}
                  >
                    {dist} km
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="range-slider"
              />
            </div>
          </section>

          {/* ── Întrebările Quiz-ului ── */}
          <section className="setup-section">
            <h3 className="section-title">🎲 Preferințele tale</h3>

            {QUESTIONS.map((q) => {
              const selectedValue = prefs[q.id];
              return (
                <div
                  key={q.id}
                  className={`question-group ${selectedValue ? 'has-selection' : ''}`}
                >
                  <div className="question-label">
                    <span>{q.label}</span>
                    {selectedValue && (
                      <span className="selected-badge">✓ {selectedValue}</span>
                    )}
                  </div>

                  <div className="options-row">
                    {q.options.map((opt) => {
                      const isSelected = selectedValue === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`option-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelect(q.id, opt.value)}
                        >
                          {isSelected && <span className="check-icon">✓</span>}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          {error && <div className="form-error-banner">⚠️ {error}</div>}

          <button type="submit" className="btn-generate" disabled={loading}>
            {loading ? '🤖 Se generează traseul tău AI…' : '🗺️ Generează Traseul Bingo'}
          </button>
        </form>
      </div>
    </div>
  );
}
