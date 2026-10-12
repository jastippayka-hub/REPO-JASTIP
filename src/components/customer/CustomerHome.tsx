import React, { useState, useEffect } from 'react';
import { StoreCatalog, Order, OrderItem, OrderServiceType, MerchantProfile } from '../../types/index.js';
import { StoreDetailModal } from './StoreDetailModal.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatWhatsAppUrl } from '../../utils/geo.js';
import {
  Search,
  Sparkles,
  ShoppingBag,
  Bike,
  Utensils,
  Apple,
  Package,
  Pill,
  MapPin,
  Star,
  ChevronRight,
  ShieldCheck,
  Clock,
  ArrowRight,
  MessageCircle
} from 'lucide-react';

interface CustomerHomeProps {
  onSelectOrder: (order: Order) => void;
  onOpenJastipSekarang: (merchant?: any, items?: any[]) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({ onSelectOrder, onOpenJastipSekarang }) => {
  const { currentUser, authFetch } = useAuth();
  const [stores, setStores] = useState<MerchantProfile[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [whatsappAdmin, setWhatsappAdmin] = useState('081254007295');

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) setStores(data);
      }
    } catch (err) {
      console.warn('[CustomerHome] Gagal mengambil daftar toko:', err);
    }
  };

  const fetchActiveOrders = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/orders');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data: Order[] = await res.json();
        const ongoing = data.filter(o => !['SELESAI', 'DIBATALKAN'].includes(o.status));
        setActiveOrders(ongoing);
      }
    } catch (err) {
      console.warn('[CustomerHome] Gagal mengambil pesanan aktif:', err);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchActiveOrders();

    fetch('/api/settings/whatsapp')
      .then(r => (r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null))
      .then(d => {
        if (d?.whatsappAdmin) setWhatsappAdmin(d.whatsappAdmin);
      })
      .catch(err => console.debug('[CustomerHome] Gagal memuat nomor WhatsApp admin:', err));

    const interval = setInterval(fetchActiveOrders, 6000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleCheckoutFromStore = (store: any, items: any[]) => {
    setSelectedStore(null);
    onOpenJastipSekarang(store, items);
  };

  const filteredStores = stores.filter(s => {
    const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchSearch =
      s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.items && s.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Ongoing Order Alert Card if any */}
      {activeOrders.length > 0 && (
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 rounded-3xl p-4 text-white shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 animate-pulse">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  Pesanan Aktif ({activeOrders.length})
                </span>
                <span className="text-xs text-blue-100 font-mono font-bold">
                  {activeOrders[0].orderNumber}
                </span>
              </div>
              <p className="text-sm font-bold mt-0.5">
                {activeOrders[0].storeName} → {activeOrders[0].deliveryAddress}
              </p>
              <p className="text-xs text-blue-100">
                Status: <strong className="text-white">{activeOrders[0].status.replace(/_/g, ' ')}</strong>
                {activeOrders[0].driverName && ` (Kurir: ${activeOrders[0].driverName})`}
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectOrder(activeOrders[0])}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs shadow-md hover:bg-blue-50 active:scale-95 transition"
          >
            Lacak Posisi Kurir di Peta <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Banner Singkawang with JASTIP SEKARANG */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 text-white p-6 sm:p-10 shadow-xl border border-blue-600/30">
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs font-semibold text-blue-100">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Jastip, Belanja & Antar Barang Singkawang
          </div>

          <h1 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight">
            Belanja Apa Saja di Singkawang, Kurir Siap Mengantar!
          </h1>

          <p className="text-sm text-blue-100 leading-relaxed">
            Titip kuliner Pasar Hongkong, Choipan, Mie Kering, sayur segar Pasar Beringin, obat apotek, hingga pengantaran dokumen kilat se-Kota Singkawang.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onOpenJastipSekarang()}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 font-black text-sm shadow-xl active:scale-95 transition"
            >
              <ShoppingBag className="w-4 h-4" /> JASTIP SEKARANG
            </button>

            <a
              href={formatWhatsAppUrl(whatsappAdmin, 'Halo Admin PAYKAJASTIP, saya mau tanya layanan jastip di Singkawang.')}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md backdrop-blur transition"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Admin ({whatsappAdmin})
            </a>
          </div>
        </div>
      </div>

      {/* Quick Service Categories */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          Layanan Jastip PAYKA Singkawang
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { id: 'jastip_makanan', title: 'Kuliner Khas', desc: 'Mie Kering, Choipan, Kwetiau', icon: Utensils, color: 'from-orange-500 to-amber-500' },
            { id: 'jastip_pasar', title: 'Pasar Segar', desc: 'Pasar Beringin sayur & ikan', icon: Apple, color: 'from-emerald-500 to-green-600' },
            { id: 'antar_barang', title: 'Antar Paket Kilat', desc: 'Dokumen & kirim barang', icon: Package, color: 'from-blue-500 to-indigo-600' },
            { id: 'tebus_obat', title: 'Apotek & Obat', desc: 'Kimia Farma & resep dokter', icon: Pill, color: 'from-rose-500 to-pink-600' },
            { id: 'jastip_custom', title: 'Jastip Bebas', desc: 'Toko & warung pilihan Anda', icon: Sparkles, color: 'from-sky-500 to-blue-600' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => onOpenJastipSekarang()}
              className="group text-left p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition flex flex-col justify-between"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${cat.color} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition`}>
                <cat.icon className="w-5 h-5" />
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition">
                  {cat.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{cat.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recommended Merchants & Catalog */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tempat Belanja & Rekomendasi Jastip Singkawang
            </h2>
            <p className="text-xs text-slate-500">Pilih toko favorit Anda untuk memesan langsung</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari toko, choipan, pasar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Semua Kategori' },
            { id: 'kuliner', label: 'Kuliner Legendaris' },
            { id: 'pasar', label: 'Pasar Tradisional' },
            { id: 'oleholeh', label: 'Oleh-Oleh Khas' },
            { id: 'apotek', label: 'Apotek & Medis' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition ${
                selectedCategory === c.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Stores Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map(store => (
            <div
              key={store.id}
              onClick={() => onOpenJastipSekarang(store)}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition cursor-pointer flex flex-col"
            >
              <div className="relative h-40 bg-slate-900 overflow-hidden">
                <img
                  src={store.imageUrl}
                  alt={store.storeName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                  {store.category}
                </span>
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-white text-[11px] font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-current" /> {store.rating}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition">
                    {store.storeName}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate">{store.address}</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {store.items?.length || 0} Pilihan Menu
                  </span>
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                    Pesan Jastip <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
