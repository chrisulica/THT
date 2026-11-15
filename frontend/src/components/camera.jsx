import { useState, useRef, useEffect } from 'react';
import './camera.css';
import { createPortal } from 'react-dom';

function loadImg(f) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(f);
  });
}

// Desenează imaginea combinată BeReal (Picture-in-Picture) pe Canvas
function createBeRealComposite(mainFile, cornerFile) {
  return new Promise((resolve, reject) => {
    Promise.all([loadImg(mainFile), loadImg(cornerFile)])
      .then(([imgMain, imgCorner]) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const ctx = canvas.getContext('2d');

        // 1. Imaginea principală pe tot ecranul
        ctx.drawImage(imgMain, 0, 0, canvas.width, canvas.height);

        // 2. Imaginea mică în colț (Picture-in-Picture stânga-sus)
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

        // Contur alb elegant
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

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas blob generation failed'));
        }, 'image/jpeg', 0.88);
      })
      .catch(reject);
  });
}

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

  // Numărătoarea inversă de 3 secunde pentru selfie
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
  }, [isSwapped, backPhoto, frontPhoto, step]);

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

  function handleDownload() {
    if (!compositeBlob) return;
    const url = URL.createObjectURL(compositeBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bereal-timisoara-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Salvare securizată: dacă nu ești la locație (în Mod Real), te oprește și arată eroarea!
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
          {busy ? 'Se procesează…' : '📸 Monument + Selfie'}
        </button>
      )}

        {step === 'countdown' &&
            createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        background: 'rgba(50, 23, 77, 0.96)',
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
                    <span style={{ fontSize: '48px', marginBottom: '16px' }}></span>
                    <h2 style={{ fontSize: '26px', margin: '0 0 10px 0', fontFamily: 'Playfair Display, serif' }}>
                        Acum urmează selfie-ul!
                    </h2>
                    <p style={{ color: '#f5f7e9', margin: '0 0 24px 0', opacity: 0.85 }}>Pregătește-te...</p>
                    <div
                        style={{
                            fontSize: '64px',
                            fontWeight: 'bold',
                            color: '#32174d',
                            background: '#9DB288',
                            width: '110px',
                            height: '110px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(157, 178, 136, 0.8)',
                        }}
                    >
                        {countdown > 0 ? countdown : '📸'}
                    </div>
                    <small style={{ marginTop: '24px', opacity: 0.8, color: '#f5f7e9' }}>
                        Atinge ecranul pentru a sări numărătoarea
                    </small>
                </div>,
                document.body
            )}

        {step === 'done' &&
            compositeUrl &&
            createPortal(
                <div className="cam-preview">
                    {/* Buton X stânga-sus */}
                    <button
                        type="button"
                        className="cam-close-btn"
                        onClick={() => setStep('idle')}
                    >
                        ✕
                    </button>

                    {/* Buton Schimbă perspectiva dreapta-sus */}
                    <button
                        type="button"
                        className="cam-swap-btn"
                        onClick={() => setIsSwapped(!isSwapped)}
                    >
                        🔄 Schimbă perspectiva
                    </button>

                    {/* Poza centrată pe mijlocul ecranului negru */}
                    <div
                        className="cam-preview-stage"
                        onClick={() => setIsSwapped(!isSwapped)}
                    >
                        <img src={compositeUrl} alt="BeReal Preview" />
                    </div>

                    {errorMsg && (
                        <div className="cam-error">⚠️ {errorMsg}</div>
                    )}

                    {/* Bara de jos cu Reia, Descarcă, Trimite */}
                    <div className="cam-actions">
                        <button
                            type="button"
                            className="cam-btn cam-retake"
                            onClick={startBeReal}
                            disabled={busy}
                        >
                            Reia
                        </button>
                        <button
                            type="button"
                            className="cam-btn cam-download"
                            onClick={handleDownload}
                            disabled={busy}
                        >
                            📥 Descarcă
                        </button>
                        <button
                            type="button"
                            className="cam-btn cam-send"
                            onClick={handleSend}
                            disabled={busy}
                        >
                            {busy ? 'Se verifică…' : 'Trimite'}
                        </button>
                    </div>
                </div>,
                document.body
            )}
    </>
  );
}