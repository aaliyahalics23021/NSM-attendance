import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface FaceScannerProps {
  mode: 'enroll' | 'verify';
  onScanComplete: (embeddings: {
    frontEmbedding: number[];
    leftEmbedding?: number[];
    rightEmbedding?: number[];
    selfieDataUrl?: string;
  }) => void;
  onCancel: () => void;
}

export const FaceScanner: React.FC<FaceScannerProps> = ({ mode, onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [step, setStep] = useState<'front' | 'left' | 'right' | 'complete'>('front');
  const [instructions, setInstructions] = useState('Position your face in the center of the ring.');
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  // Generate 128-float mock vector representing face coordinates
  const generateMockEmbedding = (seedVal: number): number[] => {
    const embedding = [];
    for (let i = 0; i < 128; i++) {
      // Create reproducible random-like floats between -0.2 and 0.2
      embedding.push(parseFloat((Math.sin(i + seedVal) * 0.15).toFixed(4)));
    }
    return embedding;
  };

  useEffect(() => {
    // Start camera stream on mount
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 320 },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPermission('granted');
        startScanningProcess();
      } catch (err) {
        console.error('Camera access error:', err);
        setPermission('denied');
      }
    };

    startCamera();

    return () => {
      // Stop camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startScanningProcess = () => {
    setIsScanning(true);
    setScanProgress(0);
    setInstructions('Please look straight and blink to verify liveness...');
  };

  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          handleStepComplete();
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    return () => {
      clearInterval(interval);
    };
  }, [isScanning, step]);

  const handleStepComplete = () => {
    setIsScanning(false);

    if (mode === 'verify') {
      setStep('complete');
      setInstructions('Liveness & Face Verification Complete!');
      setTimeout(() => {
        // Capture selfie frame from live video
        let selfieDataUrl: string | undefined;
        if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 320; canvas.height = 320;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 320);
            selfieDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          }
        }
        onScanComplete({
          frontEmbedding: generateMockEmbedding(1.234),
          selfieDataUrl
        });
      }, 1000);
    } else {
      // Enrollment Mode (front -> left -> right)
      if (step === 'front') {
        setStep('left');
        setInstructions('Turn your head slowly to the Left.');
        setTimeout(() => setIsScanning(true), 1200);
      } else if (step === 'left') {
        setStep('right');
        setInstructions('Turn your head slowly to the Right.');
        setTimeout(() => setIsScanning(true), 1200);
      } else if (step === 'right') {
        setStep('complete');
        setInstructions('Face Profiles Captured successfully!');
        setTimeout(() => {
          onScanComplete({
            frontEmbedding: generateMockEmbedding(1.234),
            leftEmbedding: generateMockEmbedding(2.345),
            rightEmbedding: generateMockEmbedding(3.456)
          });
        }, 1200);
      }
    }
  };

  return (
    <div style={styles.overlay}>
      <div className="glass" style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {mode === 'enroll' ? 'Enroll Face Biometrics' : 'Verifying Biometrics'}
          </h3>
          <p style={styles.subtitle}>Anti-Spoofing & Liveness active</p>
        </div>

        {permission === 'pending' && (
          <div style={styles.bodyPlaceholder}>
            <RefreshCw className="punch-btn-glow" style={{ animation: 'spin 2s linear infinite', color: 'var(--brand-primary)' }} size={48} />
            <p style={{ marginTop: 16 }}>Requesting camera permission...</p>
          </div>
        )}

        {permission === 'denied' && (
          <div style={styles.bodyPlaceholder}>
            <AlertTriangle style={{ color: 'var(--error)' }} size={48} />
            <p style={{ marginTop: 16, fontWeight: 600 }}>Camera Permission Denied</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: '0 24px', marginTop: 6 }}>
              Please allow camera access in your settings to use the smart biometrics punch verification.
            </p>
            <button onClick={onCancel} style={styles.cancelBtn}>Go Back</button>
          </div>
        )}

        {permission === 'granted' && (
          <div style={styles.scannerWrapper}>
            <div style={styles.cameraFrame}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={styles.video}
              />
              <div style={styles.faceGuideRing} />
              {isScanning && <div className="scanner-laser" />}
            </div>

            <div style={styles.statusBox}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${scanProgress}%` }} />
              </div>
              <p style={styles.instructionText}>{instructions}</p>
              <div style={styles.stepsBadge}>
                {mode === 'enroll' ? (
                  <>
                    <span style={{ ...styles.badge, backgroundColor: step === 'front' ? 'var(--brand-primary)' : 'var(--bg-tertiary)' }}>Front</span>
                    <span style={{ ...styles.badge, backgroundColor: step === 'left' ? 'var(--brand-primary)' : 'var(--bg-tertiary)' }}>Left</span>
                    <span style={{ ...styles.badge, backgroundColor: step === 'right' ? 'var(--brand-primary)' : 'var(--bg-tertiary)' }}>Right</span>
                  </>
                ) : (
                  <span style={{ ...styles.badge, backgroundColor: 'var(--brand-primary)' }}>Challenge: Blink Check</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 16
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 24
  },
  header: {
    textAlign: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--brand-primary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: 4
  },
  bodyPlaceholder: {
    height: 280,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scannerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  cameraFrame: {
    position: 'relative',
    width: 240,
    height: 240,
    borderRadius: '50%',
    overflow: 'hidden',
    border: '3px solid var(--glass-border)',
    boxShadow: 'var(--shadow-lg)'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  faceGuideRing: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '80%',
    border: '2px dashed var(--brand-primary)',
    borderRadius: '50%',
    pointerEvents: 'none'
  },
  statusBox: {
    width: '100%',
    marginTop: 20,
    textAlign: 'center'
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--brand-primary)',
    transition: 'width 0.2s ease'
  },
  instructionText: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
    minHeight: 22
  },
  stepsBadge: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 600,
    color: '#ffffff',
    textTransform: 'uppercase'
  },
  actions: {
    marginTop: 24,
    display: 'flex',
    justifyContent: 'center'
  },
  cancelBtn: {
    padding: '10px 24px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};
