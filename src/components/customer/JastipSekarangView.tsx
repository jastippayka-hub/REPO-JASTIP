import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { SingkawangMap } from '../SingkawangMap.js';
import { parseGoogleMapsInput } from '../../utils/geo.js';
import { playChime } from '../../utils/audio.js';
import {
  Order,
  OrderServiceType,
  PaymentMethod,
  StoreItem,
  MerchantProfile
} from '../../types/index.js';
import {
  ArrowLeft,
  MapPin,
  Link,
  Plus,
  Trash2,
  Bike,
  Building,
  CreditCard,
  QrCode,
  Banknote,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown
} from 'lucide-react';

interface JastipSekarangViewProps {
  onBack: () => void;
  onOrderSuccess: (order: Order) => void;
  initialMerchant?: MerchantProfile | null;
  initialItems?: { name: string; price: number; quantity: number }[];
}

export const JastipSekarangView: React.FC<JastipSekarangViewProps> = ({
  onBack,
  onOrderSuccess,
  initialMerchant,
  initialItems = [],
}) => {
  const { currentUser, authFetch } = useAuth();

  // Stores from backend
  const [merchants, setMerchants] = useState<MerchantProfile[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(initialMerchant?.id || '');

  // Form State
  const [serviceType, setServiceType] = useState<OrderServiceType>('jastip_makanan');
  const [storeName, setStoreName] = useState(initialMerchant?.storeName || '');
  const [storeAddress, setStoreAddress] = useState(initialMerchant?.address || 'Singkawang Barat');
  const [storeLat, setStoreLat] = useState(initialMerchant?.lat || 0.9080);
  const [storeLng, setStoreLng] = useState(initialMerchant?.lng || 108.9870);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [gmapsFeedback, setGmapsFeedback] = useState<string | null>(null);

  // Delivery destination
  const [deliveryAddress, setDeliveryAddress] = useState(
    currentUser?.address || 'Jl. Tani Gg. Sejahtera No. 18, Singkawang Barat'
  );
  const [deliverySubDistrict, setDeliverySubDistrict] = useState('Singkawang Barat');
  const [deliveryLat, setDeliveryLat] = useState(0.9040);
  const [deliveryLng, setDeliveryLng] = useState(108.9820);
  const [mapPickerTarget, setMapPickerTarget] = useState<'store' | 'delivery'>('delivery');

  // Items
  const [items, setItems] = useState<{ id: string; name: string; price: number; quantity: number; notes: string }[]>(
    initialItems.length > 0
      ? initialItems.map((it, idx) => ({ id: `init-${idx}`, ...it, notes: '' }))
      : [{ id: `item-1`, name: '', price: 25000, quantity: 1, notes: '' }]
  );

  const [customerNotes, setCustomerNotes] = useState('');
  const [isExpress, setIsExpress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');

  // Payment settings from backend
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch merchants and payment settings
  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => setMerchants(d))
      .catch(console.error);

    fetch('/api/settings/payment')
      .then(r => r.json())
      .then(d => setPaymentSettings(d))
      .catch(console.error);
  }, []);

  // Handle Google Maps Link parsing
  const handleGmapsInput = (val: string) => {
    setGoogleMapsUrl(val);
    const parsed = parseGoogleMapsInput(val);
    if (parsed) {
      setStoreLat(parsed.lat);
      setStoreLng(parsed.lng);
      setGmapsFeedback(`✓ Berhasil mendeteksi koordinat: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`);
    } else if (val.trim()) {
      setGmapsFeedback('⚠️ Tautan disimpan, tetapi koordinat spesifik tidak terdeteksi otomatis. Silakan pilih titik pada peta di bawah.');
    } else {
      setGmapsFeedback(null);
    }
  };

  // Handle Merchant selection from catalog
  const handleSelectMerchant = (mId: string) => {
    setSelectedMerchantId(mId);
    const m = merchants.find(it => it.id === mId);
    if (m) {
      setStoreName(m.storeName);
      setStoreAddress(m.address);
      setStoreLat(m.lat);
      setStoreLng(m.lng);
      setServiceType(m.category === 'pasar' ? 'jastip_pasar' : m.category === 'apotek' ? 'tebus_obat' : 'jastip_makanan');
    }
  };

  // Sub-district preset coordinates in Singkawang
  const subDistrictZones: Record<string, { lat: number; lng: number }> = {
    'Singkawang Barat': { lat: 0.9069, lng: 108.9866 },
    'Singkawang Tengah': { lat: 0.9125, lng: 108.9950 },
    'Singkawang Selatan': { lat: 0.8520, lng: 108.9650 },
    'Singkawang Timur': { lat: 0.9180, lng: 109.0450 },
    'Singkawang Utara': { lat: 0.9650, lng: 108.9950 },
  };

  const handleSubDistrictChange = (sub: string) => {
    setDeliverySubDistrict(sub);
    const z = subDistrictZones[sub];
    if (z) {
      setDeliveryLat(z.lat);
      setDeliveryLng(z.lng);
    }
  };

  // Items manipulation
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: `item-${Date.now()}`, name: '', price: 20000, quantity: 1, notes: '' },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateItem = (id: string, field: string, val: any) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, [field]: val } : i)));
  };

  // Calculations
  const shoppingCost = items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
  
  // Estimate distance
  const dx = (deliveryLat - storeLat) * 111;
  const dy = (deliveryLng - storeLng) * 111;
  const distanceKm = Math.max(0.8, Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10);

  let shippingFee = 7000;
  if (distanceKm > 2) {
    shippingFee += Math.round((distanceKm - 2) * 2500);
  }
  let jastipFee = serviceType === 'jastip_pasar' ? 8000 : serviceType === 'antar_barang' ? 3000 : 5000;
  if (isExpress) shippingFee += 4000;

  const totalAmount = shoppingCost + shippingFee + jastipFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!storeName.trim()) {
      setErrorMsg('Nama toko atau tempat pembelian wajib diisi.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMsg('Alamat pengantaran wajib diisi.');
      return;
    }
    if (!items.some(i => i.name.trim())) {
      setErrorMsg('Masukkan minimal satu nama barang titipan.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        storeName,
        storeAddress,
        storeLat,
        storeLng,
        googleMapsUrl,
        deliveryAddress,
        deliverySubDistrict,
        deliveryLat,
        deliveryLng,
        serviceType,
        items: items.filter(i => i.name.trim()),
        customerNotes,
        isExpress,
        paymentMethod,
        merchantStoreId: selectedMerchantId || undefined,
      };

      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesanan');
      }

      playChime('order');
      onOrderSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Batal & Kembali
        </button>
        <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
          JASTIP SEKARANG (SINGKAWANG)
        </span>
      </div>

      <form onSubmit={handleSubmitOrder} className="space-y-5 text-xs text-slate-800">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. TOKO / TEMPAT PEMBELIAN */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              Toko atau Lokasi Pembelian di Singkawang
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Titik Toko Terpisah
            </span>
          </div>

          {/* Quick pick from registered merchants */}
          {merchants.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pilih dari Mitra Toko Terdaftar (Opsional):
              </label>
              <select
                value={selectedMerchantId}
                onChange={(e) => handleSelectMerchant(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs"
              >
                <option value="">-- Tulis Nama Toko Manual / Bebas --</option>
                {merchants.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.storeName} ({m.category.toUpperCase()} - {m.subDistrict})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Toko / Resto / Tempat:</label>
              <input
                type="text"
                required
                placeholder="Cth: Mie Kering Haji Aman"
                value={storeName}
                onChange={(e) => {
                  setStoreName(e.target.value);
                  setSelectedMerchantId('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat atau Patokan Toko:</label>
              <input
                type="text"
                required
                placeholder="Jl. Ahmad Yani Singkawang"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Quick Presets for Popular Shopping Centers in Singkawang */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Pilihan Cepat Titik Pusat Belanja Singkawang (Klik untuk Memasang Titik Pin):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: 'Pasar Hongkong', lat: 0.9065, lng: 108.9875 },
                { name: 'Pasar Beringin', lat: 0.9090, lng: 108.9840 },
                { name: 'Singkawang Grand Mall', lat: 0.8970, lng: 108.9750 },
                { name: 'Kuliner Pasiran', lat: 0.9030, lng: 108.9820 },
                { name: 'RSUD Abdul Aziz / Apotek', lat: 0.9045, lng: 108.9890 },
              ].map(p => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    setStoreLat(p.lat);
                    setStoreLng(p.lng);
                    if (!storeName.trim()) setStoreName(p.name);
                  }}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-[11px] font-semibold text-slate-700 transition"
                >
                  🏬 {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Google Maps Link Reference */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-blue-600" /> Tautan Google Maps (Sebagai Referensi Lokasi):
            </label>
            <input
              type="text"
              placeholder="Tempel link Google Maps (cth: https://maps.google.com/?q=0.9120,108.9840 atau koordinat)"
              value={googleMapsUrl}
              onChange={(e) => handleGmapsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50/50"
            />
            {gmapsFeedback && (
              <p className="text-[11px] font-semibold text-blue-700 mt-1">{gmapsFeedback}</p>
            )}
          </div>

          {/* Decoupled Store Coordinates Display */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="font-bold text-blue-950">
                Koordinat Toko Saat Ini: {storeLat.toFixed(5)}, {storeLng.toFixed(5)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMapPickerTarget('store');
                const mapEl = document.getElementById('singkawang-interactive-map');
                if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm transition"
            >
              🎯 Geser Pin Toko di Peta
            </button>
          </div>
        </div>

        {/* 2. DAFTAR BARANG TITIPAN */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              Daftar Barang & Jumlahnya
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-blue-600 font-bold hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Barang
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center font-bold text-slate-400">{idx + 1}.</span>
                  <input
                    type="text"
                    required
                    placeholder="Nama barang / makanan..."
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <div className="w-16">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-center"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Harga (Rp)"
                      value={item.price}
                      onChange={(e) => handleUpdateItem(item.id, 'price', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-right"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Catatan porsi/rasa (opsional, cth: jangan terlalu pedas, bungkus terpisah)"
                  value={item.notes}
                  onChange={(e) => handleUpdateItem(item.id, 'notes', e.target.value)}
                  className="w-full px-3 py-1 rounded bg-white border border-slate-200 text-[11px]"
                />
              </div>
            ))}
          </div>

          <div className="text-right pt-1">
            <span className="text-slate-500">Subtotal Belanja: </span>
            <span className="font-black text-slate-900 text-sm">
              Rp {shoppingCost.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* 3. LOKASI PENGANTARAN & PETA INTERAKTIF OPENSTREETMAP */}
        <div id="singkawang-interactive-map" className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                3
              </span>
              Lokasi Pengantaran & Peta Rute Singkawang
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              Titik Antar Terpisah
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kecamatan Singkawang:</label>
              <select
                value={deliverySubDistrict}
                onChange={(e) => handleSubDistrictChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="Singkawang Barat">Singkawang Barat (Pasar Melayu, Kuala)</option>
                <option value="Singkawang Tengah">Singkawang Tengah (Roban, Condong, Sekip)</option>
                <option value="Singkawang Selatan">Singkawang Selatan (Sedau, Pasir Panjang)</option>
                <option value="Singkawang Timur">Singkawang Timur (Bagak Sahwa, Nyarumkop)</option>
                <option value="Singkawang Utara">Singkawang Utara (Semelagi, Sungai Garam)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap & Patokan Rumah:</label>
              <input
                type="text"
                required
                placeholder="Jl. Tani Gg. Sejahtera No. 18 (Pagar Hijau)"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Interactive Map with Decoupled Mode selector and Free Dragging */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-medium text-slate-600">
                <span className="font-bold text-slate-800">Mode Pemilihan Peta:</span> Klik tombol di samping atau geser pin langsung
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('store')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs ${
                    mapPickerTarget === 'store'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>🏬</span>
                  <span>Titik Toko (Pin Biru)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('delivery')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs ${
                    mapPickerTarget === 'delivery'
                      ? 'bg-red-600 text-white ring-2 ring-red-300'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>📍</span>
                  <span>Titik Rumah (Pin Merah)</span>
                </button>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 leading-relaxed flex items-start gap-1.5">
              <span className="text-sm shrink-0">💡</span>
              <span>
                <strong>Bebas Digeser:</strong> Anda dapat menarik dan menggeser (drag) pin <strong>Toko (Biru)</strong> maupun pin <strong>Rumah (Merah)</strong> secara langsung pada peta Leaflet tanpa mempengaruhi teks nama toko atau alamat Anda.
              </span>
            </div>

            <SingkawangMap
              storePos={{ lat: storeLat, lng: storeLng, title: storeName || 'Lokasi Toko' }}
              deliveryPos={{ lat: deliveryLat, lng: deliveryLng, title: deliveryAddress || 'Lokasi Pengantaran' }}
              selectable={true}
              storeDraggable={true}
              deliveryDraggable={true}
              onStoreDragEnd={(lat, lng) => {
                setStoreLat(lat);
                setStoreLng(lng);
              }}
              onDeliveryDragEnd={(lat, lng) => {
                setDeliveryLat(lat);
                setDeliveryLng(lng);
              }}
              onSelectPos={(lat, lng) => {
                if (mapPickerTarget === 'store') {
                  setStoreLat(lat);
                  setStoreLng(lng);
                } else {
                  setDeliveryLat(lat);
                  setDeliveryLng(lng);
                }
              }}
              modeLabel={
                mapPickerTarget === 'store'
                  ? '🏬 Mode Aktif: Klik peta atau geser pin biru untuk menentukan Toko'
                  : '📍 Mode Aktif: Klik peta atau geser pin merah untuk menentukan Rumah'
              }
              className="h-64 sm:h-72 w-full"
              zoom={13}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">🏬 Titik Toko:</span>
                <span className="font-bold text-slate-800">{storeLat.toFixed(5)}, {storeLng.toFixed(5)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">📍 Titik Antar:</span>
                <span className="font-bold text-slate-800">{deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
              <span>Estimasi Jarak Rute Kurir:</span>
              <span className="font-black text-blue-700">~{distanceKm} km (Singkawang)</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan untuk Kurir:</label>
            <input
              type="text"
              placeholder="Cth: Titip di teras jika saya sedang di belakang, hubungi WhatsApp dulu"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        {/* 4. METODE PEMBAYARAN & RINCIAN BIAYA DARI BACKEND */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              4
            </span>
            Pilih Metode Pembayaran & Rincian Biaya
          </h3>

          {/* 5 Payment Methods */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'QRIS', label: 'QRIS Singkawang', icon: QrCode, badge: 'Scan Bank / E-Wallet' },
              { id: 'TRANSFER_BANK', label: 'Transfer Bank', icon: Building, badge: paymentSettings?.bankTransfer?.bankName || 'BCA / Kalbar' },
              { id: 'VIRTUAL_ACCOUNT', label: 'Virtual Account', icon: CreditCard, badge: paymentSettings?.virtualAccount?.provider || 'VA Bank' },
              { id: 'MANUAL', label: 'Pembayaran Manual', icon: HelpCircle, badge: 'Loket / Kantor' },
              { id: 'COD', label: 'COD (Bayar Tunai)', icon: Banknote, badge: 'Bayar di Tempat' },
            ].map(m => (
              <button
                type="button"
                key={m.id}
                onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                className={`p-3 rounded-xl text-left border transition ${
                  paymentMethod === m.id
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <m.icon className="w-4 h-4 mb-1 text-blue-600" />
                <p className="font-bold text-xs">{m.label}</p>
                <p className="text-[10px] text-slate-400 truncate">{m.badge}</p>
              </button>
            ))}
          </div>

          {/* Transparent Cost Breakdown */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Estimasi Harga Barang:</span>
              <span className="font-semibold">Rp {shoppingCost.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Pengantaran ({distanceKm} km):</span>
              <span className="font-semibold">Rp {shippingFee.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Biaya Layanan Jastip:</span>
              <span className="font-semibold">Rp {jastipFee.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t border-blue-200 pt-2 flex justify-between text-base font-black text-blue-950">
              <span>Total Pembayaran:</span>
              <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-extrabold text-sm shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Mengirim Pesanan ke Kurir...' : `Konfirmasi Pesanan Jastip (Rp ${totalAmount.toLocaleString('id-ID')})`}
          </button>
        </div>
      </form>
    </div>
  );
};
