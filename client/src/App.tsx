import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { openDB } from 'idb';
import { useState, useEffect } from 'react';
import { useBiometrics } from './hooks/useBiometrics';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

const DB_NAME = 'freightwise_offline_db';
const STORE_NAME = 'bol_queue';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    }
  });
}

// Simulated API call with exponential backoff and timeout
async function syncPayloadToServer(payload: any, attempt = 1): Promise<void> {
    const maxAttempts = 3;
    const timeoutMs = 5000;

    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        fetch('http://localhost:3000/api/confirm-bol', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        })
        .then(res => {
            clearTimeout(id);
            if (!res.ok) throw new Error('Server error');
            resolve();
        })
        .catch(err => {
            clearTimeout(id);
            if (attempt < maxAttempts) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                setTimeout(() => {
                    syncPayloadToServer(payload, attempt + 1).then(resolve).catch(reject);
                }, delay);
            } else {
                reject(err);
            }
        });
    });
}


function Dashboard() {
  const { register, authenticate, error, isAuthenticating } = useBiometrics();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  const checkQueueSize = async () => {
    try {
      const db = await initDB();
      const count = await db.count(STORE_NAME);
      setQueueSize(count);
    } catch(e) {
      console.error(e)
    }
  };

  useEffect(() => {
    checkQueueSize();

    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncQueue = async () => {
    try {
      const db = await initDB();
      // Read items first to avoid long-running transaction inactive errors
      const items = await db.getAll(STORE_NAME);

      for (const item of items) {
         try {
             await syncPayloadToServer(item.payload);
             await db.delete(STORE_NAME, item.id);
         } catch (e) {
             console.error('Failed to sync item', item.id, e);
             break; // Stop syncing on first failure to retain order and prevent spam
         }
      }
      checkQueueSize();
    } catch (e) {
       console.error('Failed to process sync queue', e);
    }
  };

  const { data: incomingBOL, isLoading: isFetchingBOL, error: bolError } = useQuery({
    queryKey: ['bolData'],
    queryFn: async () => {
       const res = await fetch('http://localhost:3000/api/bol');
       if (!res.ok) {
           throw new Error('Network response was not ok');
       }
       return res.json();
    }
  });


  const confirmMutation = useMutation({
    mutationFn: async (payload: any) => {
       // 1. Trigger WebAuthn
       const success = await authenticate('driver1');

       if (!success) {
           throw new Error('Biometric authentication failed');
       }

       const signedPayload = {
           ...payload,
           signedAt: new Date().toISOString(),
           signature: 'verified-biometric-signature-token' // In a real app, bind the assertion here
       };

       if (isOnline) {
           // 2. Sync immediately if online
           await syncPayloadToServer(signedPayload);
       } else {
           // 3. Queue offline
           const db = await initDB();
           await db.add(STORE_NAME, { payload: signedPayload });
           checkQueueSize();
           throw new Error('OFFLINE_QUEUED');
       }
    },
    onSuccess: () => {
        alert('Bill of Lading Confirmed Successfully!');
    },
    onError: (err: Error) => {
        if (err.message === 'OFFLINE_QUEUED') {
            alert('Device is offline. Payload queued for synchronization.');
        } else {
            alert('Failed to confirm: ' + err.message);
        }
    }
  });

  return (
    <div className="dashboard">
       <header>
          <h1>FreightWise Execution Dashboard</h1>
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
          </div>
          {queueSize > 0 && <div className="queue-status">Pending Syncs: {queueSize}</div>}
       </header>

       <main>
           <section className="bol-card">
               <h2>Incoming Bill of Lading</h2>
               {isFetchingBOL && <p>Loading BOL data...</p>}
               {bolError && <p className="error-message">Error fetching BOL: {bolError.message}</p>}
               {incomingBOL && (
                 <>
                   <div className="details">
                       <p><strong>ID:</strong> {incomingBOL.id}</p>
                       <p><strong>Origin:</strong> {incomingBOL.origin}</p>
                       <p><strong>Destination:</strong> {incomingBOL.destination}</p>
                       <p><strong>Freight:</strong> {incomingBOL.freight}</p>
                       <p><strong>Weight:</strong> {incomingBOL.weight}</p>
                   </div>

                   {error && <div className="error-message">{error}</div>}

                   <button
                      className="sign-btn"
                      onClick={() => confirmMutation.mutate(incomingBOL)}
                      disabled={isAuthenticating || confirmMutation.isPending}
                   >
                       {isAuthenticating ? 'Authenticating...' : 'Sign & Confirm'}
                   </button>

                   <button
                     style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: '#ccc', cursor: 'pointer' }}
                     onClick={() => register('driver1')}
                     disabled={isAuthenticating}
                   >
                       Register Device (Demo)
                   </button>
                 </>
               )}
           </section>
       </main>
    </div>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <Dashboard />
    </PersistQueryClientProvider>
  );
}

export default App;
