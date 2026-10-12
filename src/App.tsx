/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { NotificationProvider, useNotifications } from './context/NotificationContext.js';
import { PWAInstallBanner } from './components/PWAInstallBanner.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';
import { CustomerHome } from './components/customer/CustomerHome.js';
import { JastipSekarangView } from './components/customer/JastipSekarangView.js';
import { OrderDetailView } from './components/customer/OrderDetailView.js';
import { DriverDashboard } from './components/driver/DriverDashboard.js';
import { MerchantDashboard } from './components/merchant/MerchantDashboard.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { formatWhatsAppUrl } from './utils/geo.js';
import { Order } from './types/index.js';
import {
  Bike,
  Bell,
  User,
  Shield,
  Store,
  LogOut,
  LogIn,
  MessageCircle,
  ShoppingBag,
  Home,
  CheckCircle2,
  X,
  ExternalLink
} from 'lucide-react';

function AppContent() {
  const { currentUser, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, requestNotificationPermission } = useNotifications();

  // Navigation states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showJastipSekarang, setShowJastipSekarang] = useState(false);
  const [jastipInitialMerchant, setJastipInitialMerchant] = useState<any | null>(null);
  const [jastipInitialItems, setJastipInitialItems] = useState<any[]>([]);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Dynamic Settings
  const [logoUrl, setLogoUrl] = useState('/icon.svg');
  const [whatsappAdmin, setWhatsappAdmin] = useState('081254007295');

  const fetchDynamicSettings = async () => {
    try {
      const lRes = await fetch('/api/settings/logo');
      if (lRes.ok) {
        const d = await lRes.json();
        if (d?.logoUrl) setLogoUrl(d.logoUrl);
      }
    } catch {
      // Ignored transient network drop
    }

    try {
      const wRes = await fetch('/api/settings/whatsapp');
      if (wRes.ok) {
        const d = await wRes.json();
        if (d?.whatsappAdmin) setWhatsappAdmin(d.whatsappAdmin);
      }
    } catch {
      // Ignored transient network drop
    }
  };

  useEffect(() => {
    fetchDynamicSettings();
    const interval = setInterval(fetchDynamicSettings, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenJastip = (merchant?: any, items?: any[]) => {
    setJastipInitialMerchant(merchant || null);
    setJastipInitialItems(items || []);
    setShowJastipSekarang(true);
    setSelectedOrder(null);
  };

  const currentRole = currentUser?.role;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Offline Connectivity Bar */}
      <OfflineIndicator />

      {/* Main Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Brand with Dynamic Logo */}
          <div
            onClick={() => {
              setSelectedOrder(null);
              setShowJastipSekarang(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none shrink-0"
          >
            <img
              src={logoUrl}
              alt="PAYKAJASTIP"
              className="w-9 h-9 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shadow-xs"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-tight text-blue-800">
                  PAYKA<span className="text-sky-600">JASTIP</span>
                </span>
                <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  SINGKAWANG
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 hidden sm:block -mt-0.5">
                Jastip, Belanja & Antar Barang di Singkawang
              </p>
            </div>
          </div>

          {/* User Account / Navigation Area */}
          <div className="flex items-center gap-2">
            {/* Dynamic WhatsApp Admin Contact Link */}
            <a
              href={formatWhatsAppUrl(whatsappAdmin, 'Halo Admin PAYKAJASTIP Singkawang, saya butuh bantuan.')}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-green-600 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-bold transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Bantuan WA</span>
            </a>

            {currentUser ? (
              <div className="flex items-center gap-2">
                {/* Role Chip */}
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                  {currentRole === 'super_admin' ? (
                    <>
                      <Shield className="w-3 h-3 text-blue-600" /> Super Admin
                    </>
                  ) : currentRole === 'driver' ? (
                    <>
                      <Bike className="w-3 h-3 text-blue-600" /> Driver ({currentUser.name})
                    </>
                  ) : currentRole === 'merchant' ? (
                    <>
                      <Store className="w-3 h-3 text-blue-600" /> Mitra Toko
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 text-blue-600" /> {currentUser.name}
                    </>
                  )}
                </span>

                {/* Notifications */}
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                  aria-label="Notifikasi"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    logout();
                    setSelectedOrder(null);
                    setShowJastipSekarang(false);
                  }}
                  className="flex items-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-bold transition"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk / Daftar Akun
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Content based on Active User Role */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {currentRole === 'super_admin' ? (
          <AdminDashboard />
        ) : currentRole === 'driver' ? (
          <DriverDashboard />
        ) : currentRole === 'merchant' ? (
          <MerchantDashboard />
        ) : (
          /* Pelanggan / Guest Flow */
          showJastipSekarang ? (
            <JastipSekarangView
              initialMerchant={jastipInitialMerchant}
              initialItems={jastipInitialItems}
              onBack={() => setShowJastipSekarang(false)}
              onOrderSuccess={(order) => {
                setShowJastipSekarang(false);
                setSelectedOrder(order);
              }}
            />
          ) : selectedOrder ? (
            <OrderDetailView
              order={selectedOrder}
              onBack={() => setSelectedOrder(null)}
              onOrderUpdated={(updated) => setSelectedOrder(updated)}
            />
          ) : (
            <CustomerHome
              onOpenJastipSekarang={handleOpenJastip}
              onSelectOrder={(order) => setSelectedOrder(order)}
            />
          )
        )}
      </main>

      {/* Floating WhatsApp Contact Button (Always visible on mobile/desktop) */}
      <a
        href={formatWhatsAppUrl(whatsappAdmin, 'Halo Admin PAYKAJASTIP Singkawang, saya butuh informasi jasa titip / kurir.')}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-2xl transition hover:scale-105 active:scale-95 border-2 border-white"
      >
        <MessageCircle className="w-5 h-5 fill-current" />
        <span className="hidden sm:inline">WhatsApp Admin Singkawang</span>
      </a>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p className="font-bold text-slate-700">
            PAYKAJASTIP SINGKAWANG — Jastip, Belanja & Antar Barang Kilat
          </p>
          <p className="text-[11px] text-slate-400">
            Wilayah Operasional: Singkawang Barat, Singkawang Tengah, Singkawang Selatan, Singkawang Timur, Singkawang Utara.
          </p>
          <p className="text-[10px] text-slate-400">
            Hotline Admin: {whatsappAdmin} | Progressive Web App (PWA) Berstandar Operasional Singkawang.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Notifications Drawer Modal */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs p-4 sm:p-6">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Notifikasi ({unreadCount} baru)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={requestNotificationPermission}
                  className="text-[11px] text-blue-600 hover:underline font-bold"
                >
                  Izin Notif HP
                </button>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-2 divide-y divide-slate-100 text-xs">
              {notifications.length === 0 ? (
                <p className="text-center py-6 text-slate-400">Belum ada notifikasi.</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`pt-2.5 pb-2 px-2 rounded-xl transition cursor-pointer ${
                      n.read ? 'bg-transparent text-slate-600' : 'bg-blue-50/70 text-slate-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(n.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}
