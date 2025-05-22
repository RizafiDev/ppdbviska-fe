import { useEffect, useState } from 'react';
import axios from 'axios';

interface Queue {
  id: number;
  name: string;
  status: string;
  current_queue_id: number | null;
}

interface QueueNumber {
  id: number;
  queue_id: number;
  queue_number: string;
  status: 'menunggu' | 'dipanggil' | 'selesai' | 'batal';
  called_at: string | null;
  finished_at: string | null;
  created_at?: string;
  updated_at?: string;
}

const Monitor = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queueNumbers, setQueueNumbers] = useState<QueueNumber[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [queueRes, queueNumberRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/admin/queues'),
        axios.get('http://127.0.0.1:8000/api/admin/queue-numbers'),
      ]);

      setQueues(queueRes.data.data.filter((q: Queue) => q.status === 'melayani'));
      setQueueNumbers(queueNumberRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const setupAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    const interval = setInterval(() => {
      console.log('Auto refreshing monitor data...');
      fetchData();
    }, 5000);

    setRefreshInterval(interval);
  };

  useEffect(() => {
    fetchData();
    setupAutoRefresh();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (queues.length > 0 && selectedQueueId === null) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  const getCurrentQueue = (queueId: number) => {
    const calledQueues = queueNumbers
      .filter((q) => q.queue_id === queueId && q.status === 'dipanggil' && q.called_at)
      .sort((a, b) => new Date(b.called_at!).getTime() - new Date(a.called_at!).getTime());

    return calledQueues[0];
  };

  const getLastCreatedQueue = (queueId: number) => {
    const allQueueNumbers = queueNumbers.filter((q) => q.queue_id === queueId);
    
    const sorted = allQueueNumbers.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return b.id - a.id;
    });

    return sorted[0];
  };

  const getSisaAntrian = (queueId: number) => {
    return queueNumbers.filter(
      (q) => q.queue_id === queueId && q.status === 'menunggu'
    ).length;
  };

  const getWaitingQueues = (queueId: number) => {
    return queueNumbers
      .filter((q) => q.queue_id === queueId && q.status === 'menunggu')
      .sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return a.id - b.id;
      });
  };

  const selectedQueue = queues.find(q => q.id === selectedQueueId);
  const currentQueue = selectedQueueId ? getCurrentQueue(selectedQueueId) : null;
  const lastCreatedQueue = selectedQueueId ? getLastCreatedQueue(selectedQueueId) : null;
  const sisaAntrian = selectedQueueId ? getSisaAntrian(selectedQueueId) : 0;
  const waitingQueues = selectedQueueId ? getWaitingQueues(selectedQueueId) : [];

  return (
    <div className="min-h-screen bg-[#121214] flex items-center justify-center p-8">
      <div className="w-full max-w-6xl">
        <section className="w-full">
          <div className="flex flex-col items-center mb-8 text-center">
            <h1 className="text-4xl font-bold text-[#f39e0e] mb-2">
              SMK Negeri 6 Surakarta
            </h1>
            <p className="text-gray-200 text-lg">Monitor Antrian Sistem Penerimaan Murid Baru 2025</p>
            
            <div className="mt-6 w-full max-w-md">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <label htmlFor="queue-select" className="text-gray-200 font-medium whitespace-nowrap">
                  Pilih Tempat Layanan:
                </label>
                <select
                  id="queue-select"
                  value={selectedQueueId || ''}
                  onChange={(e) => setSelectedQueueId(Number(e.target.value))}
                  className="w-full bg-[#18181a] border border-[#27272a] rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#f39e0e] focus:border-transparent"
                >
                  <option value="">Pilih tempat layanan...</option>
                  {queues.map((queue) => (
                    <option key={queue.id} value={queue.id}>
                      {queue.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Auto refresh aktif (5 detik)</span>
              </div>
            </div>
          </div>

          {selectedQueue && (
            <div className="bg-[#18181a] border border-[#27272a] rounded-2xl overflow-hidden shadow-lg">
              <div className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-[#f39e0e]">{selectedQueue.name}</h2>
                  <div className="h-1 w-20 bg-[#f39e0e] mx-auto rounded mt-3"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-[#27272a] rounded-xl p-6 text-center shadow">
                    <p className="text-sm text-gray-400 mb-3">Nomor Antrian Saat Ini</p>
                    <div className="text-5xl font-bold text-[#f39e0e] py-4">
                      {currentQueue?.queue_number ?? '-'}
                    </div>
                  </div>

                  <div className="bg-[#27272a] rounded-xl p-6 text-center shadow">
                    <p className="text-sm text-gray-400 mb-3">Nomor Antrian Terakhir</p>
                    <div className="text-5xl font-semibold text-gray-200 py-4">
                      {lastCreatedQueue?.queue_number ?? '-'}
                    </div>
                  </div>

                  <div className="bg-[#27272a] rounded-xl p-6 text-center shadow">
                    <p className="text-sm text-gray-400 mb-3">Sisa Antrian</p>
                    <div className="text-5xl font-semibold text-gray-200 py-4">
                      {sisaAntrian}
                    </div>
                  </div>
                </div>

                {waitingQueues.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-semibold text-gray-200 mb-4 text-center">
                      Daftar Antrian Menunggu
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-2">
                      {waitingQueues.slice(0, 12).map((queue) => (
                        <div
                          key={queue.id}
                          className="bg-[#27272a] rounded-lg p-4 text-center transition hover:bg-[#333336]"
                        >
                          <p className="text-xl font-semibold text-gray-200">
                            {queue.queue_number}
                          </p>
                        </div>
                      ))}
                      {waitingQueues.length > 12 && (
                        <div className="bg-[#27272a] rounded-lg p-4 flex items-center justify-center">
                          <p className="text-sm text-gray-400">
                            +{waitingQueues.length - 12} lainnya
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-4 border-t border-[#27272a] text-center">
                  <p className="text-sm text-gray-400">
                    Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!selectedQueue && queues.length > 0 && (
            <div className="bg-[#18181a] border border-[#27272a] rounded-2xl p-8 text-center">
              <p className="text-lg text-gray-400">
                Silakan pilih tempat layanan untuk melihat informasi antrian
              </p>
            </div>
          )}

          {queues.length === 0 && (
            <div className="bg-[#18181a] border border-[#27272a] rounded-2xl p-8 text-center">
              <p className="text-lg text-gray-400">
                Tidak ada tempat layanan yang tersedia saat ini
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Monitor;