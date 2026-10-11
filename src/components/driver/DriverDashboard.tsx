import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { DriverProfile, Order } from '../../types/index.js';
import { SingkawangMap } from '../SingkawangMap.js';
import { playChime } from '../../utils/audio.js';
import {
  Bike,
  Power,
  Navigation,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  Camera,
  AlertCircle,
  XCircle,
  ShieldAlert
} from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { currentUser, authFetch } = useAuth();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [offeredOrder, setOfferedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Real GPS state
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'ACQUIRING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE'>('IDLE');
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');
  const watchIdRef = useRef<number | null>(null);

  // Upload receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptUrlInput, setReceiptUrlInput] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptCost, setReceiptCost] = useState<number>(0);
  const [receiptFileError, setReceiptFileError] = useState('');

  // Fetch driver data & orders
  const fetchDriverData = async () => {
    try {
      const dRes = await authFetch('/api/drivers');
      if (dRes.ok) {
        const drivers: DriverProfile[] = await dRes.json();
        const found = drivers.find(d => d.userId === currentUser?.id) || drivers[0];
        setDriverProfile(found);

        const oRes = await authFetch('/api/orders');
        if (oRes.ok) {
          const allOrders: Order[] = await oRes.json();

          // Active order assigned to this driver
          const active = allOrders.find(
            o => o.driverId === found.id && !['SELESAI', 'DIBATALKAN'].includes(o.status)
          );
          setActiveOrder(active || null);

          // Order offered specifically to this driver
          const offered = allOrders.find(
            o => o.currentOfferDriverId === found.id && o.status === 'DITAWARKAN_KE_DRIVER'
          );
          if (offered && !offeredOrder) {
            playChime('order');
          }
          setOfferedOrder(offered || null);
        }
      }
    } catch (err) {
      console.error('Error fetching driver data', err);
    }
  };

  useEffect(() => {
    fetchDriverData();
    const interval = setInterval(fetchDriverData, 4000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Real device GPS tracking via Geolocation API
  useEffect(() => {
    if (!driverProfile?.isOnline) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('IDLE');
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('UNAVAILABLE');
      setGpsErrorMsg('Perangkat Anda tidak mendukung sensor GPS Geolocation.');
      return;
    }

    setGpsStatus('ACQUIRING');

    const updateLocationOnServer = async (lat: number, lng: number) => {
      if (!driverProfile) return;
      try {
        await authFetch(`/api/drivers/${driverProfile.id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
      } catch (err) {
        console.error('Failed pushing real GPS to backend', err);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsStatus('ACTIVE');
        setGpsCoordinates({ lat: latitude, lng: longitude });
        setGpsErrorMsg('');
        updateLocationOnServer(latitude, longitude);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('DENIED');
          setGpsErrorMsg('Izin akses GPS ditolak di browser. Aktifkan izin lokasi pada browser HP agar kurir dapat beroperasi.');
        } else {
          setGpsStatus('UNAVAILABLE');
          setGpsErrorMsg('Sinyal GPS lemah atau tidak dapat dijangkau saat ini.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [driverProfile?.isOnline, driverProfile?.id]);

  // Online / offline toggle
  const handleToggleOnline = async () => {
    if (!driverProfile) return;
    try {
      const res = await authFetch(`/api/drivers/${driverProfile.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: !driverProfile.isOnline }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDriverProfile(updated);
        playChime('notification');
      }
    } catch (err) {
      console.error('Failed toggle online', err);
    }
  };

  // Respond to incoming offer
  const handleOfferResponse = async (accepted: boolean) => {
    if (!offeredOrder) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`/api/orders/${offeredOrder.id}/driver-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });

      if (res.ok) {
        playChime(accepted ? 'order' : 'notification');
        setOfferedOrder(null);
        await fetchDriverData();
      }
    } catch (err) {
      console.error('Failed responding to offer', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update order status
  const handleUpdateOrderStatus = async (status: string, receipt?: string) => {
    if (!activeOrder) return;
    setIsLoading(true);
    try {
      const body: any = { status };
      if (receipt) body.receiptUrl = receipt;

      const res = await authFetch(`/api/orders/${activeOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        playChime(status === 'SELESAI' ? 'success' : 'order');
        setShowReceiptModal(false);
        await fetchDriverData();
      }
    } catch (err) {
      console.error('Failed updating status', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setReceiptFileError('Ukuran gambar struk maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReceiptUrlInput(String(event.target.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReceipt = async () => {
    if (!activeOrder) return;
    if (!receiptUrlInput) {
      setReceiptFileError('Silakan pilih foto struk atau ambil gambar kamera.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authFetch(`/api/orders/${activeOrder.id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptUrl: receiptUrlInput,
          notes: receiptNotes,
          totalReceiptCost: receiptCost,
        }),
      });

      if (res.ok) {
        playChime('success');
        setShowReceiptModal(false);
        setReceiptUrlInput('');
        setReceiptNotes('');
        await fetchDriverData();
      }
    } catch (err) {
      console.error('Failed uploading receipt', err);
    } finally {
      setIsLoading(false);
    }
  };

  // PENDING APPROVAL SCREEN
  if (currentUser?.approvalStatus === 'PENDING_APPROVAL') {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Pendaftaran Kurir Sedang Ditinjau</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Akun kurir <strong>{currentUser.name}</strong> ({driverProfile?.plateNumber || 'Motor Singkawang'}) sedang menunggu persetujuan resmi dari Super Admin PAYKAJASTIP.
        </p>
        <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 border border-slate-200">
          Akun yang belum disetujui tidak dapat mengaktifkan mode online atau mengambil pesanan jastip. Harap menunggu verifikasi operator.
        </div>
      </div>
    );
  }

  if (!driverProfile) {
    return <div className="p-8 text-center text-slate-500 text-sm">Memuat data portal kurir...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Driver Header Card */}
      <div className="bg-gradient-to-r from-blue-800 to-sky-700 text-white rounded-3xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl border border-white/30">
            🛵
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{driverProfile.name}</h1>
              <span className="text-xs bg-white text-blue-900 font-mono font-bold px-2 py-0.5 rounded">
                {driverProfile.plateNumber}
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              {driverProfile.motorcycleModel} • ⭐ {driverProfile.rating} ({driverProfile.totalTrips} Trip Selesai)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-blue-200">Dompet Kurir</p>
            <p className="text-lg font-black">
              Rp {(driverProfile.walletBalance || 0).toLocaleString('id-ID')}
            </p>
          </div>

          <button
            onClick={handleToggleOnline}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 ${
              driverProfile.isOnline
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            <Power className="w-4 h-4" />
            {driverProfile.isOnline ? 'ONLINE (SIAP ANTAR)' : 'OFFLINE'}
          </button>
        </div>
      </div>

      {/* REAL GPS SENSOR STATUS BAR */}
      <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
        gpsStatus === 'ACTIVE'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : gpsStatus === 'DENIED'
          ? 'bg-red-50 border-red-200 text-red-900'
          : gpsStatus === 'ACQUIRING'
          ? 'bg-blue-50 border-blue-200 text-blue-900'
          : 'bg-slate-100 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-2.5">
          <Navigation className={`w-4 h-4 shrink-0 ${gpsStatus === 'ACTIVE' ? 'animate-pulse text-emerald-600' : ''}`} />
          <div>
            <p className="font-bold">
              {gpsStatus === 'ACTIVE'
                ? `GPS Nyata Aktif: ${gpsCoordinates?.lat.toFixed(5)}, ${gpsCoordinates?.lng.toFixed(5)}`
                : gpsStatus === 'DENIED'
                ? 'Izin Akses GPS Ditolak'
                : gpsStatus === 'ACQUIRING'
                ? 'Mencari Sinyal Satelit GPS Perangkat...'
                : 'Sensor GPS Offline'}
            </p>
            {gpsErrorMsg && <p className="text-[11px] text-red-700 mt-0.5">{gpsErrorMsg}</p>}
            {gpsStatus === 'ACTIVE' && (
              <p className="text-[10px] text-emerald-700">
                Posisi riil motor Anda dikirim secara berkala ke peta pelanggan dan admin.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* INCOMING OFFER CARD (AUTO DISPATCH MECHANISM) */}
      {offeredOrder && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-3xl p-6 shadow-2xl space-y-4 animate-bounce-short">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-extrabold bg-white text-orange-900 px-3 py-1 rounded-full">
              🚨 TAWARAN ORDERAN BARU UNTUK ANDA
            </span>
            <span className="text-xs font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg">
              {offeredOrder.orderNumber}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-black">
              {offeredOrder.storeName} → {offeredOrder.deliveryAddress}
            </h2>
            <p className="text-xs text-orange-100 mt-0.5">
              Jarak Rute: ~{offeredOrder.distanceKm} km • {offeredOrder.items.length} Barang Belanjaan
            </p>
            <p className="text-sm font-extrabold text-white mt-1">
              Potensi Upah Driver: Rp {Math.round(offeredOrder.shippingFee * 0.85 + offeredOrder.jastipFee * 0.7).toLocaleString('id-ID')}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => handleOfferResponse(true)}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-white text-orange-900 font-extrabold text-xs shadow-lg hover:bg-orange-50 active:scale-95 transition"
            >
              TERIMA ORDERAN INI (AMBIL TUGAS)
            </button>
            <button
              onClick={() => handleOfferResponse(false)}
              disabled={isLoading}
              className="px-5 py-3 rounded-xl bg-black/40 hover:bg-black/60 text-white font-bold text-xs transition"
            >
              TOLAK / LEWATKAN
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE ORDER WORKFLOW */}
      {activeOrder ? (
        <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden space-y-4">
          <div className="p-5 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-600 text-white rounded">
                Tugas Berjalan Kurir
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {activeOrder.storeName} → {activeOrder.deliveryAddress}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Order: <strong>{activeOrder.orderNumber}</strong> ({activeOrder.serviceType.replace(/_/g, ' ')})
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
              {activeOrder.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Map displaying courier, store, and destination */}
          <div className="px-5">
            <SingkawangMap
              storePos={{ lat: activeOrder.storeLat, lng: activeOrder.storeLng, title: activeOrder.storeName }}
              deliveryPos={{ lat: activeOrder.deliveryLat, lng: activeOrder.deliveryLng, title: activeOrder.deliveryAddress }}
              driverPos={
                gpsCoordinates
                  ? { lat: gpsCoordinates.lat, lng: gpsCoordinates.lng, title: driverProfile.name, plate: driverProfile.plateNumber }
                  : { lat: driverProfile.currentLat, lng: driverProfile.currentLng, title: driverProfile.name, plate: driverProfile.plateNumber }
              }
              className="h-72 w-full"
              zoom={14}
            />
          </div>

          {/* Step workflow buttons */}
          <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tahapan Pelaksanaan Jastip:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleUpdateOrderStatus('DRIVER_MENUJU_LOKASI')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                  activeOrder.status === 'DRIVER_MENUJU_LOKASI'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                1. Meluncur ke Toko
              </button>

              <button
                onClick={() => handleUpdateOrderStatus('SEDANG_DIBELANJAKAN')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                  activeOrder.status === 'SEDANG_DIBELANJAKAN'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                2. Mulai Belanja
              </button>

              <button
                onClick={() => setShowReceiptModal(true)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${
                  activeOrder.driverShoppingReceiptUrl
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-blue-400 text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                {activeOrder.driverShoppingReceiptUrl ? 'Struk Diunggah ✓' : '3. Foto Struk Belanja'}
              </button>

              <button
                onClick={() => handleUpdateOrderStatus('SEDANG_DIANTAR')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                  activeOrder.status === 'SEDANG_DIANTAR'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                4. OTW ke Pelanggan
              </button>
            </div>

            {/* Complete Delivery Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  handleUpdateOrderStatus('SELESAI');
                }}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Konfirmasi Pesanan Selesai / Terkirim (+Rp {Math.round(activeOrder.shippingFee * 0.85 + activeOrder.jastipFee * 0.7).toLocaleString('id-ID')})
              </button>
            </div>
          </div>

          {/* Details & Customer Contact */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-t border-slate-100">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Daftar Barang Titipan:</h4>
              <ul className="space-y-1 list-disc pl-4 text-slate-700">
                {activeOrder.items.map((it, idx) => (
                  <li key={idx}>
                    <strong>{it.name}</strong> x{it.quantity} (Rp {(it.price * it.quantity).toLocaleString('id-ID')})
                    {it.notes && <span className="text-slate-500 italic"> — "{it.notes}"</span>}
                  </li>
                ))}
              </ul>
              {activeOrder.customerNotes && (
                <p className="mt-2 text-amber-800 bg-amber-50 p-2 rounded">
                  <strong>Pesan Pembeli:</strong> {activeOrder.customerNotes}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Kontak Pelanggan:</h4>
              <p className="text-slate-700">
                <strong>{activeOrder.customerName}</strong> ({activeOrder.customerPhone})
              </p>
              <p className="text-slate-600">Alamat: {activeOrder.deliveryAddress} ({activeOrder.deliverySubDistrict})</p>
              <div className="flex gap-2 pt-1">
                <a
                  href={`https://wa.me/62${activeOrder.customerPhone.replace(/^0/, '')}?text=Halo%20kak%20${encodeURIComponent(activeOrder.customerName)},%20saya%20kurir%20PAYKAJASTIP.`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a
                  href={`tel:${activeOrder.customerPhone}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs hover:bg-slate-200"
                >
                  <Phone className="w-3.5 h-3.5" /> Telepon
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* NO ACTIVE ORDER */
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl">
            🛵
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Tidak Ada Tugas Berjalan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {driverProfile.isOnline
              ? 'Status Anda ONLINE dengan GPS aktif. Sistem akan membunyikan notifikasi saat ada tawaran orderan jastip di Singkawang.'
              : 'Aktifkan status ONLINE di atas untuk mulai menerima tawaran orderan.'}
          </p>
        </div>
      )}

      {/* Upload Receipt Modal (Tahap 6) */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl text-slate-800 space-y-4 text-xs max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Unggah Bukti Struk Belanja dari Toko
              </h3>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {receiptFileError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{receiptFileError}</span>
              </div>
            )}

            {/* Direct Camera / File Upload */}
            <div className="p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-center space-y-2">
              <input
                type="file"
                id="receiptFileInput"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                capture="environment"
                onChange={handleReceiptFileChange}
                className="hidden"
              />
              <label
                htmlFor="receiptFileInput"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Ambil Foto Kamera / Pilih dari Galeri HP
              </label>
              <p className="text-[10px] text-slate-500">
                Mendukung kamera langsung HP Android atau file foto nota (maks 5MB)
              </p>
            </div>

            {/* Image Preview */}
            {receiptUrlInput && (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-[11px]">Foto Struk Terpilih:</span>
                  <button
                    type="button"
                    onClick={() => setReceiptUrlInput('')}
                    className="text-red-600 hover:underline text-[11px] font-bold"
                  >
                    Hapus Foto
                  </button>
                </div>
                <img
                  src={receiptUrlInput}
                  alt="Struk Belanja"
                  className="w-full max-h-48 object-contain rounded-lg border border-slate-300 bg-white"
                />
              </div>
            )}

            {/* Nominal Belanja & Catatan */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Total Nominal Pembelian di Struk (Rp):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  placeholder="Cth: 45000"
                  value={receiptCost || ''}
                  onChange={(e) => setReceiptCost(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Catatan Nota / Pembelian (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Cth: Barang lengkap sesuai pesanan, nota asli disertakan di kantong"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Sample Fallbacks for testing */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 block mb-1">Atau gunakan contoh cepat struk Singkawang:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptUrlInput('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80');
                      setReceiptFileError('');
                    }}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-left text-[10px]"
                  >
                    🧾 Nota Warung / Pasar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptUrlInput('https://images.unsplash.com/photo-1554415707-9e44667014f8?auto=format&fit=crop&w=600&q=80');
                      setReceiptFileError('');
                    }}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-left text-[10px]"
                  >
                    🧾 Struk Kasir Cetak
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={isLoading || !receiptUrlInput}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan & Lanjutkan Antar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
