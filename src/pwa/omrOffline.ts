export interface OmrOfflineStatus {
  ready: boolean;
  completed?: number;
  total?: number;
  error?: string;
}

function activeWorker(): Promise<ServiceWorker> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('La preparación sin conexión requiere la versión web instalada.');
  }
  return navigator.serviceWorker.getRegistration('./sw.js').then((registration) => {
    const worker = registration?.active;
    if (!worker)
      throw new Error('Espera a que termine la instalación de la aplicación y vuelve a intentar.');
    return worker;
  });
}

async function askWorker(
  type: 'OMR_STATUS' | 'OMR_PREPARE',
  onProgress?: (status: OmrOfflineStatus) => void
): Promise<OmrOfflineStatus> {
  const worker = await activeWorker();
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('La preparación OMR no respondió. Vuelve a intentar.'));
    }, 180_000);
    channel.port1.onmessage = ({ data }: MessageEvent<OmrOfflineStatus>) => {
      onProgress?.(data);
      if (data.error || data.ready !== undefined) {
        clearTimeout(timer);
        channel.port1.close();
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      }
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

export const getOmrOfflineStatus = () => askWorker('OMR_STATUS');
export const prepareOmrOffline = (onProgress?: (status: OmrOfflineStatus) => void) =>
  askWorker('OMR_PREPARE', onProgress);
