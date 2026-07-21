import { useState, useRef } from 'react';

export function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Esperando interacción...');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsRecording(true);
      setStatus('Escuchando voz y procesando señal en tiempo real...');

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;

      if (!canvas) return;
      const canvasCtx = canvas.getContext('2d');

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        if (canvasCtx) {
          canvasCtx.fillStyle = '#1e1e1e';
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = '#2ecc71';
          canvasCtx.beginPath();

          const sliceWidth = (canvas.width * 1.0) / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
        }
      };

      draw();
    } catch (err) {
      console.error(err);
      setStatus('Error al acceder al micrófono.');
    }
  };

  const stopAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsRecording(false);
    setStatus('Captura detenida.');

    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) {
        canvasCtx.fillStyle = '#1e1e1e';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <div style={{ maxWidth: '650px', margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
        Fase: Avance Procesamiento de Señales
      </span>
      <h1 style={{ color: '#1e293b', marginTop: '15px' }}>My Personal English Teacher</h1>
      <p style={{ color: '#64748b' }}>
        Procesamiento de Señales de Voz (Tiempo Real) & IA Client-Side
      </p>

      {/* Visualización Waveform */}
      <div style={{ margin: '25px 0' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          style={{ background: '#1e1e1e', borderRadius: '8px', width: '100%', height: '150px' }}
        />
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '25px 0' }}>
        <button
          onClick={startAudio}
          disabled={isRecording}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: isRecording ? '#cbd5e1' : '#166534', // Un verde oscuro más formal
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: isRecording ? 'not-allowed' : 'pointer',
            opacity: isRecording ? 0.7 : 1,
            transition: 'background 0.2s',
            minWidth: '200px', // Asegura el ancho
            justifyContent: 'center'
          }}
        >
          <span>🎤</span> Iniciar Micrófono
        </button>
        <button
          onClick={stopAudio}
          disabled={!isRecording}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: !isRecording ? '#cbd5e1' : '#b91c1c', // Un rojo formal
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: !isRecording ? 'not-allowed' : 'pointer',
            opacity: !isRecording ? 0.7 : 1,
            transition: 'background 0.2s',
            minWidth: '200px', // Asegura el ancho
            justifyContent: 'center'
          }}
        >
          <span>⏹️</span> Detener Micrófono
        </button>
      </div>
      {/* Estado */}
      <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px', color: '#334155', fontSize: '0.9rem' }}>
        <strong>Estado:</strong> {status}
      </div>
    </div>
  );
}

export default App;
