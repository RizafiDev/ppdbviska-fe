import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface QueueNumber {
  id: number;
  queue_id: number;
  queue_number: string;
  status: string;
  called_at: string | null;
  finished_at: string | null;
}

interface Queue {
  id: number;
  name: string;
  status: string;
}

const Status = () => {
  const { id } = useParams<{ id: string }>();
  const [queueNumber, setQueueNumber] = useState<QueueNumber | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const [qnRes, qRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/admin/queue-numbers'),
        fetch('http://127.0.0.1:8000/api/admin/queues')
      ]);

      const qnData = await qnRes.json();
      const qData = await qRes.json();

      const foundQN = qnData.data.find((item: QueueNumber) => item.id === parseInt(id || '0'));
      const foundQueue = foundQN ? qData.data.find((q: Queue) => q.id === foundQN.queue_id) : null;

      if (foundQN) setQueueNumber(foundQN);
      if (foundQueue) setQueue(foundQueue);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#18181a]">
      <div className="text-center text-[#f39e0e]">
        <svg className="animate-spin h-8 w-8 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-lg">Memuat data...</p>
      </div>
    </div>
  );
}

if (!queueNumber) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#18181a]">
      <div className="text-center text-red-500 text-lg">
        Data tidak ditemukan.
      </div>
    </div>
  );
}


  const getStatusColor = () => {
    switch (queueNumber.status) {
      case 'menunggu':
        return 'bg-yellow-500';
      case 'dipanggil':
        return 'bg-blue-500';
      case 'selesai':
        return 'bg-green-600';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-screen bg-[#18181a] w-full p-4 items-center justify-center my-auto flex flex-col">
      {/* Header matching Antrian.tsx */}
      <header className="pb-2 pt-4 px-6 flex flex-col items-start gap-2">
        <h2 className="text-3xl md:text-4xl font-bold text-[#f39e0e] text-center">
          SMKN 6 SURAKARTA
        </h2>
        <p className='text-gray-200 font-medium text-base text-center'>Antrian Sistem Penerimaan Murid Baru 2025</p>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-[#27272a] border border-[#3f3f46] rounded-xl shadow-lg overflow-hidden">
            {/* Card Header */}
            <div className="bg-[#3f3f46] p-4">
              <h1 className="text-xl font-bold text-gray-200 text-center">
                Status Antrian
              </h1>
            </div>
            
            {/* Card Content */}
            <div className="p-6 space-y-4 text-gray-200">
              {/* Queue Number Highlight */}
              <div className="flex flex-col items-center mb-6">
                <span className="text-gray-400 text-sm">Nomor Antrian</span>
                <span className="text-4xl font-bold text-[#f39e0e]">
                  {queueNumber.queue_number}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex justify-between border-b border-[#3f3f46] pb-3">
                  <span className="text-gray-400 font-medium">Loket / Layanan</span>
                  <span className="font-medium">{queue?.name || '-'}</span>
                </div>
                
                <div className="flex justify-between border-b border-[#3f3f46] pb-3">
                  <span className="text-gray-400 font-medium">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor()}`}>
                    {queueNumber.status.toUpperCase()}
                  </span>
                </div>
                
                {queueNumber.called_at && (
                  <div className="flex justify-between border-b border-[#3f3f46] pb-3">
                    <span className="text-gray-400 font-medium">Dipanggil</span>
                    <span>
                      {new Date(queueNumber.called_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
                
                {queueNumber.finished_at && (
                  <div className="flex justify-between border-b border-[#3f3f46] pb-3">
                    <span className="text-gray-400 font-medium">Selesai</span>
                    <span>
                      {new Date(queueNumber.finished_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer */}
            <div className="bg-[#1e1e20] px-6 py-3 text-center border-t border-[#3f3f46]">
              {loading ? (
                <div className="text-[#f39e0e] text-sm flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-4 w-4 text-[#f39e0e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Memperbarui data...</span>
                </div>
              ) : (
                <div className="text-gray-400 text-xs">
                  Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID')}
                </div>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>Silakan simpan nomor antrian Anda</p>
            <p className="mt-1">Untuk melihat status terbaru, refresh halaman ini</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Status;