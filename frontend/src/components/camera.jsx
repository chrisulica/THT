import { useState, useRef, useEffect } from 'react';
import './camera.css';

export default function Camera({ onConfirm }) {
  const backInputRef = useRef(null);
  const frontInputRef = useRef(null);

  const [step, setStep] = useState('idle'); // 'idle' | 'countdown' | 'done'
  const [countdown, setCountdown] = useState(3);
  const [backPhoto, setBackPhoto] = useState(null);
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [isSwapped, setIsSwapped] = useState(false); // 🔄 false = Monument mare, true = Selfie mare

  const [compositeUrl, setCompositeUrl] = useState(null);
  const [compositeBlob, setCompositeBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    return () => {
      if (compositeUrl) URL.revokeObjectURL(compositeUrl);
    };
  }, [compositeUrl]);

  // Numărătoarea inversă de 3 secunde
  useEffect(() => {
    if (step !== 'countdown') return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      frontInputRef.current?.click();
    }
  }, [step, countdown]);

  // Regenerează poza când utilizatorul comută perspectiva
  useEffect(() => {
    if (backPhoto && frontPhoto && step === 'done') {
      const main = isSwapped ? frontPhoto : backPhoto;
      const corner = isSwapped ? backPhoto : frontPhoto;
      createBeRealComposite(main, corner).then((blob) => {
        setCompositeBlob(blob);
        setCompositeUrl(URL.createObjectURL(blob));
      });
    }
  }, [isSwapped]);

  function startBeReal() {
    setBackPhoto(null);
    setFrontPhoto(null);
    setIsSwapped(false);
    setCompositeUrl(null);
    setErrorMsg(null);
    setStep('idle');
    backInputRef.current?.click();
  }

  function handleBackPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBackPhoto(file);
    setCountdown(3);
    setStep('countdown');
  }

  async function handleFrontPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      setStep('idle');
      return;
    }

    setFrontPhoto(file);
    setBusy(true);
    setStep('idle');

    try {
      const blob = await createBeRealComposite(backPhoto, file);
      setCompositeBlob(blob);
      setCompositeUrl(URL.createObjectURL(blob));
      setStep('done');
    } catch (err) {
      console.error(err);
      alert('Eroare la procesarea pozelor.');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }

  // Desenează imaginea combinată pe Canvas
  function createBeRealComposite(mainFile, cornerFile) {
    return new Promise(async (resolve) => {
      const loadImg = (f) =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.src = URL.createObjectURL(f);
          });

      const [imgMain, imgCorner] = await Promise.all([loadImg(mainFile), loadImg(cornerFile)]);

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1440;
      const ctx = canvas.getContext('2d');

      // 1. Imaginea principală pe tot ecranul
      ctx.drawImage(imgMain, 0, 0, canvas.width, canvas.height);

      // 2. Imaginea mică în colț
      const pipW = 280;
      const pipH = 370;
      const pipX = 40;
      const pipY = 50;
      const radius = 24;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pipX + radius, pipY);
      ctx.arcTo(pipX + pipW, pipY, pipX + pipW, pipY + pipH, radius);
      ctx.arcTo(pipX + pipW, pipY + pipH, pipX, pipY + pipH, radius);
      ctx.arcTo(pipX, pipY + pipH, pipX, pipY, radius);
      ctx.arcTo(pipX, pipY, pipX + pipW, pipY, radius);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(imgCorner, pipX, pipY, pipW, pipH);
      ctx.restore();

      // Contur alb
      ctx.save();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(pipX + radius, pipY);
      ctx.arcTo(pipX + pipW, pipY, pipX + pipW, pipY + pipH, radius);
      ctx.arcTo(pipX + pipW, pipY + pipH, pipX, pipY + pipH, radius);
      ctx.arcTo(pipX, pipY + pipH, pipX, pipY, radius);
      ctx.arcTo(pipX, pipY, pipX + pipW, pipY, radius);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    });
  }

  // Salvare securizată: dacă nu ești la locație, te oprește și arată eroarea!
  async function handleSend() {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onConfirm(compositeBlob);
      setStep('idle');
    } catch (err) {
      setErrorMsg(err.message || 'Nu poți bifa: ești prea departe de locație!');
    } finally {
      setBusy(false);
    }
  }

  return (
      <>
        <input
            ref={backInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleBackPhoto}
            style={{ display: 'none' }}
        />
        <input
            ref={frontInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFrontPhoto}
            style={{ display: 'none' }}
        />

        {step === 'idle' && (
            <button className="btn-photo" onClick={startBeReal} disabled={busy}>
              {busy ? 'Se procesează…' : '📸 BeReal: Monument + Selfie'}
            </button>
        )}

        {step === 'countdown' && (
            <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 3000,
                  background: 'rgba(0,0,0,0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  textAlign: 'center',
                  padding: '20px',
                }}
                onClick={() => frontInputRef.current?.click()}
            >
              <span style={{ fontSize: '48px', marginBottom: '16px' }}>🤳</span>
              <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Acum urmează selfie-ul!</h2>
              <p style={{ color: '#ccc', margin: '0 0 24px 0' }}>Pregătește-te...</p>
              <div
                  style={{
                    fontSize: '72px',
                    fontWeight: 'bold',
                    color: '#2e9d5b',
                    background: 'white',
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 25px rgba(46,157,91,0.6)',
                  }}
              >
                {countdown > 0 ? countdown : '📸'}
              </div>
              <small style={{ marginTop: '20px', opacity: 0.7 }}>Atinge ecranul pentru a sări numărătoarea</small>
            </div>
        )}

        {step === 'done' && compositeUrl && (
            <div className="cam-preview">
              {/* Atinge imaginea pentru a comuta între camere */}
              <div style={{ position: 'relative', flex: 1, cursor: 'pointer' }} onClick={() => setIsSwapped(!isSwapped)}>
                <img src={compositeUrl} alt="BeReal Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

                {/* Buton vizual de comutare */}
                <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSwapped(!isSwapped);
                    }}
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      background: 'rgba(0,0,0,0.65)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.4)',
                      borderRadius: '20px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)'
                    }}
                >
                  🔄 Schimbă perspectiva
                </button>
              </div>

              {errorMsg && (
                  <div style={{
                    background: '#fce8e6',
                    color: '#c5221f',
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    ⚠️ {errorMsg}
                  </div>
              )}

              <div className="cam-actions">
                <button className="cam-btn cam-retake" onClick={startBeReal} disabled={busy}>
                  Reia
                </button>
                <button className="cam-btn cam-send" onClick={handleSend} disabled={busy}>
                  {busy ? 'Se verifică…' : '✓ Confirmă BeReal'}
                </button>
              </div>
            </div>
        )}
      </>
  );
}