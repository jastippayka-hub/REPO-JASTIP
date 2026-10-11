import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { MerchantProfile, StoreItem, Order } from '../../types/index.js';
import { playChime } from '../../utils/audio.js';
import {
  Store,
  Plus,
  Trash2,
  Power,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Tag
} from 'lucide-react';

export const MerchantDashboard: React.FC = () => {
  const { currentUser, authFetch } = useAuth();
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    description: '',
    imageUrl: '',
  });

  const fetchMerchantData = async () => {
    try {
      const [mRes, oRes] = await Promise.all([
        authFetch('/api/merchant/my-store'),
        authFetch('/api/orders'),
      ]);

      if (mRes.ok) setMerchant(await mRes.json());
      if (oRes.ok) setStoreOrders(await oRes.json());
    } catch (err) {
      console.error('Failed fetching merchant data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantData();
    const interval = setInterval(fetchMerchantData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleStoreOpen = async () => {
    if (!merchant) return;
    try {
      const res = await authFetch('/api/merchant/my-store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: !merchant.isOpen }),
      });
      if (res.ok) {
        setMerchant(await res.json());
        playChime('notification');
      }
    } catch (err) {
      console.error('Failed toggle open', err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    try {
      const res = await authFetch('/api/merchant/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        playChime('success');
        setShowAddItemModal(false);
        setNewItem({ name: '', price: '', description: '', imageUrl: '' });
        fetchMerchantData();
      }
    } catch (err) {
      console.error('Failed adding item', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await authFetch(`/api/merchant/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) fetchMerchantData();
    } catch (err) {
      console.error('Failed deleting item', err);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 text-sm">Memuat data toko mitra...</div>;
  }

  // Pending approval notice
  if (currentUser?.approvalStatus === 'PENDING_APPROVAL') {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Pendaftaran Toko Sedang Ditinjau</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Akun mitra toko <strong>{currentUser.name}</strong> sedang menunggu verifikasi dan persetujuan dari Super Admin PAYKAJASTIP Singkawang.
        </p>
        <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 border border-slate-200">
          Operator kami sedang memeriksa keabsahan lokasi usaha dan kontak Anda. Hubungi WhatsApp Admin jika butuh persetujuan segera.
        </div>
      </div>
    );
  }

  if (!merchant) {
    return <div className="p-8 text-center text-slate-500">Toko mitra belum terhubung.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header Store Card */}
      <div className="bg-gradient-to-r from-blue-800 to-indigo-700 text-white rounded-3xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl border border-white/30">
            🏬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{merchant.storeName}</h1>
              <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded bg-white text-blue-900">
                {merchant.category}
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {merchant.address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStoreOpen}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition active:scale-95 ${
              merchant.isOpen
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            <Power className="w-4 h-4" />
            {merchant.isOpen ? 'TOKO BUKA (TERIMA ORDER)' : 'TOKO TUTUP SEMENTARA'}
          </button>
        </div>
      </div>

      {/* Orders for this Store */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            Pesanan Titipan Masuk ({storeOrders.length})
          </h2>
          <span className="text-xs text-slate-500">Pelanggan memesan via PAYKAJASTIP</span>
        </div>

        {storeOrders.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Belum ada pesanan aktif untuk toko Anda saat ini.</p>
        ) : (
          <div className="space-y-3">
            {storeOrders.map(order => (
              <div key={order.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-800">{order.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 mt-1">
                    Pemesan: {order.customerName} ({order.customerPhone})
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Barang: {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-500 text-[11px]">Nilai Belanjaan Toko:</p>
                  <p className="font-black text-slate-900 text-sm">
                    Rp {order.shoppingEstimatedCost.toLocaleString('id-ID')}
                  </p>
                  {order.driverName && (
                    <p className="text-[10px] text-blue-700 font-semibold mt-1">
                      Kurir Penjemput: {order.driverName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu / Items Catalog Manager */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              Kelola Menu / Produk Toko ({merchant.items.length})
            </h2>
            <p className="text-xs text-slate-500">Menu yang dapat dipilih pelanggan saat memesan jastip</p>
          </div>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Menu
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {merchant.items.map(item => (
            <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-2">
              <div>
                <h3 className="font-bold text-slate-900 text-xs">{item.name}</h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
                <p className="text-xs font-black text-blue-700 mt-1">
                  Rp {item.price.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleAddItem} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900">Tambah Menu / Barang Baru</h3>
            <div>
              <label className="block text-slate-600 mb-1">Nama Barang / Menu:</label>
              <input
                type="text"
                required
                placeholder="Cth: Mie Bakso Spesial Komplit"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Harga (Rp):</label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                placeholder="30000"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Deskripsi Singkat:</label>
              <input
                type="text"
                placeholder="Irisan daging sapi, tahu bakso..."
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold">
                Simpan Menu
              </button>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
