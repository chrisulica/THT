import { useEffect, useRef, useState } from 'react';
import { compressImage } from './compressImage';
import './camera.css';

export default function Camera({ onConfirm }) {
  const inputRef = useRef(null);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // eliberează memoria când se schimbă / dispare poza
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function openCamera() {
    setError(null);
    inputRef.current?.click(); // direct din atingere, altfel iPhone-ul îl poate bloca
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // ca să poți alege aceeași poză din nou
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      setBlob(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch (err) {
      console.error(err);
      setError('Nu am putut procesa poza. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setBlob(null);
    setPreviewUrl(null);
    openCamera();
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(blob);
      setBlob(null);
      setPreviewUrl(null);
    } catch (err) {
      console.error(err);
      setError('Trimiterea a eșuat. Verifică internetul și încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      <button className="btn-photo" onClick={openCamera} disabled={busy}>
        {busy && !previewUrl ? 'Se procesează…' : '📸 Sunt aici, fă poza'}
      </button>
      {error && !previewUrl && <div className="cam-error">{error}</div>}

      {previewUrl && (
        <div className="cam-preview">
          <img src={previewUrl} alt="Previzualizare selfie" />
          {error && <div className="cam-error">{error}</div>}
          <div className="cam-actions">
            <button className="cam-btn cam-retake" onClick={retake} disabled={busy}>
              Reia
            </button>
            <button className="cam-btn cam-send" onClick={send} disabled={busy}>
              {busy ? 'Se trimite…' : 'Trimite'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}