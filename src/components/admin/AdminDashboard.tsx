import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Order, DriverProfile, MerchantProfile, AuditLog, AppSettings, SubDistrictZone } from '../../types/index.js';
import { SingkawangMap } from '../SingkawangMap.js';
import { playChime } from '../../utils/audio.js';
import { formatWhatsAppUrl } from '../../utils/geo.js';
import { jsPDF } from 'jspdf';
import {
  TrendingUp,
  Package,
  Bike,
  Users,
  Settings,
  Store,
  MapPin,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Phone,
  Image,
  CreditCard,
  Building,
  QrCode,
  Banknote,
  FileText,
  Download,
  ShieldCheck,
  AlertCircle,
  Sliders,
  DollarSign
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'approvals' | 'drivers' | 'settings' | 'payments' | 'whatsapp' | 'logo' | 'reports' | 'audit'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [merchants, setMerchants] = useState<MerchantProfile[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ pendingDrivers: DriverProfile[]; pendingMerchants: MerchantProfile[] }>({ pendingDrivers: [], pendingMerchants: [] });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Settings State
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [zones, setZones] = useState<SubDistrictZone[]>([]);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [settingsErrorMsg, setSettingsErrorMsg] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [whatsappAdmin, setWhatsappAdmin] = useState('081254007295');
  const [whatsappSuccessMsg, setWhatsappSuccessMsg] = useState('');
  const [whatsappErrorMsg, setWhatsappErrorMsg] = useState('');

  const [logoUrl, setLogoUrl] = useState('/icon.svg');
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');
  const [logoErrorMsg, setLogoErrorMsg] = useState('');

  const [paymentConfigs, setPaymentConfigs] = useState<any>(null);
  const [paymentActiveSubTab, setPaymentActiveSubTab] = useState<'bank' | 'va' | 'qris' | 'manual' | 'cod' | 'verify'>('verify');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Drivers Tab State
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [selectedDriverMap, setSelectedDriverMap] = useState<DriverProfile | null>(null);
  const [topupDriverModal, setTopupDriverModal] = useState<{ driver: DriverProfile; amount: number } | null>(null);

  // Reports
  const [reportData, setReportData] = useState<any>(null);
  const [reportDateFilter, setReportDateFilter] = useState<'ALL' | '7D' | '30D'>('ALL');

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchAllData = async () => {
    try {
      const [oRes, dRes, mRes, pRes, sRes, zRes, aRes] = await Promise.all([
        authFetch('/api/orders'),
        authFetch('/api/admin/drivers'),
        authFetch('/api/stores'),
        authFetch('/api/admin/pending-approvals'),
        authFetch('/api/settings'),
        authFetch('/api/settings/zones'),
        authFetch('/api/admin/audit-logs'),
      ]);

      if (oRes.ok) setOrders(await oRes.json());
      if (dRes.ok) setDrivers(await dRes.json());
      if (mRes.ok) setMerchants(await mRes.json());
      if (pRes.ok) setPendingApprovals(await pRes.json());
      if (aRes.ok) setAuditLogs(await aRes.json());

      if (sRes.ok) {
        const s: AppSettings = await sRes.json();
        setAppSettings(prev => {
          if (!prev) return s;
          // Protect form inputs if user is currently editing on settings or payments or whatsapp tab
          if (activeTab === 'settings' || activeTab === 'payments' || activeTab === 'whatsapp') {
            return prev;
          }
          return s;
        });
        if (activeTab !== 'whatsapp') {
          setWhatsappAdmin(s.whatsappAdmin || '081254007295');
        }
        if (activeTab !== 'logo') {
          setLogoUrl(s.logoUrl || '/icon.svg');
        }
        if (activeTab !== 'payments') {
          setPaymentConfigs({
            bankTransfer: s.bankTransfer,
            virtualAccount: s.virtualAccount,
            qris: s.qris,
            manualPayment: s.manualPayment,
            cod: s.cod,
          });
        }
      }

      if (zRes.ok) {
        const z = await zRes.json();
        setZones(prev => (prev.length === 0 || activeTab !== 'settings' ? z : prev));
      }
    } catch (err) {
      console.error('Failed fetching admin data', err);
    }
  };

  const fetchReports = async () => {
    let url = '/api/admin/reports';
    if (reportDateFilter === '7D') {
      const d = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      url += `?startDate=${encodeURIComponent(d)}`;
    } else if (reportDateFilter === '30D') {
      const d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      url += `?startDate=${encodeURIComponent(d)}`;
    }

    try {
      const res = await authFetch(url);
      if (res.ok) setReportData(await res.json());
    } catch (err) {
      console.error('Failed fetching reports', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [activeTab, reportDateFilter]);

  // Save General App & Tariff Settings (Tahap 1)
  const handleSaveGeneralSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!appSettings) return;
    setSettingsSuccessMsg('');
    setSettingsErrorMsg('');
    setIsSavingSettings(true);

    try {
      const res = await authFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appSettings),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan pengaturan aplikasi');
      }

      // Save zones
      for (const z of zones) {
        await authFetch(`/api/settings/zones/${z.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseDeliveryFee: z.baseDeliveryFee, name: z.name }),
        });
      }

      playChime('success');
      setSettingsSuccessMsg('Pengaturan aplikasi & tarif Singkawang berhasil disimpan permanen ke database!');
      setTimeout(() => setSettingsSuccessMsg(''), 4500);
      fetchAllData();
    } catch (err: any) {
      setSettingsErrorMsg(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Update Driver Details (Tahap 5)
  const handleUpdateDriver = async (driverId: string, updates: Partial<DriverProfile>) => {
    try {
      const res = await authFetch(`/api/admin/drivers/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        playChime('success');
        fetchAllData();
      }
    } catch (err) {
      console.error('Failed updating driver', err);
    }
  };

  const handleTopupDriverWallet = async (driver: DriverProfile, addAmount: number) => {
    const newBal = (driver.walletBalance || 0) + addAmount;
    await handleUpdateDriver(driver.id, { walletBalance: newBal });
    setTopupDriverModal(null);
  };

  // Approve or Reject user
  const handleApproveUser = async (targetType: 'driver' | 'merchant', targetId: string, isApproved: boolean) => {
    try {
      const res = await authFetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, isApproved }),
      });
      if (res.ok) {
        playChime('success');
        fetchAllData();
      }
    } catch (err) {
      console.error('Failed processing approval', err);
    }
  };

  // Save WhatsApp setting
  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappSuccessMsg('');
    setWhatsappErrorMsg('');

    try {
      const res = await authFetch('/api/settings/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWhatsappErrorMsg(data.error || 'Gagal menyimpan.');
      } else {
        playChime('success');
        setWhatsappSuccessMsg('Nomor WhatsApp admin berhasil disimpan & langsung aktif pada tombol kontak pelanggan!');
      }
    } catch (err: any) {
      setWhatsappErrorMsg(err.message || 'Terjadi kesalahan.');
    }
  };

  // Save Logo setting
  const handleSaveLogo = async (url: string) => {
    try {
      const res = await authFetch('/api/settings/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: url }),
      });
      if (res.ok) {
        setLogoUrl(url);
        playChime('success');
        setLogoSuccessMsg('Logo PAYKAJASTIP berhasil diperbarui di seluruh sistem!');
        setTimeout(() => setLogoSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed saving logo', err);
    }
  };

  // Save Payment configs
  const handleSavePaymentConfig = async (method: string, updates: any) => {
    try {
      const res = await authFetch(`/api/settings/payment/${method}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        playChime('success');
        setPaymentSuccessMsg('Pengaturan metode pembayaran berhasil disimpan ke database!');
        fetchAllData();
        setTimeout(() => setPaymentSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed saving payment config', err);
    }
  };

  // Verify payment proof
  const handleVerifyPayment = async (orderId: string, isApproved: boolean) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved }),
      });
      if (res.ok) {
        playChime('success');
        fetchAllData();
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed verifying payment', err);
    }
  };

  // Export PDF Report using jsPDF
  const handleExportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('LAPORAN OPERASIONAL RESMI PAYKAJASTIP SINGKAWANG', 14, 18);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')} | Wilayah: Singkawang, Kalbar`, 14, 25);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(12);
    doc.text('Ringkasan Metrik Transaksi:', 14, 36);

    const m = reportData.metrics;
    doc.setFontSize(9);
    doc.text(`- Total Pesanan Masuk: ${m.totalOrders}`, 16, 44);
    doc.text(`- Pesanan Berhasil Selesai: ${m.completedOrders}`, 16, 50);
    doc.text(`- Pesanan Dibatalkan: ${m.cancelledOrders}`, 16, 56);
    doc.text(`- Total Nilai Barang Titipan: Rp ${m.totalShoppingValue.toLocaleString('id-ID')}`, 16, 62);
    doc.text(`- Total Ongkos Pengantaran: Rp ${m.totalShippingFees.toLocaleString('id-ID')}`, 16, 68);
    doc.text(`- Total Biaya Jasa Titip (Fee): Rp ${m.totalJastipFees.toLocaleString('id-ID')}`, 16, 74);
    doc.text(`- Total Perputaran Uang Sah (LUNAS): Rp ${m.totalGrossRevenue.toLocaleString('id-ID')}`, 16, 80);

    doc.line(14, 86, 196, 86);
    doc.setFontSize(12);
    doc.text('Daftar Riwayat Transaksi:', 14, 94);

    let y = 102;
    doc.setFontSize(8);
    doc.text('No. Order', 14, y);
    doc.text('Pelanggan', 55, y);
    doc.text('Toko Asal', 95, y);
    doc.text('Total (Rp)', 140, y);
    doc.text('Status', 170, y);
    y += 5;

    reportData.orders.slice(0, 25).forEach((o: Order) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(o.orderNumber, 14, y);
      doc.text(o.customerName.slice(0, 18), 55, y);
      doc.text(o.storeName.slice(0, 20), 95, y);
      doc.text(o.totalAmount.toLocaleString('id-ID'), 140, y);
      doc.text(o.status.replace(/_/g, ' '), 170, y);
      y += 6;
    });

    doc.save('PAYKAJASTIP_Laporan_Singkawang.pdf');
    playChime('success');
  };

  const totalPending = pendingApprovals.pendingDrivers.length + pendingApprovals.pendingMerchants.length;
  const waitingVerificationOrders = orders.filter(o => o.paymentStatus === 'WAITING_VERIFICATION');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
            Panel Super Admin PAYKAJASTIP Singkawang
          </h1>
          <p className="text-xs text-slate-500">
            Pusat Pengelolaan Persetujuan Akun, Pembayaran, WhatsApp, Logo, Tarif & Laporan
          </p>
        </div>

        <button
          onClick={fetchAllData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Segarkan
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold overflow-x-auto">
        {[
          { id: 'orders', label: `Kelola Pesanan (${orders.length})`, icon: Package },
          { id: 'approvals', label: `Persetujuan Akun (${totalPending})`, icon: ShieldCheck, badge: totalPending > 0 ? totalPending : undefined },
          { id: 'drivers', label: `Daftar Kurir Driver (${drivers.length})`, icon: Bike },
          { id: 'settings', label: 'Pengaturan Aplikasi & Tarif', icon: Sliders },
          { id: 'payments', label: `Pengaturan Pembayaran (${waitingVerificationOrders.length} Verif)`, icon: CreditCard },
          { id: 'whatsapp', label: 'Nomor WhatsApp Admin', icon: Phone },
          { id: 'logo', label: 'Pengaturan Logo', icon: Image },
          { id: 'reports', label: 'Laporan & Ekspor PDF', icon: FileText },
          { id: 'audit', label: `Audit Log (${auditLogs.length})`, icon: Clock },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 whitespace-nowrap transition ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Order & Tanggal</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Rute Toko → Rumah</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Bayar</th>
                  <th className="py-3 px-4">Kurir</th>
                  <th className="py-3 px-4">Status Pengantaran</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{order.orderNumber}</td>
                    <td className="py-3 px-4">{order.customerName}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{order.storeName} → {order.deliveryAddress}</td>
                    <td className="py-3 px-4 font-black">Rp {order.totalAmount.toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : order.paymentStatus === 'WAITING_VERIFICATION' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {order.paymentMethod} ({order.paymentStatus})
                      </span>
                    </td>
                    <td className="py-3 px-4">{order.driverName || 'Belum Ada'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                      >
                        Buka
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Drivers pending */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Bike className="w-4 h-4 text-blue-600" />
              Pendaftaran Kurir Menunggu Persetujuan ({pendingApprovals.pendingDrivers.length})
            </h3>

            {pendingApprovals.pendingDrivers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">Tidak ada pendaftaran kurir baru yang menunggu persetujuan.</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.pendingDrivers.map(d => (
                  <div key={d.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{d.name}</p>
                      <p className="text-slate-500">No HP: {d.phone} • Kendaraan: {d.motorcycleModel} ({d.plateNumber})</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveUser('driver', d.id, true)}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        ✓ Setujui Akun Kurir
                      </button>
                      <button
                        onClick={() => handleApproveUser('driver', d.id, false)}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merchants pending */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-600" />
              Pendaftaran Mitra Toko Menunggu Persetujuan ({pendingApprovals.pendingMerchants.length})
            </h3>

            {pendingApprovals.pendingMerchants.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">Tidak ada pendaftaran toko mitra baru yang menunggu persetujuan.</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.pendingMerchants.map(m => (
                  <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.storeName}</p>
                      <p className="text-slate-500">Kategori: {m.category} • Alamat: {m.address} • Kontak: {m.phone}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveUser('merchant', m.id, true)}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        ✓ Setujui Toko Mitra
                      </button>
                      <button
                        onClick={() => handleApproveUser('merchant', m.id, false)}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DAFTAR KURIR DRIVER (Tahap 5) */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: `Semua (${drivers.length})` },
                { id: 'APPROVED', label: `Disetujui (${drivers.filter(d => d.approvalStatus === 'APPROVED').length})` },
                { id: 'PENDING', label: `Menunggu (${drivers.filter(d => d.approvalStatus === 'PENDING_APPROVAL').length})` },
                { id: 'ONLINE', label: `Online (${drivers.filter(d => d.isOnline).length})` },
                { id: 'OFFLINE', label: `Offline (${drivers.filter(d => !d.isOnline).length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDriverFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    driverFilter === f.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, HP, plat motor..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white"
              />
            </div>
          </div>

          {/* Drivers List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers
              .filter(d => {
                const matchFilter =
                  driverFilter === 'ALL' ||
                  (driverFilter === 'APPROVED' && d.approvalStatus === 'APPROVED') ||
                  (driverFilter === 'PENDING' && d.approvalStatus === 'PENDING_APPROVAL') ||
                  (driverFilter === 'ONLINE' && d.isOnline) ||
                  (driverFilter === 'OFFLINE' && !d.isOnline);
                const q = driverSearch.toLowerCase();
                const matchSearch =
                  !q ||
                  d.name.toLowerCase().includes(q) ||
                  d.phone.includes(q) ||
                  d.motorcycleModel.toLowerCase().includes(q) ||
                  d.plateNumber.toLowerCase().includes(q);
                return matchFilter && matchSearch;
              })
              .map(driver => (
                <div
                  key={driver.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Info & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{driver.name}</h4>
                          <p className="text-slate-500 text-[11px] font-mono">{driver.phone}</p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            driver.approvalStatus === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : driver.approvalStatus === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {driver.approvalStatus === 'APPROVED' ? 'Disetujui' : driver.approvalStatus === 'PENDING_APPROVAL' ? 'Menunggu Izin' : 'Ditolak'}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            driver.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${driver.isOnline ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          {driver.isOnline ? (driver.isBusy ? 'Sedang Bertugas' : 'Online (Tersedia)') : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Details */}
                    <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Sepeda Motor:</span>
                        <span className="font-semibold text-slate-800">{driver.motorcycleModel}</span>
                        <span className="block font-mono font-bold text-blue-700">{driver.plateNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Saldo Dompet:</span>
                        <span className="font-black text-slate-900 text-xs">Rp {(driver.walletBalance || 0).toLocaleString('id-ID')}</span>
                        <span className="block text-slate-500 text-[10px]">⭐ {driver.rating} • {driver.totalTrips || 0} trip</span>
                      </div>
                    </div>

                    {/* GPS Location status */}
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-500" />
                        GPS: {driver.currentLat?.toFixed(4)}, {driver.currentLng?.toFixed(4)}
                      </span>
                      <span>
                        {driver.lastLocationUpdate ? `Aktif: ${new Date(driver.lastLocationUpdate).toLocaleTimeString('id-ID')}` : 'Belum ada sinyal GPS'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex gap-1.5">
                      {driver.approvalStatus === 'PENDING_APPROVAL' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveUser('driver', driver.id, true)}
                            className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[11px]"
                          >
                            ✓ Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveUser('driver', driver.id, false)}
                            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px]"
                          >
                            ✕ Tolak
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateDriver(driver.id, { isOnline: !driver.isOnline })}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                            driver.isOnline ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          }`}
                        >
                          {driver.isOnline ? 'Set Offline' : 'Set Online'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setTopupDriverModal({ driver, amount: 50000 })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                      >
                        <DollarSign className="w-3 h-3 text-green-600" /> Saldo
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDriverMap(driver)}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold hover:bg-sky-100 text-[11px] flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" /> Peta
                      </button>
                      <a
                        href={formatWhatsAppUrl(driver.phone, `Halo Kurir ${driver.name}, ini dari Admin PAYKAJASTIP Singkawang.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-bold hover:bg-green-100 text-[11px] flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> WA
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Modal Map for Selected Driver */}
          {selectedDriverMap && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-4 max-w-lg w-full space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Bike className="w-4 h-4 text-blue-600" />
                    Posisi Kurir: {selectedDriverMap.name} ({selectedDriverMap.plateNumber})
                  </h3>
                  <button onClick={() => setSelectedDriverMap(null)} className="p-1 rounded text-slate-400 hover:text-slate-700">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <SingkawangMap
                  driverPos={{
                    lat: selectedDriverMap.currentLat,
                    lng: selectedDriverMap.currentLng,
                    title: selectedDriverMap.name,
                    plate: selectedDriverMap.plateNumber,
                  }}
                  className="h-72 w-full"
                  zoom={15}
                />
                <p className="text-[11px] text-slate-500">
                  Koordinat: {selectedDriverMap.currentLat}, {selectedDriverMap.currentLng} • Terakhir Terdeteksi: {selectedDriverMap.lastLocationUpdate ? new Date(selectedDriverMap.lastLocationUpdate).toLocaleString('id-ID') : 'Belum aktif'}
                </p>
              </div>
            </div>
          )}

          {/* Modal Top up Saldo Driver */}
          {topupDriverModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-xs">
                <h3 className="font-bold text-sm text-slate-900">
                  Sesuaikan Saldo Dompet Driver: {topupDriverModal.driver.name}
                </h3>
                <p className="text-slate-500">
                  Saldo saat ini: <strong>Rp {(topupDriverModal.driver.walletBalance || 0).toLocaleString('id-ID')}</strong>
                </p>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nominal Penambahan / Penyesuaian (Rp):</label>
                  <input
                    type="number"
                    step="5000"
                    value={topupDriverModal.amount}
                    onChange={(e) => setTopupDriverModal({ ...topupDriverModal, amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div className="flex gap-2">
                  {[25000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupDriverModal({ ...topupDriverModal, amount: amt })}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-[10px]"
                    >
                      +{(amt / 1000)}rb
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleTopupDriverWallet(topupDriverModal.driver, topupDriverModal.amount)}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    Simpan Saldo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopupDriverModal(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PENGATURAN APLIKASI & TARIF (Tahap 1) */}
      {activeTab === 'settings' && appSettings && (
        <div className="space-y-5">
          {settingsSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{settingsSuccessMsg}</span>
            </div>
          )}
          {settingsErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{settingsErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveGeneralSettings} className="space-y-5">
            {/* 1. Profil & Identitas Aplikasi */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                1. Profil & Identitas Aplikasi PAYKAJASTIP
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Aplikasi:</label>
                  <input
                    type="text"
                    required
                    value={appSettings.appName || 'PAYKAJASTIP'}
                    onChange={(e) => setAppSettings({ ...appSettings, appName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tagline Aplikasi:</label>
                  <input
                    type="text"
                    required
                    value={appSettings.appTagline || 'Jastip, Belanja & Antar Barang di Singkawang'}
                    onChange={(e) => setAppSettings({ ...appSettings, appTagline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kota / Wilayah Operasional Resmi:</label>
                  <input
                    type="text"
                    required
                    value={appSettings.operationalCity || 'Singkawang, Kalimantan Barat'}
                    onChange={(e) => setAppSettings({ ...appSettings, operationalCity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nomor Kontak Bantuan / Hotline Layanan:</label>
                  <input
                    type="text"
                    required
                    value={appSettings.contactSupportPhone || '0812-5400-7295'}
                    onChange={(e) => setAppSettings({ ...appSettings, contactSupportPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nomor WhatsApp Admin (Aktif):</label>
                  <input
                    type="text"
                    required
                    value={appSettings.whatsappAdmin || '081254007295'}
                    onChange={(e) => {
                      setAppSettings({ ...appSettings, whatsappAdmin: e.target.value });
                      setWhatsappAdmin(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-green-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nomor ini terhubung langsung ke tombol WhatsApp di header, floating widget, dan kontak pesanan.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Konfigurasi Tarif Pengantaran & Layanan */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                2. Konfigurasi Tarif Operasional Singkawang
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="block text-slate-700 font-semibold mb-1">Tarif Dasar Kurir (Rp):</label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    required
                    value={appSettings.baseFare}
                    onChange={(e) => setAppSettings({ ...appSettings, baseFare: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Tarif minimum per pesanan</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="block text-slate-700 font-semibold mb-1">Tarif per Kilometer (Rp):</label>
                  <input
                    type="number"
                    step="500"
                    min="500"
                    required
                    value={appSettings.perKmFare}
                    onChange={(e) => setAppSettings({ ...appSettings, perKmFare: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Dihitung otomatis via Haversine</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="block text-slate-700 font-semibold mb-1">Biaya Jastip Standar (Rp):</label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    required
                    value={appSettings.defaultJastipFee}
                    onChange={(e) => setAppSettings({ ...appSettings, defaultJastipFee: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Fee jasa titip barang/kuliner</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="block text-slate-700 font-semibold mb-1">Biaya Tambahan Express (Rp):</label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    required
                    value={appSettings.expressSurcharge}
                    onChange={(e) => setAppSettings({ ...appSettings, expressSurcharge: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Prioritas kurir instan langsung antar</span>
                </div>
              </div>
            </div>

            {/* 3. Tarif Dasar Zona Kecamatan Singkawang */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-red-500" />
                3. Tarif Dasar Berdasarkan Kecamatan di Kota Singkawang
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zones.map((zone, idx) => (
                  <div key={zone.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{zone.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Zona {idx + 1}</span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Ongkos Dasar Zona (Rp):</label>
                      <input
                        type="number"
                        step="500"
                        value={zone.baseDeliveryFee}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setZones(zones.map(z => z.id === zone.id ? { ...z, baseDeliveryFee: val } : z));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSavingSettings}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md transition disabled:opacity-50"
            >
              {isSavingSettings ? 'Menyimpan ke Database...' : '💾 SIMPAN SELURUH PENGATURAN & TARIF SINGKAWANG'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: PAYMENTS & VERIFICATION */}
      {activeTab === 'payments' && paymentConfigs && (
        <div className="space-y-5">
          {paymentSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{paymentSuccessMsg}</span>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs">
            {[
              { id: 'verify', label: `Verifikasi Bukti Transfer (${waitingVerificationOrders.length})` },
              { id: 'bank', label: '1. Pengaturan Transfer Bank' },
              { id: 'va', label: '2. Pengaturan Virtual Account' },
              { id: 'qris', label: '3. Pengaturan QRIS' },
              { id: 'manual', label: '4. Pengaturan Pembayaran Manual' },
              { id: 'cod', label: '5. Pengaturan COD' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setPaymentActiveSubTab(st.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  paymentActiveSubTab === st.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Sub-Tab 1: Verification */}
          {paymentActiveSubTab === 'verify' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Antrean Bukti Transfer yang Menunggu Verifikasi Admin ({waitingVerificationOrders.length})
              </h3>

              {waitingVerificationOrders.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Tidak ada pembayaran yang menunggu verifikasi.</p>
              ) : (
                <div className="space-y-3">
                  {waitingVerificationOrders.map(order => (
                    <div key={order.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <p className="font-mono font-bold text-blue-900">{order.orderNumber}</p>
                        <p className="font-bold text-slate-900">{order.customerName} ({order.customerPhone})</p>
                        <p className="text-slate-600">Total Nominal: <strong>Rp {order.totalAmount.toLocaleString('id-ID')}</strong> ({order.paymentMethod})</p>
                        {order.paymentNotes && <p className="italic text-slate-500">Catatan: {order.paymentNotes}</p>}
                        {order.paymentProofUrl && (
                          <div className="pt-2">
                            <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline flex items-center gap-1">
                              Lihat Bukti Foto / Struk Transfer ↗
                            </a>
                            <img src={order.paymentProofUrl} alt="Bukti" className="h-32 object-contain mt-1 rounded border border-slate-300" />
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                        <button
                          onClick={() => handleVerifyPayment(order.id, true)}
                          className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                          ✓ Verifikasi Lunas (PAID)
                        </button>
                        <button
                          onClick={() => handleVerifyPayment(order.id, false)}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                        >
                          ✕ Tolak Pembayaran
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab: Bank */}
          {paymentActiveSubTab === 'bank' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Pengaturan Transfer Bank</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentConfigs.bankTransfer.enabled}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, bankTransfer: { ...paymentConfigs.bankTransfer, enabled: e.target.checked } })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Aktifkan Metode Transfer Bank
                </label>
                <div>
                  <label className="block text-slate-600 mb-1">Nama Bank:</label>
                  <input
                    type="text"
                    value={paymentConfigs.bankTransfer.bankName}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, bankTransfer: { ...paymentConfigs.bankTransfer, bankName: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Nomor Rekening:</label>
                  <input
                    type="text"
                    value={paymentConfigs.bankTransfer.accountNumber}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, bankTransfer: { ...paymentConfigs.bankTransfer, accountNumber: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Atas Nama Rekening:</label>
                  <input
                    type="text"
                    value={paymentConfigs.bankTransfer.accountHolder}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, bankTransfer: { ...paymentConfigs.bankTransfer, accountHolder: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Petunjuk Pembayaran untuk Pelanggan:</label>
                  <textarea
                    rows={2}
                    value={paymentConfigs.bankTransfer.instructions}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, bankTransfer: { ...paymentConfigs.bankTransfer, instructions: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleSavePaymentConfig('bank-transfer', paymentConfigs.bankTransfer)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Pengaturan Bank
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab: VA */}
          {paymentActiveSubTab === 'va' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Pengaturan Virtual Account</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentConfigs.virtualAccount.enabled}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, virtualAccount: { ...paymentConfigs.virtualAccount, enabled: e.target.checked } })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Aktifkan Metode Virtual Account
                </label>
                <div>
                  <label className="block text-slate-600 mb-1">Penyedia VA:</label>
                  <input
                    type="text"
                    value={paymentConfigs.virtualAccount.provider}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, virtualAccount: { ...paymentConfigs.virtualAccount, provider: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Nomor Virtual Account / Prefix:</label>
                  <input
                    type="text"
                    value={paymentConfigs.virtualAccount.vaNumber}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, virtualAccount: { ...paymentConfigs.virtualAccount, vaNumber: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Petunjuk Pembayaran:</label>
                  <textarea
                    rows={2}
                    value={paymentConfigs.virtualAccount.instructions}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, virtualAccount: { ...paymentConfigs.virtualAccount, instructions: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleSavePaymentConfig('virtual-account', paymentConfigs.virtualAccount)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Pengaturan VA
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab: QRIS */}
          {paymentActiveSubTab === 'qris' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Pengaturan QRIS</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentConfigs.qris.enabled}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, qris: { ...paymentConfigs.qris, enabled: e.target.checked } })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Aktifkan Metode QRIS
                </label>
                <div>
                  <label className="block text-slate-600 mb-1">Nama Merchant QRIS Resmi:</label>
                  <input
                    type="text"
                    value={paymentConfigs.qris.merchantName}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, qris: { ...paymentConfigs.qris, merchantName: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">URL Gambar Kode QRIS:</label>
                  <input
                    type="text"
                    value={paymentConfigs.qris.qrisImageUrl}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, qris: { ...paymentConfigs.qris, qrisImageUrl: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                  <img src={paymentConfigs.qris.qrisImageUrl} alt="QRIS" className="h-28 mt-2 border rounded p-1" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Petunjuk Pembayaran:</label>
                  <textarea
                    rows={2}
                    value={paymentConfigs.qris.instructions}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, qris: { ...paymentConfigs.qris, instructions: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleSavePaymentConfig('qris', paymentConfigs.qris)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Pengaturan QRIS
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab: Manual */}
          {paymentActiveSubTab === 'manual' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Pengaturan Pembayaran Manual</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentConfigs.manualPayment.enabled}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, manualPayment: { ...paymentConfigs.manualPayment, enabled: e.target.checked } })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Aktifkan Metode Pembayaran Manual
                </label>
                <div>
                  <label className="block text-slate-600 mb-1">Lokasi Kasir / Loket Kantor:</label>
                  <input
                    type="text"
                    value={paymentConfigs.manualPayment.cashierLocation}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, manualPayment: { ...paymentConfigs.manualPayment, cashierLocation: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Petunjuk Pembayaran:</label>
                  <textarea
                    rows={2}
                    value={paymentConfigs.manualPayment.instructions}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, manualPayment: { ...paymentConfigs.manualPayment, instructions: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleSavePaymentConfig('manual', paymentConfigs.manualPayment)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Pengaturan Manual
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab: COD */}
          {paymentActiveSubTab === 'cod' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Pengaturan COD (Bayar di Tempat)</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentConfigs.cod.enabled}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, cod: { ...paymentConfigs.cod, enabled: e.target.checked } })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  Aktifkan Metode COD
                </label>
                <div>
                  <label className="block text-slate-600 mb-1">Maksimal Nominal Pesanan COD (Rp):</label>
                  <input
                    type="number"
                    value={paymentConfigs.cod.maxCodAmount}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, cod: { ...paymentConfigs.cod, maxCodAmount: parseInt(e.target.value) || 0 } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Petunjuk COD untuk Pelanggan:</label>
                  <textarea
                    rows={2}
                    value={paymentConfigs.cod.instructions}
                    onChange={(e) => setPaymentConfigs({ ...paymentConfigs, cod: { ...paymentConfigs.cod, instructions: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleSavePaymentConfig('cod', paymentConfigs.cod)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Pengaturan COD
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WHATSAPP ADMIN */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs max-w-lg space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Phone className="w-4 h-4 text-green-600" />
              Pengaturan Nomor WhatsApp Admin
            </h3>
            <p className="text-slate-500 mt-1">
              Nomor ini akan digunakan secara dinamis oleh seluruh tombol WhatsApp di halaman pelanggan dan laporan.
            </p>
          </div>

          {whatsappSuccessMsg && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>{whatsappSuccessMsg}</span>
            </div>
          )}
          {whatsappErrorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{whatsappErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveWhatsApp} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor WhatsApp Admin (Format 08... atau 62...):
              </label>
              <input
                type="text"
                required
                placeholder="081254007295"
                value={whatsappAdmin}
                onChange={(e) => setWhatsappAdmin(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-md transition"
            >
              SIMPAN NOMOR WHATSAPP
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: LOGO MANAGEMENT */}
      {activeTab === 'logo' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs max-w-lg space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-600" />
              Pengaturan Logo PAYKAJASTIP
            </h3>
            <p className="text-slate-500 mt-1">
              Logo yang disimpan akan langsung digunakan pada Header, Beranda, Login, dan PWA.
            </p>
          </div>

          {logoSuccessMsg && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>{logoSuccessMsg}</span>
            </div>
          )}

          {logoErrorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{logoErrorMsg}</span>
            </div>
          )}

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-4">
            <img src={logoUrl} alt="Logo Preview" className="w-16 h-16 object-contain rounded-xl bg-white p-2 border" />
            <div>
              <p className="font-bold text-slate-900">Preview Logo Aktif</p>
              <p className="text-[11px] text-slate-400 font-mono break-all">{logoUrl}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unggah dari Galeri / File Perangkat:</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => {
                  setLogoErrorMsg('');
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 3 * 1024 * 1024) {
                      setLogoErrorMsg('Ukuran gambar maksimal 3MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        handleSaveLogo(String(event.target.result));
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full text-xs"
              />
            </div>

            <div className="pt-2">
              <p className="text-slate-500 mb-1">Atau gunakan URL Logo Standar:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveLogo('/icon.svg')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Gunakan Logo Asli PAYKA SVG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS & PDF EXPORT */}
      {activeTab === 'reports' && reportData && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Filter Rentang Tanggal:</span>
              {(['ALL', '7D', '30D'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setReportDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    reportDateFilter === f ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600'
                  }`}
                >
                  {f === 'ALL' ? 'Semua Riwayat' : f === '7D' ? '7 Hari Terakhir' : '30 Hari Terakhir'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md active:scale-95 transition"
            >
              <Download className="w-4 h-4" /> EKSPOR PDF RESMI
            </button>
          </div>

          {/* Metrics breakdown card without double counting */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Total Pesanan</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{reportData.metrics.totalOrders}</p>
              <p className="text-[11px] text-green-600 mt-0.5">{reportData.metrics.completedOrders} Selesai • {reportData.metrics.cancelledOrders} Batal</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Nilai Belanja Barang</p>
              <p className="text-lg font-black text-slate-900 mt-1">Rp {reportData.metrics.totalShoppingValue.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Uang titipan pembelian di toko</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Total Ongkir Kurir</p>
              <p className="text-lg font-black text-slate-900 mt-1">Rp {reportData.metrics.totalShippingFees.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">85% bagian kurir, 15% platform</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Total Biaya Jasa Titip (Fee)</p>
              <p className="text-lg font-black text-blue-700 mt-1">Rp {reportData.metrics.totalJastipFees.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pendapatan layanan jasa titip</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Catatan Jejak Audit Sistem (Audit Trail)</h3>
            <p className="text-xs text-slate-500">Mencatat seluruh aksi penting pengguna, kurir, dan admin</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto text-xs">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 font-mono text-[11px]">{log.action}</span>
                  <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                </div>
                <p className="text-slate-700 mt-0.5">{log.details}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Oleh: {log.actorEmail} ({log.actorRole})</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
