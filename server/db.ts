import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  DriverProfile,
  MerchantProfile,
  Order,
  SubDistrictZone,
  NotificationItem,
  WalletTransaction,
  AuditLog,
  AppSettings,
} from '../src/types/index.js';

interface DatabaseSchema {
  users: User[];
  drivers: DriverProfile[];
  merchants: MerchantProfile[];
  zones: SubDistrictZone[];
  orders: Order[];
  notifications: NotificationItem[];
  walletTransactions: WalletTransaction[];
  auditLogs: AuditLog[];
  settings: AppSettings;
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'db.json');

const defaultZones: SubDistrictZone[] = [
  { id: 'skw-barat', name: 'Singkawang Barat (Pasar Melayu, Kuala)', lat: 0.9069, lng: 108.9866, baseDeliveryFee: 7000 },
  { id: 'skw-tengah', name: 'Singkawang Tengah (Roban, Condong, Sekip)', lat: 0.9125, lng: 108.9950, baseDeliveryFee: 8000 },
  { id: 'skw-selatan', name: 'Singkawang Selatan (Sedau, Pasir Panjang)', lat: 0.8520, lng: 108.9650, baseDeliveryFee: 12000 },
  { id: 'skw-timur', name: 'Singkawang Timur (Bagak Sahwa, Nyarumkop)', lat: 0.9180, lng: 109.0450, baseDeliveryFee: 13000 },
  { id: 'skw-utara', name: 'Singkawang Utara (Semelagi, Sungai Garam)', lat: 0.9650, lng: 108.9950, baseDeliveryFee: 12000 },
];

const defaultSettings: AppSettings = {
  appName: 'PAYKAJASTIP',
  appTagline: 'Jastip, Belanja & Antar Barang di Singkawang',
  baseFare: 7000,
  perKmFare: 2500,
  expressSurcharge: 4000,
  defaultJastipFee: 5000,
  operationalCity: 'Singkawang, Kalimantan Barat',
  contactSupportPhone: '0812-5400-7295',
  whatsappAdmin: '081254007295',
  logoUrl: '/icon.svg',
  bankTransfer: {
    enabled: true,
    bankName: 'Bank BCA Singkawang',
    accountNumber: '8290-1122-3344',
    accountHolder: 'PAYKAJASTIP SINGKAWANG PT',
    instructions: 'Transfer sesuai total pesanan. Unggah bukti struk/screenshot transfer Anda agar admin memverifikasi pesanan.',
  },
  virtualAccount: {
    enabled: true,
    provider: 'Bank Kalbar VA',
    vaNumber: '8801-0812-5400-001',
    instructions: 'Bayar melalui ATM Bank Kalbar atau Mobile Banking Bank Kalbar ke nomor Virtual Account di atas.',
  },
  qris: {
    enabled: true,
    merchantName: 'PAYKAJASTIP SINGKAWANG (NMID: ID102004881923)',
    qrisImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021226670016ID.CO.PAYKAJASTIP.WWW01189360099800000000015204541153033605802ID5915PAYKAJASTIP+SKW6010SINGKAWANG610579123',
    instructions: 'Scan kode QRIS menggunakan m-BCA, Livin Mandiri, GoPay, OVO, ShopeePay, Dana, atau aplikasi perbankan apa pun. Unggah bukti pembayaran.',
  },
  manualPayment: {
    enabled: true,
    cashierLocation: 'Loket Resmi PAYKAJASTIP, Jl. Budi Utomo No. 1, Singkawang Barat',
    instructions: 'Datang langsung ke loket kantor PAYKAJASTIP di Jl. Budi Utomo No. 1 untuk pembayaran tunai ke kasir.',
  },
  cod: {
    enabled: true,
    maxCodAmount: 300000,
    instructions: 'Bayar tunai pas ke kurir ketika belanjaan sampai di tempat Anda. Pastikan uang pas disiapkan.',
  },
};

