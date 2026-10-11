import React, { useState, useEffect } from 'react';
import { OrderServiceType, PaymentMethod, StoreCatalog, OrderItem, Order } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { SingkawangMap } from '../SingkawangMap.js';
import { playChime } from '../../utils/audio.js';
import {
  X,
  Plus,
  Trash2,
  Bike,
  Sparkles,
  MapPin,
  Clock,
  Wallet,
  QrCode,
  Building,
  Banknote,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface OrderFormModalProps {
  initialStore?: StoreCatalog | null;
  initialItems?: OrderItem[];
  initialService?: OrderServiceType;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  initialStore,
  initialItems = [],
  initialService = 'jastip_makanan',
  onClose,
  onOrderCreated,
}) => {
  const { currentUser, refreshUser } = useAuth();

  const [serviceType, setServiceType] = useState<OrderServiceType>(
    initialStore
      ? (initialStore.category === 'pasar' ? 'jastip_pasar' : initialStore.category === 'apotek' ? 'tebus_obat' : 'jastip_makanan')
      : initialService
  );

  const [storeName, setStoreName] = useState<string>(
    initialStore ? (initialStore.storeName || initialStore.name || '') : ''
  );
  const [storeAddress, setStoreAddress] = useState(
    initialStore ? initialStore.address : 'Singkawang Barat, Kalimantan Barat'
  );
  const [storeLat, setStoreLat] = useState(initialStore ? initialStore.lat : 0.9080);
  const [storeLng, setStoreLng] = useState(initialStore ? initialStore.lng : 108.9870);

  const [deliveryAddress, setDeliveryAddress] = useState(
    currentUser?.address || 'Jl. Tani Gg. Sejahtera No. 18, Singkawang Barat'
  );
  const [deliverySubDistrict, setDeliverySubDistrict] = useState('Singkawang Barat');
  const [deliveryLat, setDeliveryLat] = useState(0.9040);
  const [deliveryLng, setDeliveryLng] = useState(108.9820);

  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isExpress, setIsExpress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');

  // Custom Items
  const [items, setItems] = useState<OrderItem[]>(
    initialItems.length > 0
      ? initialItems
      : [{ id: `item-${Date.now()}`, name: '', price: 25000, quantity: 1, notes: '' }]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Zone coordinates lookup in Singkawang
  const zonesConfig: Record<string, { lat: number; lng: number; dist: number }> = {
    'Singkawang Barat': { lat: 0.9069, lng: 108.9866, dist: 1.8 },
    'Singkawang Tengah': { lat: 0.9125, lng: 108.9950, dist: 2.8 },
    'Singkawang Selatan': { lat: 0.8520, lng: 108.9650, dist: 6.5 },
    'Singkawang Timur': { lat: 0.9180, lng: 109.0450, dist: 7.2 },
    'Singkawang Utara': { lat: 0.9650, lng: 108.9950, dist: 5.5 },
  };

  const handleSubDistrictChange = (sub: string) => {
    setDeliverySubDistrict(sub);
    const z = zonesConfig[sub];
    if (z) {
      setDeliveryLat(z.lat);
      setDeliveryLng(z.lng);
    }
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { id: `item-${Date.now()}-${Math.random()}`, name: '', price: 20000, quantity: 1, notes: '' },
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateItemRow = (id: string, field: keyof OrderItem, val: any) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, [field]: val } : i)));
  };

  // Cost calculation
  const shoppingCost = items.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0);
  const distanceKm = zonesConfig[deliverySubDistrict]?.dist || 2.0;

  // Base shipping fee: Rp 7.000 for <= 2km, then Rp 2.500/km
  let shippingFee = 7000;
  if (distanceKm > 2) {
    shippingFee += Math.round((distanceKm - 2) * 2500);
  }

  // Jastip service fee
  let jastipFee = 5000;
  if (serviceType === 'jastip_pasar') jastipFee = 8000;
  else if (serviceType === 'antar_barang') jastipFee = 3000;
  else if (serviceType === 'jastip_custom') jastipFee = 7000;
  else if (serviceType === 'tebus_obat') jastipFee = 5000;

  if (isExpress) shippingFee += 4000;

  const totalAmount = shoppingCost + shippingFee + jastipFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!storeName.trim()) {
      setErrorMsg('Nama toko atau tempat asal wajib diisi');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMsg('Alamat tujuan pengantaran wajib diisi');
      return;
    }
    if (items.length === 0 || !items.some(i => i.name.trim())) {
      setErrorMsg('Tulis minimal 1 barang belanjaan');
      return;
    }

    if (paymentMethod === 'PAYKAPAY' && (currentUser?.walletBalance || 0) < totalAmount) {
      setErrorMsg(`Saldo PaykaPay tidak cukup (Saldo: Rp ${(currentUser?.walletBalance || 0).toLocaleString('id-ID')}). Silakan pilih metode lain atau top up.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        userId: currentUser?.id || 'user-pelanggan-1',
        customerName: customerName || currentUser?.name || 'Pelanggan Singkawang',
        customerPhone: customerPhone || currentUser?.phone || '081254001122',
        serviceType,
        storeName,
        storeAddress,
        storeLat,
        storeLng,
        deliveryAddress,
        deliverySubDistrict,
        deliveryLat,
        deliveryLng,
        distanceKm,
        items: items.filter(i => i.name.trim()),
        shoppingEstimatedCost: shoppingCost,
        paymentMethod,
        customerNotes,
        isExpress,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal membuat pesanan');
      }

      const createdOrder: Order = await res.json();
      playChime('order');
      await refreshUser();
      onOrderCreated(createdOrder);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-sky-600 text-white p-4 sm:p-5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Formulir Pesanan Jastip Singkawang</h2>
              <p className="text-xs text-blue-100">Kurir siap belanja & antar ke rumah Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-slate-800 text-sm">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Type Selection */}
          <div>
            <label className="block font-bold text-slate-900 mb-2">Pilih Layanan Jastip:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'jastip_makanan', label: 'Kuliner Khas', desc: 'Makanan & Oleh-oleh' },
                { type: 'jastip_pasar', label: 'Pasar Segar', desc: 'Beringin & Hongkong' },
                { type: 'antar_barang', label: 'Antar Paket Kilat', desc: 'Dokumen / Barang' },
                { type: 'tebus_obat', label: 'Apotek & Obat', desc: 'Resep Dokter' },
                { type: 'jastip_custom', label: 'Jastip Bebas', desc: 'Toko / Warung Apapun' },
              ].map(s => (
                <button
                  type="button"
                  key={s.type}
                  onClick={() => setServiceType(s.type as OrderServiceType)}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    serviceType === s.type
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="font-bold text-xs">{s.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Store / Pickup Location */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-700">
              <MapPin className="w-3.5 h-3.5" /> 1. Lokasi Toko / Pembelian
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Toko / Resto</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mie Kering Haji Aman"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Toko</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jl. Ahmad Yani Singkawang"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Destination Location */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-red-600">
              <MapPin className="w-3.5 h-3.5" /> 2. Alamat Pengantaran (Singkawang)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kecamatan Singkawang</label>
                <select
                  value={deliverySubDistrict}
                  onChange={(e) => handleSubDistrictChange(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="Singkawang Barat">Singkawang Barat (Pasar Melayu, Kuala)</option>
                  <option value="Singkawang Tengah">Singkawang Tengah (Roban, Condong, Sekip)</option>
                  <option value="Singkawang Selatan">Singkawang Selatan (Sedau, Pasir Panjang)</option>
                  <option value="Singkawang Timur">Singkawang Timur (Bagak Sahwa, Nyarumkop)</option>
                  <option value="Singkawang Utara">Singkawang Utara (Semelagi, Sei Garam)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap & Patokan</label>
                <input
                  type="text"
                  required
                  placeholder="Jl. Tani Gg. Sejahtera No. 18 (Pagar Hijau)"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Interactive Leaflet Mini Map Preview */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Peta Rute Singkawang (Estimasi Jarak: {distanceKm} km)
              </label>
              <SingkawangMap
                storePos={{ lat: storeLat, lng: storeLng, title: storeName || 'Toko' }}
                deliveryPos={{ lat: deliveryLat, lng: deliveryLng, title: deliveryAddress }}
                className="h-44 w-full"
                zoom={13}
              />
            </div>
          </div>

          {/* Items / Belanjaan List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                3. Daftar Barang Titipan ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Barang
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}.</span>
                    <input
                      type="text"
                      required
                      placeholder="Nama makanan/barang belanjaan..."
                      value={item.name}
                      onChange={(e) => handleUpdateItemRow(item.id, 'name', e.target.value)}
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItemRow(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-center"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Harga (Rp)"
                        value={item.price}
                        onChange={(e) => handleUpdateItemRow(item.id, 'price', parseInt(e.target.value) || 0)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-right"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Catatan khusus (misal: pedas sedang, rasa jeruk, merk tertentu)"
                    value={item.notes || ''}
                    onChange={(e) => handleUpdateItemRow(item.id, 'notes', e.target.value)}
                    className="w-full text-[11px] px-3 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Options & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Antar Kilat Express
                </p>
                <p className="text-[11px] text-slate-500">Prioritas kurir &lt; 45 menit (+Rp 4.000)</p>
              </div>
              <input
                type="checkbox"
                checked={isExpress}
                onChange={(e) => setIsExpress(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Catatan tambahan untuk kurir..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full text-xs px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block font-bold text-slate-900 mb-2 text-xs uppercase tracking-wider">
              4. Metode Pembayaran:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'QRIS', label: 'QRIS Instan', icon: QrCode, badge: 'Semua E-Wallet/Bank' },
                { id: 'TRANSFER_BANK', label: 'Transfer Bank', icon: Building, badge: 'BCA / Kalbar / Mandiri' },
                { id: 'PAYKAPAY', label: 'Saldo PaykaPay', icon: Wallet, badge: `Saldo: Rp ${(currentUser?.walletBalance || 0).toLocaleString('id-ID')}` },
                { id: 'COD', label: 'COD (Bayar Tunai)', icon: Banknote, badge: 'Bayar di Tempat' },
              ].map(m => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-3 rounded-xl text-left border transition ${
                    paymentMethod === m.id
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <m.icon className="w-5 h-5 mb-1.5 text-blue-600" />
                  <p className="font-bold text-xs">{m.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{m.badge}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Estimasi Belanjaan:</span>
              <span className="font-semibold">Rp {shoppingCost.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Ongkos Kirim Kurir ({distanceKm} km):</span>
              <span className="font-semibold">Rp {shippingFee.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Biaya Jasa Titip (Jastip):</span>
              <span className="font-semibold">Rp {jastipFee.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t border-blue-200 pt-2 flex justify-between text-sm font-black text-blue-950">
              <span>Total Tagihan:</span>
              <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Memproses Pesanan...' : `Konfirmasi & Pesan Jastip (Rp ${totalAmount.toLocaleString('id-ID')})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
