import { Link } from 'react-router-dom';
function Notfound() {
  return (
<div className="h-screen flex items-center justify-center bg-white text-gray-700">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-500">404</h1>
        <p className="text-xl mt-4">Halaman tidak ditemukan</p>
        <Link
          to="/"
          className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}export default Notfound;