const defaultMerchants: MerchantProfile[] = [
  {
    id: 'merchant-1',
    userId: 'user-merchant-1',
    storeName: 'Mie Kering Bakso Sapi Haji Aman',
    category: 'kuliner',
    address: 'Jl. Ahmad Yani No. 39, Singkawang Barat',
    subDistrict: 'Singkawang Barat',
    lat: 0.9120,
    lng: 108.9840,
    phone: '081344556677',
    rating: 4.9,
    approvalStatus: 'APPROVED',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
    description: 'Kuliner legendaris mie keriting kering bakso sapi Singkawang sejak 1985.',
    isOpen: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item-201', name: 'Mie Kering Spesial Komplit Sapi', price: 32000, description: 'Mie halus, baso urat, babat, tahu baso, kuah kaldu terpisah', isAvailable: true },
      { id: 'item-202', name: 'Mie Pangsit Bakso Goreng', price: 28000, description: 'Mie gurih dengan taburan daging cincang dan pangsit kuah', isAvailable: true },
      { id: 'item-203', name: 'Es Liang Teh Segar Khas Singkawang', price: 8000, description: 'Minuman herbal pendingin manis sejuk', isAvailable: true },
    ],
  },
  {
    id: 'merchant-2',
    userId: 'user-merchant-2',
    storeName: 'Choipan Thien Thien Lay',
    category: 'kuliner',
    address: 'Jl. Salam Diman No. 22, Singkawang Barat',
    subDistrict: 'Singkawang Barat',
    lat: 0.9070,
    lng: 108.9890,
    phone: '081255443322',
    rating: 4.8,
    approvalStatus: 'APPROVED',
    imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=600&q=80',
    description: 'Choipan kukus kulit tipis lembut khas Singkawang aneka isian.',
    isOpen: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item-301', name: 'Choipan Bengkuang Ebi (10 pcs)', price: 25000, description: 'Kulit lembut tipis, bawang putih goreng, sambal pedas', isAvailable: true },
      { id: 'item-302', name: 'Choipan Kucai Wangi (10 pcs)', price: 25000, description: 'Kucai hijau segar gurih aroma ebi', isAvailable: true },
    ],
  },
  {
    id: 'merchant-3',
    userId: 'user-merchant-3',
    storeName: 'Pasar Beringin Tradisional Singkawang',
    category: 'pasar',
    address: 'Jl. Nusantara, Singkawang Barat',
    subDistrict: 'Singkawang Barat',
    lat: 0.9055,
    lng: 108.9855,
    phone: '081288990011',
    rating: 4.7,
    approvalStatus: 'APPROVED',
    imageUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80',
    description: 'Pusat belanja sayur mayur, daging sapi/ayam segar, dan ikan pesisir Singkawang.',
    isOpen: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item-401', name: 'Paket Sayuran Segar Sup & Tumis', price: 20000, description: 'Wortel, buncis, kembang kol, sawi segar', isAvailable: true },
      { id: 'item-402', name: 'Daging Sapi Segar Pagi (500 gr)', price: 75000, description: 'Potong pagi hari, higienis & halal', isAvailable: true },
      { id: 'item-403', name: 'Ikan Tenggiri Segar (1 kg)', price: 65000, description: 'Ikan segar pesisir Singkawang', isAvailable: true },
    ],
  },
  {
    id: 'merchant-4',
    userId: 'user-merchant-4',
    storeName: 'Apotek Kimia Farma Diponegoro',
    category: 'apotek',
    address: 'Jl. P. Diponegoro No. 88, Singkawang Barat',
    subDistrict: 'Singkawang Barat',
    lat: 0.9075,
    lng: 108.9845,
    phone: '0562631234',
    rating: 4.8,
    approvalStatus: 'APPROVED',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    description: 'Layanan farmasi tebus resep dan obat bebas 24 jam.',
    isOpen: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'item-601', name: 'Tebus Resep Dokter & Obat Bebas', price: 50000, description: 'Obat sesuai foto resep atau instruksi dokter', isAvailable: true },
      { id: 'item-602', name: 'Paket Vitamin & Imun Booster', price: 42000, description: 'Multivitamin lengkap dan Vitamin C', isAvailable: true },
    ],
  },
];

const passwordHashDefault = bcrypt.hashSync('password123', 8);
const adminPasswordHash = bcrypt.hashSync('admin123', 8);

