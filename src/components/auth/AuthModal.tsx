import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole } from '../../types/index.js';
import { X, Lock, Mail, Phone, User, Bike, Store, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<UserRole>('pelanggan');

  // Driver fields
  const [motorcycleModel, setMotorcycleModel] = useState('Honda Vario 160');
  const [plateNumber, setPlateNumber] = useState('KB 4521 SK');

  // Merchant fields
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState<'kuliner' | 'pasar' | 'oleholeh' | 'apotek' | 'retail'>('kuliner');

  if (!isOpen) return null;

  const handleGuestLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    const res = await continueAsGuest(name || 'Tamu Singkawang', phone || '081254001100', address || 'Singkawang Barat');
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Gagal masuk sebagai tamu.');
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (mode === 'login') {
      const res = await login(email, password);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Login gagal.');
      } else {
        onClose();
      }
    } else {
      const payload: any = {
        name,
        email,
        phone,
        password,
        role,
        address,
      };

      if (role === 'driver') {
        payload.motorcycleModel = motorcycleModel;
        payload.plateNumber = plateNumber;
      }
      if (role === 'merchant') {
        payload.storeName = storeName;
        payload.storeCategory = storeCategory;
      }

      const res = await register(payload);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Pendaftaran gagal.');
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-black">
              🔐
            </div>
            <div>
              <h2 className="text-base font-bold">
                {mode === 'login' ? 'Masuk ke PAYKAJASTIP' : 'Daftar Akun Baru'}
              </h2>
              <p className="text-xs text-blue-100">
                Pilih role akun untuk operasional di Singkawang
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50 shrink-0">
          <button
            onClick={() => { setMode('login'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-center transition ${
              mode === 'login' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-slate-500'
            }`}
          >
            Masuk Akun
          </button>
          <button
            onClick={() => { setMode('register'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-center transition ${
              mode === 'register' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-slate-500'
            }`}
          >
            Daftar Baru
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-800">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Jenis Akun (Role):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pelanggan', label: 'Pelanggan', desc: 'Langsung Aktif', icon: User },
                    { id: 'driver', label: 'Kurir Driver', desc: 'Butuh Izin Admin', icon: Bike },
                    { id: 'merchant', label: 'Mitra Toko', desc: 'Butuh Izin Admin', icon: Store },
                  ].map(r => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id as UserRole)}
                      className={`p-2.5 rounded-xl text-left border transition ${
                        role === r.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <r.icon className="w-4 h-4 mb-1 text-blue-600" />
                      <p className="font-bold text-[11px]">{r.label}</p>
                      <p className="text-[9px] text-slate-400">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rusdiana"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp/HP (Singkawang):</label>
                <input
                  type="text"
                  required
                  placeholder="081254001122"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {role === 'driver' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="font-bold text-blue-900 text-[11px]">Informasi Sepeda Motor Kurir:</p>
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-0.5">Model Kendaraan:</label>
                    <input
                      type="text"
                      required
                      placeholder="Honda Vario 160"
                      value={motorcycleModel}
                      onChange={(e) => setMotorcycleModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-0.5">Nomor Pelat Polisi Singkawang:</label>
                    <input
                      type="text"
                      required
                      placeholder="KB 4521 CW"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-amber-700">
                    ℹ️ Pendaftaran kurir berstatus "Menunggu Persetujuan Admin" sebelum dapat mulai mengambil orderan.
                  </p>
                </div>
              )}

              {role === 'merchant' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="font-bold text-blue-900 text-[11px]">Informasi Toko / Usaha:</p>
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-0.5">Nama Toko:</label>
                    <input
                      type="text"
                      required
                      placeholder="Cth: Warung Choipan Singkawang"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-0.5">Kategori Toko:</label>
                    <select
                      value={storeCategory}
                      onChange={(e) => setStoreCategory(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    >
                      <option value="kuliner">Kuliner Khas Singkawang</option>
                      <option value="pasar">Pasar Tradisional / Sayur Segar</option>
                      <option value="oleholeh">Oleh-Oleh Khas</option>
                      <option value="apotek">Apotek & Resep Obat</option>
                      <option value="retail">Supermarket & Retail</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat di Singkawang:</label>
                <input
                  type="text"
                  placeholder="Jl. Tani Gg. Sejahtera No. 18"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email:</label>
            <input
              type="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password:</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun'}
          </button>

          {/* Guest / Alternative Option */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] uppercase font-bold text-slate-400">Atau</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100/60 text-blue-700 font-bold transition flex items-center justify-center gap-2"
            >
              <span>👤 Lanjutkan sebagai Tamu (Guest)</span>
            </button>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              Tamu dapat langsung mengecek katalog toko, membuat pesanan jastip, dan memantau kurir di Singkawang tanpa kata sandi.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
