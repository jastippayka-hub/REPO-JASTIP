import React, { useState } from 'react';
import { StoreCatalog, OrderItem, StoreItem } from '../../types/index.js';
import { X, Plus, Minus, ShoppingBag, MapPin, Star, Check } from 'lucide-react';

interface StoreDetailModalProps {
  store: StoreCatalog | null;
  onClose: () => void;
  onCheckout: (store: StoreCatalog, items: OrderItem[]) => void;
}

export const StoreDetailModal: React.FC<StoreDetailModalProps> = ({ store, onClose, onCheckout }) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  if (!store) return null;

  const menuList: StoreItem[] = store.items || [];

  const handleQtyChange = (itemId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setItemNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const selectedItems: OrderItem[] = menuList
    .filter((item: StoreItem) => (quantities[item.id] || 0) > 0)
    .map((item: StoreItem) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: quantities[item.id] || 1,
      notes: itemNotes[item.id] || '',
    }));

  const totalEstimate = selectedItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Image & Info */}
        <div className="relative h-44 shrink-0 bg-slate-900">
          <img
            src={store.imageUrl}
            alt={store.name}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-600 text-white mb-1">
              {store.category} Singkawang
            </span>
            <h2 className="text-xl font-bold">{store.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-200 mt-0.5">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Star className="w-3.5 h-3.5 fill-current" /> {store.rating}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {store.subDistrict}
              </span>
            </div>
          </div>
        </div>

        {/* Menu Items List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 divide-y divide-slate-100">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-bold text-slate-900 text-sm">Pilih Menu / Barang Jastip:</h3>
            <span className="text-xs text-slate-500">{menuList.length} Pilihan</span>
          </div>

          {menuList.map((item: StoreItem) => {
            const qty = quantities[item.id] || 0;
            return (
              <div key={item.id} className="pt-3 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                    <p className="text-sm font-bold text-blue-700 mt-1">
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => handleQtyChange(item.id, -1)}
                      disabled={qty === 0}
                      className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-800">{qty}</span>
                    <button
                      onClick={() => handleQtyChange(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white shadow-sm flex items-center justify-center hover:bg-blue-700 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Optional special note for item when quantity > 0 */}
                {qty > 0 && (
                  <div className="mt-2 pl-1">
                    <input
                      type="text"
                      placeholder="Catatan porsi/rasa (cth: pedas manis, tanpa daun seledri...)"
                      value={itemNotes[item.id] || ''}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Checkout Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">Estimasi Belanja ({selectedItems.reduce((a, b) => a + b.quantity, 0)} item)</p>
            <p className="text-lg font-black text-blue-700">
              Rp {totalEstimate.toLocaleString('id-ID')}
            </p>
          </div>

          <button
            onClick={() => {
              if (selectedItems.length > 0) {
                onCheckout(store, selectedItems);
              }
            }}
            disabled={selectedItems.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            Lanjut Pesan Jastip
          </button>
        </div>
      </div>
    </div>
  );
};