const defaultUsers: User[] = [
  {
    id: 'user-pelanggan-1',
    name: 'Rusdiana (Pelanggan)',
    email: 'rusdianaaa240@gmail.com',
    phone: '081254001122',
    role: 'pelanggan',
    approvalStatus: 'APPROVED',
    passwordHash: passwordHashDefault,
    address: 'Jl. Tani Gg. Sejahtera No. 18, Singkawang Barat',
    walletBalance: 200000,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rusdiana',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-driver-1',
    name: 'Budi Kurniawan (Driver)',
    email: 'budi.kurir@paykajastip.id',
    phone: '082155778899',
    role: 'driver',
    approvalStatus: 'APPROVED',
    passwordHash: passwordHashDefault,
    address: 'Jl. Alianyang No. 45, Singkawang Tengah',
    walletBalance: 125000,
    driverId: 'driver-1',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BudiKurir',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-driver-pending',
    name: 'Indra Gunawan (Calon Driver)',
    email: 'indra.kurir@paykajastip.id',
    phone: '085277889900',
    role: 'driver',
    approvalStatus: 'PENDING_APPROVAL',
    passwordHash: passwordHashDefault,
    address: 'Jl. Yohana Godang, Singkawang Barat',
    walletBalance: 0,
    driverId: 'driver-pending',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=IndraKurir',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-merchant-1',
    name: 'Haji Aman (Mitra Toko)',
    email: 'miehaji@paykajastip.id',
    phone: '081344556677',
    role: 'merchant',
    approvalStatus: 'APPROVED',
    passwordHash: passwordHashDefault,
    address: 'Jl. Ahmad Yani No. 39, Singkawang Barat',
    merchantStoreId: 'merchant-1',
    walletBalance: 850000,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HajiAman',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-merchant-pending',
    name: 'Acai (Calon Mitra Toko)',
    email: 'warung.acai@paykajastip.id',
    phone: '081299887766',
    role: 'merchant',
    approvalStatus: 'PENDING_APPROVAL',
    passwordHash: passwordHashDefault,
    address: 'Jl. Pasar Hongkong, Singkawang',
    merchantStoreId: 'merchant-pending',
    walletBalance: 0,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=WarungAcai',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-super-admin',
    name: 'Super Admin PaykaJastip',
    email: 'admin@paykajastip.id',
    phone: '081254007295',
    role: 'super_admin',
    approvalStatus: 'APPROVED',
    passwordHash: adminPasswordHash,
    address: 'Kantor Pusat PAYKAJASTIP, Jl. Budi Utomo No. 1, Singkawang',
    walletBalance: 5000000,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PaykaSuperAdmin',
    createdAt: new Date().toISOString(),
  },
];

