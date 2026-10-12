import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../../types/index.js';
import { SingkawangMap } from '../SingkawangMap.js';
import { formatWhatsAppUrl } from '../../utils/geo.js';
import { playChime } from '../../utils/audio.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  Bike,
  Store,
  MapPin,
  CreditCard,
  QrCode,
  FileText,
  ShieldCheck,
  Upload,
  AlertCircle,
  X
} from 'lucide-react';

interface OrderDetailViewProps {
  order: Order;
  onBack: () => void;
  onOrderUpdated: (updated: Order) => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ order, onBack, onOrderUpdated }) => {
  const { authFetch } = useAuth();
  const [whatsappAdmin, setWhatsappAdmin] = useState('081254007295');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Fetch current WhatsApp Admin number from DB
  useEffect(() => {
    fetch('/api/settings/whatsapp')
      .then(r => (r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null))
      .then(d => {
        if (d?.whatsappAdmin) setWhatsappAdmin(d.whatsappAdmin);
      })
      .catch(err => console.debug('[OrderDetailView] Gagal memuat nomor WhatsApp admin:', err));
  }, []);

  // Status mapping
  const statusSteps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'MENUNGGU_DRIVER', label: 'Mencari Kurir', desc: 'Mencocokkan kurir online terdekat di Singkawang' },
    { key: 'DRIVER_MENUJU_LOKASI', label: 'Kurir Menuju Toko', desc: 'Kurir dalam perjalanan ke tempat belanja' },
    { key: 'SEDANG_DIBELANJAKAN', label: 'Sedang Dibelanjakan', desc: 'Kurir sedang membeli barang titipan Anda' },
    { key: 'SEDANG_DIANTAR', label: 'Sedang Diantar', desc: 'Kurir menuju ke alamat pengantaran' },
    { key: 'SELESAI', label: 'Pesanan Selesai', desc: 'Barang telah diterima' },
  ];

  const currentStepIdx = statusSteps.findIndex(s => s.key === order.status);

  // Handle uploading payment proof
  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofUrlInput) return;

    setIsUploading(true);
    try {
      const res = await authFetch(`/api/orders/${order.id}/upload-payment-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofUrl: proofUrlInput, notes: proofNotes }),
      });

      if (res.ok) {
        const updated = await res.json();
        playChime('success');
        onOrderUpdated(updated);
        setUploadSuccess(true);
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Failed uploading proof', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
            {order.orderNumber}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-green-100 text-green-800">
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Main Map & Live Courier Tracking */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              Pelacakan Kurir di Singkawang
            </h2>
            <p className="text-xs text-slate-500">
              Rute pengantaran dari {order.storeName} ke {order.deliveryAddress}
            </p>
          </div>

          {order.driverLat && order.driverLng ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Sinyal GPS Kurir Terhubung
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
              Menunggu sinyal GPS perangkat kurir...
            </span>
          )}
        </div>

        <SingkawangMap
          storePos={{ lat: order.storeLat, lng: order.storeLng, title: order.storeName }}
          deliveryPos={{ lat: order.deliveryLat, lng: order.deliveryLng, title: order.deliveryAddress }}
          driverPos={
            order.driverLat && order.driverLng
              ? {
                  lat: order.driverLat,
                  lng: order.driverLng,
                  title: order.driverName || 'Kurir Payka',
                  plate: order.driverPlate,
                }
              : undefined
          }
          className="h-80 w-full"
          zoom={14}
        />

        {/* Courier Details Card if Assigned */}
        {order.driverId ? (
          <div className="p-4 bg-blue-50/60 border-t border-blue-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                🏍️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{order.driverName}</h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white font-mono">
                    {order.driverPlate}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Kurir Resmi PAYKAJASTIP Singkawang</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/62${(order.driverPhone || '').replace(/^0/, '')}?text=Halo%20Kurir%20PaykaJastip,%20saya%20pelanggan%20pesanan%20${order.orderNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Kurir
              </a>
              <a
                href={`tel:${order.driverPhone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                <Phone className="w-3.5 h-3.5" /> Hubungi
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border-t border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <span>Sistem sedang mencocokkan kurir terdekat di sekitar {order.storeName}...</span>
            <a
              href={formatWhatsAppUrl(whatsappAdmin, `Halo Admin PAYKAJASTIP, mohon info kurir untuk pesanan ${order.orderNumber}`)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
            >
              Hubungi Admin
            </a>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Status & Tahapan Pengantaran:</h3>

        <div className="space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {statusSteps.map((step, idx) => {
            const isDone = currentStepIdx >= idx;
            const isCurrent = currentStepIdx === idx;
            return (
              <div key={step.key} className="relative">
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                      : isDone
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <div>
                  <p className={`text-xs font-bold ${isCurrent ? 'text-blue-700 font-extrabold' : isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details & Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Shopping Items */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-600" />
            Rincian Barang Jastip ({order.storeName})
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {order.items.map((it, idx) => (
              <div key={it.id || idx} className="py-2.5 flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-900">
                    {it.name} <span className="text-slate-400 font-normal">x{it.quantity}</span>
                  </p>
                  {it.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">"{it.notes}"</p>}
                </div>
                <span className="font-semibold text-slate-800">
                  Rp {(it.price * it.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>

          {order.customerNotes && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <strong>Catatan:</strong> {order.customerNotes}
            </div>
          )}

          {/* Proof of Shopping Receipt uploaded by driver */}
          {order.driverShoppingReceiptUrl && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" /> Bukti Struk Belanja dari Toko:
              </p>
              <img
                src={order.driverShoppingReceiptUrl}
                alt="Struk Toko"
                className="max-h-48 rounded-xl border border-slate-200 object-contain shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Payment & Invoice Box */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Status & Bukti Pembayaran
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  order.paymentStatus === 'PAID'
                    ? 'bg-green-100 text-green-800'
                    : order.paymentStatus === 'WAITING_VERIFICATION'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {order.paymentStatus === 'PAID'
                  ? 'LUNAS (TERVERIFIKASI)'
                  : order.paymentStatus === 'WAITING_VERIFICATION'
                  ? 'MENUNGGU VERIFIKASI ADMIN'
                  : 'BELUM LUNAS'}
              </span>
            </div>

            <div className="space-y-2 py-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Harga Belanjaan:</span>
                <span className="font-semibold text-slate-800">
                  Rp {order.shoppingEstimatedCost.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ongkos Pengantaran:</span>
                <span className="font-semibold text-slate-800">
                  Rp {order.shippingFee.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Layanan Jastip:</span>
                <span className="font-semibold text-slate-800">
                  Rp {order.jastipFee.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Metode:</span>
                <span className="font-bold text-blue-700">{order.paymentMethod}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                <span>Total Tagihan:</span>
                <span className="text-blue-700">Rp {order.totalAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Upload payment proof section if not PAID and not COD */}
            {order.paymentMethod !== 'COD' && order.paymentStatus !== 'PAID' && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {order.paymentProofUrl ? 'Ganti Bukti Transfer' : 'Unggah Bukti Transfer / Pembayaran'}
                </button>
              </div>
            )}
          </div>

          {/* WhatsApp Admin Help Button */}
          <div className="pt-2">
            <a
              href={formatWhatsAppUrl(whatsappAdmin, `Halo Admin PAYKAJASTIP, saya ingin konfirmasi pesanan ${order.orderNumber}`)}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl border border-green-600 text-green-700 hover:bg-green-50 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
              Chat Admin via WhatsApp ({whatsappAdmin})
            </a>
          </div>
        </div>
      </div>

      {/* Upload Proof Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleUploadProof} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl text-slate-800 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-slate-900">Unggah Bukti Transfer</h3>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadSuccess && (
              <div className="p-2.5 rounded-xl bg-green-50 text-green-800 font-semibold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Bukti berhasil dikirim. Menunggu verifikasi admin.
              </div>
            )}

            <p className="text-slate-500">
              Pilih contoh struk transfer atau masukkan URL screenshot m-Banking:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProofUrlInput('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80')}
                className="p-2 rounded-xl border border-slate-200 text-left hover:border-blue-500 text-[11px]"
              >
                <p className="font-bold">Bukti Transfer BCA</p>
                <p className="text-[10px] text-slate-400">Struk m-Banking</p>
              </button>
              <button
                type="button"
                onClick={() => setProofUrlInput('https://images.unsplash.com/photo-1554415707-9e44667014f8?auto=format&fit=crop&w=600&q=80')}
                className="p-2 rounded-xl border border-slate-200 text-left hover:border-blue-500 text-[11px]"
              >
                <p className="font-bold">Bukti QRIS / Dana</p>
                <p className="text-[10px] text-slate-400">Screenshot Bukti</p>
              </button>
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] mb-1">URL / Link Gambar Bukti:</label>
              <input
                type="text"
                required
                placeholder="https://..."
                value={proofUrlInput}
                onChange={(e) => setProofUrlInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] mb-1">Catatan Tambahan (Pengirim):</label>
              <input
                type="text"
                placeholder="Dari Rekening a/n Rusdiana"
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isUploading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isUploading ? 'Mengirim...' : 'Kirim Bukti ke Admin'}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold"
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
