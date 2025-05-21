import { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [, setPrintStatus] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
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
        alert('Gagal memuat data antrian');
      }
    };

    fetchData();
  }, []);

  const getCurrentQueue = (queueId: number) =>
    queueNumbers.find((q) => q.queue_id === queueId && q.status === 'dipanggil');

  const getWaitingQueues = (queueId: number) =>
    queueNumbers.filter((q) => q.queue_id === queueId && q.status === 'menunggu');

  // Function untuk mendapatkan nomor antrian terakhir yang dibuat
  const getLastCreatedQueue = (queueId: number) => {
    const allQueueNumbers = queueNumbers.filter((q) => q.queue_id === queueId);
    
    // Sort berdasarkan ID (asumsi ID auto-increment) atau created_at jika tersedia
    // Atau bisa juga sort berdasarkan queue_number jika formatnya konsisten
    const sorted = allQueueNumbers.sort((a, b) => {
      // Jika ada created_at, gunakan itu
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      
      // Jika tidak ada created_at, gunakan ID
      return b.id - a.id;
    });

    return sorted[0]; // Return yang terbaru
  };

  const getSisaAntrian = (queueId: number) => {
    // Get all queue numbers for the specified queue
    const allQueueNumbers = queueNumbers.filter((q) => q.queue_id === queueId);

    // Filter out the 'dipanggil' and 'selesai' statuses
    const waitingQueueCount = allQueueNumbers.filter(
      (q) => q.status === 'menunggu'
    ).length;

    return waitingQueueCount;
  };

  const printQueueTicket = async (queueNumber: string, queueName: string) => {
    if (isPrinting) return;

    try {
      setIsPrinting(true);
      setPrintStatus('Connecting to printer...');

      // Get all available ports
      const ports = await (navigator as any).serial.getPorts();

      // Try to get the previously saved port from localStorage
      let port: any = null;
      const savedPortInfo = JSON.parse(localStorage.getItem('savedSerialPort') || 'null');

      // If we have saved port info, try to find a matching port
      if (savedPortInfo) {
        for (const availablePort of ports) {
          const info = await availablePort.getInfo();
          if (
            info.usbVendorId === savedPortInfo.usbVendorId &&
            info.usbProductId === savedPortInfo.usbProductId
          ) {
            port = availablePort;
            setPrintStatus('Found previously used printer. Connecting...');
            break;
          }
        }
      }

      // If no matching port found, ask user to select one
      if (!port) {
        try {
          setPrintStatus('Please select your printer port...');
          port = await (navigator as any).serial.requestPort();
          const info = await port.getInfo();

          // Save the selected port info for future use
          localStorage.setItem('savedSerialPort', JSON.stringify({
            usbVendorId: info.usbVendorId,
            usbProductId: info.usbProductId
          }));
        } catch (e) {
          setPrintStatus('Port selection was cancelled.');
          setIsPrinting(false);
          return;
        }
      }

      // Open the port with appropriate settings
      setPrintStatus('Opening connection to printer...');
      await port.open({ baudRate: 9600 });
      setPrintStatus('Connected to printer. Preparing to send data...');

      // Get a writer for the port
      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      // ESC/POS commands
      const ESC = '\x1B';
      const GS = '\x1D';

      // Format current date and time
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

      // Prepare print commands for queue ticket
      const commands = [
        ESC + '@',                // Initialize printer
        ESC + 'a' + '\x01',       // Center alignment
        ESC + 'E' + '\x01',       // Bold on
        ESC + '!' + '\x10',       // Double height
        'SMKN 6 SURAKARTA\n',
        ESC + '!' + '\x00',       // Normal text
        'Antrian SPMB 2025\n',
        ESC + '!' + '\x00',       // Normal text
        ESC + 'E' + '\x00',       // Bold off
        '\n',
        ESC + 'a' + '\x00',       // Left alignment
        ESC + 'E' + '\x01',       // Bold on
        `Tanggal : ${dateStr}\n`,
        `Waktu   : ${timeStr}\n`,
        `Tempat Layanan: ${queueName}\n`,
        '\n',
        ESC + '!' + '\x00',       // Normal text
        ESC + 'E' + '\x00',       // Bold off
        ESC + 'a' + '\x01',       // Center alignment
        ESC + 'E' + '\x01',       // Bold on
        ESC + '!' + '\x30',       // Double width and height
        `${queueNumber}\n`,
        ESC + '!' + '\x00',       // Normal text
        ESC + 'E' + '\x00',       // Bold off
        '\n',
        ESC + 'a' + '\x01',       // Center alignment
        ESC + 'E' + '\x01',
        'Silakan tunggu hingga\n',
        'nomor Anda dipanggil\n',
        '\n',
        'Terima kasih atas\nkepercayaan anda',
        '\n',
        'Follow Us @smkn6solo\n',
        '\n\n\n',                 // Extra line feeds for better paper cutting
        GS + 'V' + '\x00'         // Cut paper
      ];

      // Send commands
      setPrintStatus('Sending data to printer...');

      // Send all commands as a single buffer for better reliability
      const fullCommandBuffer = encoder.encode(commands.join(''));
      await writer.write(fullCommandBuffer);

      setPrintStatus('Data sent. Finalizing print job...');

      // Close properly
      writer.releaseLock();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit before closing
      await port.close();

      setPrintStatus('Tiket antrian berhasil dicetak!');
    } catch (err) {
      console.error('Printer Error:', err);
      setPrintStatus(`Print error: ${(err as Error).message || 'Unknown error'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCardClick = async (queue: Queue) => {
    if (loading) return; // Prevent multiple clicks

    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: `Apakah Anda ingin membuat antrian untuk ${queue.name}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, buat antrian!',
      cancelButtonText: 'Batal',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true);

        try {
          // Hitung total semua antrian untuk queue ini (menunggu + dipanggil + selesai)
          const allQueueNumbers = queueNumbers.filter(q => q.queue_id === queue.id);
          const nextNumber = allQueueNumbers.length + 1;

          // Generate prefix dari nama queue (hilangkan spasi dan huruf besar semua)
          const queuePrefix = queue.name.replace(/\s+/g, '').toUpperCase();

          // Generate antrian number dengan format: NAMAQUEUE-001
          const newQueueNumber = `${queuePrefix}-${String(nextNumber).padStart(3, '0')}`;

          console.log('Creating queue number:', {
            queue_id: queue.id,
            queue_number: newQueueNumber,
            existing_count: allQueueNumbers.length
          });

          // Data yang akan dikirim ke API
          const data = {
            queue_id: queue.id,
            queue_number: newQueueNumber,
            status: 'menunggu',
            called_at: null,
            finished_at: null,
          };

          // Set headers untuk API request
          const config = {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            }
          };

          // Kirim data ke API
          const response = await axios.post(
            'http://127.0.0.1:8000/api/admin/queue-numbers',
            data,
            config
          );

          console.log('API Response:', response.data);

          if (response.data.success || response.status === 200 || response.status === 201) {
            // Cetak tiket terlebih dahulu
            await printQueueTicket(newQueueNumber, queue.name);

            toast.success(`Antrian ${newQueueNumber} berhasil dibuat!`, {
              position: "top-right",
              autoClose: 5000,
            });

            // Refresh data setelah berhasil create
            const queueNumberRes = await axios.get('http://127.0.0.1:8000/api/admin/queue-numbers');
            setQueueNumbers(queueNumberRes.data.data);
          } else {
            console.error('API returned unsuccessful response:', response.data);
            toast.error('Gagal membuat antrian: ' + (response.data.message || 'Unknown error'), {
              position: "top-right",
              autoClose: 5000,
            });
          }
        } catch (error) {
          console.error('Error creating queue:', error);

          // Tampilkan error yang lebih detail
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
        }
      }
    });
  };

  return (
    <div className="container px-12 flex py-10 w-full">
      <div className="filament-widgets-widget w-full">
        <section className="filament-section w-full">
          <div className="pb-2 pt-4 px-6 flex flex-col items-start gap-2">
            <h2 className="text-4xl font-bold text-[#f39e0e]">
              SMK Negeri 6 Surakarta
            </h2>
            <p className='text-gray-200 font-medium text-lg'>Antrian Sistem Penerimaan Murid Baru 2025</p>
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