const defaultDrivers: DriverProfile[] = [
  {
    id: 'driver-1',
    userId: 'user-driver-1',
    name: 'Budi Kurniawan',
    phone: '082155778899',
    motorcycleModel: 'Honda Vario 160 Hitam',
    plateNumber: 'KB 4521 CW',
    rating: 4.9,
    totalTrips: 184,
    approvalStatus: 'APPROVED',
    isOnline: true,
    isBusy: false,
    currentLat: 0.9075,
    currentLng: 108.9860,
    lastLocationUpdate: new Date().toISOString(),
    walletBalance: 125000,
  },
  {
    id: 'driver-pending',
    userId: 'user-driver-pending',
    name: 'Indra Gunawan',
    phone: '085277889900',
    motorcycleModel: 'Yamaha Mio M3 Merah',
    plateNumber: 'KB 2841 SK',
    rating: 5.0,
    totalTrips: 0,
    approvalStatus: 'PENDING_APPROVAL',
    isOnline: false,
    isBusy: false,
    currentLat: 0.9069,
    currentLng: 108.9866,
    walletBalance: 0,
  },
];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.drivers && parsed.merchants && parsed.settings) {
          parsed.settings = { ...defaultSettings, ...parsed.settings };
          if (!parsed.zones || parsed.zones.length === 0) {
            parsed.zones = defaultZones;
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed reading existing db file, using seeds', err);
    }

    const initial: DatabaseSchema = {
      users: defaultUsers,
      drivers: defaultDrivers,
      merchants: defaultMerchants,
      zones: defaultZones,
      orders: [],
      notifications: [
        {
          id: 'notif-init-1',
          userId: 'user-pelanggan-1',
          title: 'Selamat Datang di PAYKAJASTIP Singkawang!',
          message: 'Layanan jasa titip belanja & antar barang kilat terpercaya se-Kota Singkawang.',
          type: 'system',
          createdAt: new Date().toISOString(),
          read: false,
        },
      ],
      walletTransactions: [],
      auditLogs: [
        {
          id: 'audit-init-1',
          action: 'SYSTEM_INITIALIZATION',
          actorEmail: 'admin@paykajastip.id',
          actorRole: 'super_admin',
          details: 'Sistem PAYKAJASTIP diinisialisasi dengan konfigurasi operasional Singkawang',
          timestamp: new Date().toISOString(),
        },
      ],
      settings: defaultSettings,
    };

    this.saveDataDirect(initial);
    return initial;
  }

  private saveDataDirect(data: DatabaseSchema) {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed writing db file', err);
    }
  }

  public save() {
    this.saveDataDirect(this.data);
  }

  // Users & Auth
  getUsers() { return this.data.users; }
  getUserById(id: string) { return this.data.users.find(u => u.id === id); }
  getUserByEmail(email: string) { return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()); }
  addUser(user: User) {
    this.data.users.push(user);
    this.save();
    return user;
  }
  updateUser(id: string, updates: Partial<User>) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
      return this.data.users[idx];
    }
    return null;
  }

  // Drivers
  getDrivers() { return this.data.drivers; }
  getDriverById(id: string) { return this.data.drivers.find(d => d.id === id); }
  getDriverByUserId(userId: string) { return this.data.drivers.find(d => d.userId === userId); }
  addDriver(driver: DriverProfile) {
    this.data.drivers.push(driver);
    this.save();
    return driver;
  }
  updateDriver(id: string, updates: Partial<DriverProfile>) {
    const idx = this.data.drivers.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.drivers[idx] = { ...this.data.drivers[idx], ...updates };
      this.save();
      return this.data.drivers[idx];
    }
    return null;
  }

  // Merchants
  getMerchants() { return this.data.merchants; }
  getMerchantById(id: string) { return this.data.merchants.find(m => m.id === id); }
  getMerchantByUserId(userId: string) { return this.data.merchants.find(m => m.userId === userId); }
  addMerchant(merchant: MerchantProfile) {
    this.data.merchants.push(merchant);
    this.save();
    return merchant;
  }
  updateMerchant(id: string, updates: Partial<MerchantProfile>) {
    const idx = this.data.merchants.findIndex(m => m.id === id);
    if (idx !== -1) {
      this.data.merchants[idx] = { ...this.data.merchants[idx], ...updates };
      this.save();
      return this.data.merchants[idx];
    }
    return null;
  }

  // Orders
  getOrders() { return this.data.orders; }
  getOrderById(id: string) { return this.data.orders.find(o => o.id === id); }
  addOrder(order: Order) {
    this.data.orders.unshift(order);
    this.save();
    return order;
  }
  updateOrder(id: string, updates: Partial<Order>) {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.data.orders[idx] = { ...this.data.orders[idx], ...updates, updatedAt: new Date().toISOString() };
      this.save();
      return this.data.orders[idx];
    }
    return null;
  }

  // Zones & Settings
  getZones() { return this.data.zones; }
  updateZone(id: string, updates: Partial<SubDistrictZone>) {
    const idx = this.data.zones.findIndex(z => z.id === id);
    if (idx !== -1) {
      this.data.zones[idx] = { ...this.data.zones[idx], ...updates };
      this.save();
      return this.data.zones[idx];
    }
    return null;
  }
  getSettings() { return this.data.settings; }
  updateSettings(updates: Partial<AppSettings>) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  // Audit Logs
  getAuditLogs() { return this.data.auditLogs; }
  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.data.auditLogs.unshift(entry);
    this.save();
    return entry;
  }

  // Notifications
  getNotifications(userId?: string) {
    if (!userId) return this.data.notifications;
    return this.data.notifications.filter(n => !n.userId || n.userId === userId);
  }
  addNotification(item: NotificationItem) {
    this.data.notifications.unshift(item);
    this.save();
    return item;
  }
  markNotificationRead(id: string) {
    const item = this.data.notifications.find(n => n.id === id);
    if (item) {
      item.read = true;
      this.save();
    }
  }

  // Wallet
  getWalletTransactions(userId: string) {
    return this.data.walletTransactions.filter(t => t.userId === userId);
  }
  addWalletTransaction(tx: WalletTransaction) {
    this.data.walletTransactions.unshift(tx);
    this.save();
    return tx;
  }
}

export const db = new Database();
