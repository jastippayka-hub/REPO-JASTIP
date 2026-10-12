import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { WalletTransaction } from '../../types/index.js';
import { playChime } from '../../utils/audio.js';
import { X, Wallet, Plus, ArrowUpRight, ArrowDownLeft, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';

interface PaykaWalletModalProps {
  onClose: () => void;
}

export const PaykaWalletModal: React.FC<PaykaWalletModalProps> = ({ onClose }) => {
  const { currentUser, updateWalletBalance, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topupAmount, setTopupAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [source, setSource] = useState('QRIS Singkawang');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTransactions = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/wallet/transactions/${currentUser.id}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.warn('[PaykaWallet] Gagal mengambil riwayat transaksi:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentUser]);

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg('');

    const amount = customAmount ? parseInt(customAmount, 10) : topupAmount;
    if (isNaN(amount) || amount < 10000) {
      setErrorMsg('Minimal top up adalah Rp 10.000');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          amount,
          paymentSource: source,
        }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        updateWalletBalance(data.balance);
        playChime('success');
        setSuccessMsg(`Top Up Rp ${amount.toLocaleString('id-ID')} berhasil masuk ke Saldo PaykaPay!`);
        fetchTransactions();
        await refreshUser();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData?.error || 'Gagal memproses top up. Silakan coba kembali.');
      }
    } catch (err) {
      console.warn('[PaykaWallet] Gagal top up:', err);
      setErrorMsg('Koneksi ke server gagal. Periksa jaringan internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-sky-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Dompet PaykaPay</h2>
              <p className="text-xs text-blue-100">Solusi pembayaran praktis & hemat jastip</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-slate-800 text-xs">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <p className="text-xs text-blue-200">Saldo Aktif Anda</p>
            <p className="text-2xl font-black mt-1">
              Rp {(currentUser?.walletBalance || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-blue-200 mt-2">
              Akun: {currentUser?.name} ({currentUser?.phone})
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Top Up Form */}
          <form onSubmit={handleTopup} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600" /> Top Up Saldo Instan
            </h3>

            {/* Quick Amount Pills */}
            <div className="grid grid-cols-4 gap-2">
              {[25000, 50000, 100000, 200000].map(amt => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => {
                    setTopupAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-2 px-1 rounded-xl font-bold text-center border transition ${
                    topupAmount === amt && !customAmount
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {(amt / 1000)}k
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Atau masukkan nominal lain (Rp):</label>
              <input
                type="number"
                min="10000"
                step="5000"
                placeholder="Cth: 75000"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Metode Isi Saldo:</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="QRIS Singkawang">QRIS Singkawang (BCA, Kalbar, Dana, ShopeePay)</option>
                <option value="Transfer Bank Kalbar">Transfer Bank Kalbar (Virtual Account)</option>
                <option value="Transfer BCA">Transfer Bank BCA</option>
                <option value="Transfer Mandiri">Transfer Bank Mandiri</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Isi Saldo Sekarang'}
            </button>
          </form>

          {/* Transactions List */}
          <div>
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
              Riwayat Transaksi Dompet
            </h3>

            {transactions.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Belum ada riwayat transaksi.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(t => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          t.type === 'TOPUP' || t.type === 'EARNING'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t.type === 'TOPUP' || t.type === 'EARNING' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 leading-snug">{t.description}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(t.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-black ${
                        t.type === 'TOPUP' || t.type === 'EARNING' ? 'text-green-600' : 'text-slate-900'
                      }`}
                    >
                      {t.type === 'TOPUP' || t.type === 'EARNING' ? '+' : '-'}Rp{' '}
                      {t.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
