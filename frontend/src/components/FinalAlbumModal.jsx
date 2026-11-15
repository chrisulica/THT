import { useState, useMemo } from 'react';
import './FinalAlbumModal.css';

const THEMATIC_MESSAGES = [
  'Ești un adevărat timișorean! Ai explorat inima Banatului!',
  'Ai cucerit Timișoara pas cu pas! O aventură de neuitat!',
  'Explorer oficial al orașului de pe Bega! Felicitări!',
  'Legenda Cetății: Ai descoperit toate comorile Timișoarei!',
  'Spiritul Timișoarei trăiește în tine! BINGO complet!',
  'Aventură completă! Orașul premierelor nu mai are secrete pentru tine!',
];

const TILT_CLASSES = [
  'tilt-neg-2',
  'tilt-pos-2',
  'tilt-neg-1',
  'tilt-pos-1',
  'tilt-neg-2',
  'tilt-pos-2',
];

export default function FinalAlbumModal({ places = [], photos = [], onReset, onClose }) {
  const [downloading, setDownloading] = useState(false);

  // Mesaj de felicitare generat aleatoriu la deschidere
  const [congratulationMessage] = useState(() => {
    const idx = Math.floor(Math.random() * THEMATIC_MESSAGES.length);
    return THEMATIC_MESSAGES[idx];
  });

  // Asociază fiecărui loc din cele 6 poza corespunzătoare
  const items = useMemo(() => {
    return places.slice(0, 6).map((place, index) => {
      // Caută poza după nume sau id
      const matchedPhoto = photos.find(
        (ph) =>
          ph.location === place.name ||
          ph.locationId === place.id ||
          ph.locationId === place.location_id
      );

      return {
        ...place,
        photoSrc: matchedPhoto?.src || null,
        tiltClass: TILT_CLASSES[index % TILT_CLASSES.length],
      };
    });
  }, [places, photos]);

  // Funcție de descărcare a întregului poster colaj 2x3 desenat pe Canvas
  async function handleDownloadPoster() {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1750;
      const ctx = canvas.getContext('2d');

      // 1. Fundal crem deschis (#f5f7e9)
      ctx.fillStyle = '#f5f7e9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bordură decorativă
      ctx.strokeStyle = '#9DB288';
      ctx.lineWidth = 6;
      ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

      ctx.strokeStyle = '#32174d';
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);

      // 2. Header
      ctx.textAlign = 'center';

      // Subtitlu
      ctx.font = '600 20px "Source Sans 3", sans-serif';
      ctx.fillStyle = '#8A2BE2';
      ctx.letterSpacing = '6px';
      ctx.fillText('ALBUMUL TĂU DE CĂLĂTORIE', canvas.width / 2, 95);

      // Resetăm letterSpacing la 0px pentru restul textelor!
      ctx.letterSpacing = '0px';

      // Titlu principal
      ctx.font = '800 68px "Playfair Display", Georgia, serif';
      ctx.fillStyle = '#32174d';
      ctx.fillText('TIMIȘOARA', canvas.width / 2, 175);

      // Mesaj de felicitare aleatoriu (cu încadrare automată în interiorul chenarului)
      ctx.font = 'italic 500 23px "Playfair Display", Georgia, serif';
      ctx.fillStyle = '#32174d';
      const fullMsg = `„${congratulationMessage}”`;
      const maxMsgWidth = canvas.width - 140; // Lasă margine sigură față de bordură

      if (ctx.measureText(fullMsg).width <= maxMsgWidth) {
        ctx.fillText(fullMsg, canvas.width / 2, 222, maxMsgWidth);
      } else {
        // Împarte mesajul pe 2 rânduri echilibrate dacă este prea lung
        const words = fullMsg.split(' ');
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        ctx.fillText(line1, canvas.width / 2, 214, maxMsgWidth);
        ctx.fillText(line2, canvas.width / 2, 242, maxMsgWidth);
      }

      // 3. Grid 2 coloane x 3 linii pentru cele 6 Polaroid-uri
      const cols = 2;
      const startX = 120;
      const startY = 270;
      const colWidth = 460;
      const rowHeight = 440;
      const cardW = 420;
      const cardH = 390;

      // Unghiuri de rotire ușoară pentru efectul de colaj foto
      const angles = [-0.025, 0.025, -0.015, 0.02, -0.02, 0.015];

      // Încărcare imagini
      const loadedImages = await Promise.all(
        items.map((item) => {
          if (!item.photoSrc) return Promise.resolve(null);
          return new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = item.photoSrc;
          });
        })
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const img = loadedImages[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        const cx = startX + col * colWidth + cardW / 2;
        const cy = startY + row * rowHeight + cardH / 2;
        const angle = angles[i % angles.length];

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Umbră Polaroid
        ctx.shadowColor = 'rgba(50, 23, 77, 0.15)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 8;

        // Card alb Polaroid
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

        // Reset umbră pentru desenarea conținutului interior
        ctx.shadowColor = 'transparent';

        // Bordură fină card
        ctx.strokeStyle = '#e6e9dc';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

        // Zona pozei
        const photoMargin = 16;
        const photoW = cardW - photoMargin * 2;
        const photoH = cardH - 85;
        const photoX = -cardW / 2 + photoMargin;
        const photoY = -cardH / 2 + photoMargin;

        if (img) {
          ctx.drawImage(img, photoX, photoY, photoW, photoH);
        } else {
          // Placeholder dacă nu a fost capturată poza
          ctx.fillStyle = '#f0f3e8';
          ctx.fillRect(photoX, photoY, photoW, photoH);

          ctx.font = '64px "Source Sans 3", sans-serif';
          ctx.fillStyle = '#32174d';
          ctx.fillText(item.icon || '🏛️', 0, -cardH / 2 + photoMargin + photoH / 2 + 10);
        }

        // Numele locației sub poză, centrat și încadrat perfect
        ctx.font = '700 22px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#32174d';
        ctx.textAlign = 'center';

        let nameText = item.name;
        if (ctx.measureText(nameText).width > photoW - 10) {
          while (nameText.length > 3 && ctx.measureText(nameText + '…').width > photoW - 10) {
            nameText = nameText.slice(0, -1);
          }
          nameText += '…';
        }
        ctx.fillText(nameText, 0, cardH / 2 - 25);

        ctx.restore();
      }

      // 4. Footer poster
      ctx.textAlign = 'center';
      ctx.font = '600 16px "Source Sans 3", sans-serif';
      ctx.fillStyle = '#8A2BE2';
      ctx.fillText(
        `🗺️ Treasure Hunt Timișoara • Bingo Festiv • ${new Date().toLocaleDateString('ro-RO')}`,
        canvas.width / 2,
        canvas.height - 45
      );

      // 5. Descărcare automată a imaginii
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `album-timisoara-poster-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (err) {
      console.error('Eroare la generarea posterului:', err);
      alert('A apărut o problemă la generarea posterului.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="album-overlay">
      <div className="album-modal">
        {/* Buton închidere */}
        {onClose && (
          <button className="album-close-btn" onClick={onClose} type="button" title="Închide albumul">
            ✕
          </button>
        )}

        {/* Header Album */}
        <header className="album-header">
          <span className="album-badge">🎉 BINGO COMPLET! 🎉</span>
          <p className="album-kicker">Albumul Tău de Călătorie</p>
          <h1 className="album-city-title">TIMIȘOARA</h1>
          <p className="album-random-msg">„{congratulationMessage}”</p>
        </header>

        {/* Grid 2 coloane × 3 linii cu cadre tip Polaroid */}
        <div className="polaroid-grid">
          {items.map((item, idx) => (
            <div key={item.id || idx} className={`polaroid-card ${item.tiltClass}`}>
              <div className="polaroid-photo-box">
                {item.photoSrc ? (
                  <img src={item.photoSrc} alt={item.name} className="polaroid-img" />
                ) : (
                  <div className="polaroid-placeholder">
                    <span className="polaroid-icon">{item.icon || '🏛️'}</span>
                    <small>Obiectiv explorat</small>
                  </div>
                )}
              </div>
              <div className="polaroid-caption">
                <span className="caption-text" title={item.name}>
                  {item.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Butoane de Acțiune */}
        <footer className="album-footer">
          <button
            type="button"
            className="album-btn-download"
            onClick={handleDownloadPoster}
            disabled={downloading}
          >
            {downloading ? '⏳ Se generează posterul…' : '📥 Descarcă Albumul Poster'}
          </button>

          <button
            type="button"
            className="album-btn-reset"
            onClick={onReset}
          >
            🔄 Resetează Sesiunea
          </button>
        </footer>
      </div>
    </div>
  );
}
