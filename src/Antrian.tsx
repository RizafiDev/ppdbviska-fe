import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { pngBase64ToEscposRaster } from './utils/escposImage';

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

const Antrian = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queueNumbers, setQueueNumbers] = useState<QueueNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [countdowns, setCountdowns] = useState<{[key: number]: number}>({});
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState({
    date: '',
    time: ''
  });

  // Memoize API endpoints
  const API_ENDPOINTS = useMemo(() => ({
    queues: 'http://127.0.0.1:8000/api/admin/queues',
    queueNumbers: 'http://127.0.0.1:8000/api/admin/queue-numbers'
  }), []);

  // Update date and time every second
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        time: now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      });
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  // Memoized fetch data function
  const fetchData = useCallback(async () => {
    try {
      const [queueRes, queueNumberRes] = await Promise.all([
        axios.get(API_ENDPOINTS.queues),
        axios.get(API_ENDPOINTS.queueNumbers),
      ]);

      setQueues(queueRes.data.data.filter((q: Queue) => q.status === 'melayani'));
      setQueueNumbers(queueNumberRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (!isProcessingQueue) {
        console.log('Gagal memuat data antrian saat auto refresh');
      }
    }
  }, [API_ENDPOINTS, isProcessingQueue]);

  // Setup auto refresh
  const setupAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    const interval = setInterval(() => {
      if (!isProcessingQueue && !isPrinting && Object.keys(countdowns).length === 0) {
        console.log('Auto refreshing data...');
        fetchData();
      }
    }, 10000);

    setRefreshInterval(interval);
  }, [fetchData, isProcessingQueue, isPrinting, countdowns, refreshInterval]);

  // Pause auto refresh
  const pauseAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [refreshInterval]);

  // Resume auto refresh
  const resumeAutoRefresh = useCallback(() => {
    setupAutoRefresh();
  }, [setupAutoRefresh]);

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
    if (isProcessingQueue || isPrinting || Object.keys(countdowns).length > 0) {
      pauseAutoRefresh();
    } else {
      resumeAutoRefresh();
    }
  }, [isProcessingQueue, isPrinting, countdowns, pauseAutoRefresh, resumeAutoRefresh]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    
    Object.keys(countdowns).forEach(queueId => {
      const id = parseInt(queueId);
      if (countdowns[id] > 0) {
        const timer = setTimeout(() => {
          setCountdowns(prev => ({
            ...prev,
            [id]: prev[id] - 1
          }));
        }, 1000);
        timers.push(timer);
      } else if (countdowns[id] === 0) {
        const queue = queues.find(q => q.id === id);
        if (queue) {
          processQueue(queue);
        }
        setCountdowns(prev => {
          const newCountdowns = {...prev};
          delete newCountdowns[id];
          return newCountdowns;
        });
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [countdowns, queues]);

  const getCurrentQueue = useCallback((queueId: number) => {
    const calledQueues = queueNumbers
      .filter((q) => q.queue_id === queueId && q.status === 'dipanggil' && q.called_at)
      .sort((a, b) => new Date(b.called_at!).getTime() - new Date(a.called_at!).getTime());

    return calledQueues[0];
  }, [queueNumbers]);

  const getLastCreatedQueue = useCallback((queueId: number) => {
    const allQueueNumbers = queueNumbers.filter((q) => q.queue_id === queueId);
    
    const sorted = allQueueNumbers.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return b.id - a.id;
    });

    return sorted[0];
  }, [queueNumbers]);

  const getSisaAntrian = useCallback((queueId: number) => {
    return queueNumbers.filter(
      (q) => q.queue_id === queueId && q.status === 'menunggu'
    ).length;
  }, [queueNumbers]);

  const printQueueTicket = useCallback(async (queueNumber: string, queueName: string, qrBase64?: string) => {
    if (isPrinting) return;

    try {
      setIsPrinting(true);

      const ports = await (navigator as any).serial.getPorts();
      let port: any = null;
      const savedPortInfo = JSON.parse(localStorage.getItem('savedSerialPort') || 'null');

      if (savedPortInfo) {
        for (const availablePort of ports) {
          const info = await availablePort.getInfo();
          if (
            info.usbVendorId === savedPortInfo.usbVendorId &&
            info.usbProductId === savedPortInfo.usbProductId
          ) {
            port = availablePort;
            break;
          }
        }
      }

      if (!port) {
        try {
          port = await (navigator as any).serial.requestPort();
          const info = await port.getInfo();

          localStorage.setItem('savedSerialPort', JSON.stringify({
            usbVendorId: info.usbVendorId,
            usbProductId: info.usbProductId
          }));
        } catch (e) {
          setIsPrinting(false);
          return;
        }
      }

      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      const ESC = '\x1B';
      const GS = '\x1D';

      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const commands = [
        ESC + '@',
        ESC + 'a' + '\x01',
        ESC + 'E' + '\x01',
        ESC + '!' + '\x10',
        'SMKN 6 SURAKARTA\n',
        ESC + '!' + '\x00',
        'Antrian SPMB 2025\n',
        ESC + '!' + '\x00',
        ESC + 'E' + '\x00',
        '\n',
        ESC + 'a' + '\x00',
        ESC + 'E' + '\x01',
        `Tanggal : ${dateStr}\n`,
        `Waktu   : ${timeStr}\n`,
        `Tempat Layanan: ${queueName}\n`,
        '\n',
        ESC + '!' + '\x00',
        ESC + 'E' + '\x00',
        ESC + 'a' + '\x01',
        ESC + 'E' + '\x01',
        ESC + '!' + '\x30',
        `${queueNumber}\n`,
        ESC + '!' + '\x00',
        ESC + 'E' + '\x00',
        '\n',
        ESC + 'a' + '\x01',
        ESC + 'E' + '\x01',
        'Silakan tunggu hingga\n',
        'nomor Anda dipanggil\n',
        '\n',
        'Terima kasih atas\nkepercayaan anda\n',
        '\n',
        'Follow Us @smkn6solo\n',
        '\n'
      ];

      const fullCommandBuffer = encoder.encode(commands.join(''));
      await writer.write(fullCommandBuffer);

      if (qrBase64) {
        const qrRaster = await pngBase64ToEscposRaster(qrBase64);
        await writer.write(qrRaster);
        await writer.write(encoder.encode('\n'));
        await writer.write(encoder.encode('SCAN QR UNTUK'));
        await writer.write(encoder.encode('\n'));
        await writer.write(encoder.encode('CEK STATUS ANTRIAN'));
        await writer.write(encoder.encode('\n\n\n\n'));
      }

      await writer.write(encoder.encode(GS + 'V' + '\x00'));
      writer.releaseLock();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await port.close();
    } catch (err) {
      console.error('Printer Error:', err);
      toast.error(`Gagal mencetak: ${(err as Error).message || 'Unknown error'}`, {
        position: "top-right",
        autoClose: 5000,
      });
    } finally {
      setIsPrinting(false);
    }
  }, [isPrinting]);

  const processQueue = useCallback(async (queue: Queue) => {
    if (loading) return;

    setLoading(true);
    setIsProcessingQueue(true);

    try {
      const allQueueNumbers = queueNumbers.filter(q => q.queue_id === queue.id);
      const nextNumber = allQueueNumbers.length + 1;
      const queuePrefix = queue.name.replace(/\s+/g, '').toUpperCase();
      const newQueueNumber = `${queuePrefix}-${String(nextNumber).padStart(3, '0')}`;

      const data = {
        queue_id: queue.id,
        queue_number: newQueueNumber,
        status: 'menunggu',
        called_at: null,
        finished_at: null,
      };

      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      };

      const response = await axios.post(
        'http://127.0.0.1:8000/api/admin/queue-numbers',
        data,
        config
      );

      if (response.data.success || response.status === 200 || response.status === 201) {
        const qrBase64 = response.data.data?.qr_code?.base64;
        await printQueueTicket(newQueueNumber, queue.name, qrBase64);

        toast.success(`Antrian ${newQueueNumber} berhasil dibuat!`, {
          position: "top-right",
          autoClose: 5000,
        });

        const queueNumberRes = await axios.get(API_ENDPOINTS.queueNumbers);
        setQueueNumbers(queueNumberRes.data.data);
      } else {
        toast.error('Gagal membuat antrian: ' + (response.data.message || 'Unknown error'), {
          position: "top-right",
          autoClose: 5000,
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const errorMessage = error.response.data.message ||
            error.response.data.error ||
            `HTTP ${error.response.status}`;
          toast.error(`Gagal membuat antrian: ${errorMessage}`, {
            position: "top-right",
            autoClose: 5000,
          });
        } else if (error.request) {
          toast.error('Gagal membuat antrian: Tidak ada respons dari server', {
            position: "top-right",
            autoClose: 5000,
          });
        } else {
          toast.error(`Gagal membuat antrian: ${error.message}`, {
            position: "top-right",
            autoClose: 5000,
          });
        }
      } else {
        toast.error('Gagal membuat antrian: Unknown error', {
          position: "top-right",
          autoClose: 5000,
        });
      }
    } finally {
      setLoading(false);
      setIsProcessingQueue(false);
    }
  }, [loading, queueNumbers, printQueueTicket, API_ENDPOINTS.queueNumbers]);

  const handleCardClick = useCallback((queue: Queue) => {
    if (loading) return;

    setCountdowns(prev => ({
      ...prev,
      [queue.id]: 3
    }));

    const toastId = toast.info(
      <div>
        <div>Antrian untuk {queue.name} akan diproses dalam...</div>
        <div className="text-center text-2xl font-bold my-2">{3}</div>
        <button 
          className="mt-2 px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => {
            setCountdowns(prev => {
              const newCountdowns = {...prev};
              delete newCountdowns[queue.id];
              return newCountdowns;
            });
            toast.dismiss(toastId);
            toast.warning('Pembuatan antrian dibatalkan', {
              position: "top-right",
              autoClose: 3000,
            });
          }}
        >
          Batalkan
        </button>
      </div>, 
      {
        position: "top-right",
        autoClose: false,
        closeButton: false,
        draggable: false,
        closeOnClick: false,
      }
    );

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        toast.update(toastId, {
          render: (
            <div>
              <div className='font-medium'>Antrian untuk {queue.name} akan diproses dalam : <span className='font-semibold'>{count}</span></div>
              <button 
                className="mt-2 px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => {
                  clearInterval(interval);
                  setCountdowns(prev => {
                    const newCountdowns = {...prev};
                    delete newCountdowns[queue.id];
                    return newCountdowns;
                  });
                  toast.dismiss(toastId);
                  toast.warning('Pembuatan antrian dibatalkan', {
                    position: "top-right",
                    autoClose: 3000,
                  });
                }}
              >
                Batalkan
              </button>
            </div>
          )
        });
      } else {
        clearInterval(interval);
        toast.dismiss(toastId);
      }
    }, 1000);
  }, [loading]);

  return (
    <div className="container px-12 flex py-10 w-full">
      <div className="filament-widgets-widget w-full">
        <section className="filament-section w-full">
          <div className="pb-2 pt-4 px-6 flex flex-col items-start gap-2">
            <div className="w-full flex justify-between items-center">
              <div>
                <h2 className="text-4xl font-bold text-[#f39e0e]">
                  SMK Negeri 6 Surakarta
                </h2>
                <p className='text-gray-200 font-medium text-lg'>Antrian Sistem Penerimaan Murid Baru 2025</p>
              </div>
              <div className="text-right">
                <p className="text-gray-200 font-medium">{currentDateTime.date}</p>
                <p className="text-gray-200 font-medium">{currentDateTime.time}</p>
              </div>
            </div>
            {/* Indicator auto refresh status */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className={`w-2 h-2 rounded-full ${
                isProcessingQueue || isPrinting || Object.keys(countdowns).length > 0 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
              }`}></div>
              <span>
                {isProcessingQueue || isPrinting || Object.keys(countdowns).length > 0 
                  ? 'Auto refresh ditunda' 
                  : 'Auto refresh aktif (10s)'}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 px-6 pb-6 pt-6 w-full">
            {queues.map((queue) => {
              const currentQueue = getCurrentQueue(queue.id);
              const lastCreatedQueue = getLastCreatedQueue(queue.id);

              return (
                <div
                  key={queue.id}
                  onClick={() => handleCardClick(queue)}
                  className="bg-[#18181a] border border-[#27272a] rounded-2xl text-gray-200 transition-shadow duration-200 cursor-pointer"
                >
                  <div className="space-y-3 p-8">
                    <h3 className="text-2xl font-bold text-[#f39e0e]">{queue.name}</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">
                          Nomor Antrian Saat Ini
                        </p>
                        <p className="text-3xl font-bold text-gray-200">
                          {currentQueue?.queue_number ?? '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400 ">
                          Nomor Antrian Terakhir
                        </p>
                        <p className="text-2xl font-semibold text-gray-200 ">
                          {lastCreatedQueue?.queue_number ?? '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400 ">Sisa Antrian</p>
                        <p className="text-2xl font-semibold text-gray-200">
                          {getSisaAntrian(queue.id)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <ToastContainer />
    </div>
  );
}

export default Antrian;