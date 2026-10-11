export type UserRole = 'pelanggan' | 'driver' | 'merchant' | 'super_admin' | 'guest';

export type AccountApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  approvalStatus: AccountApprovalStatus;
  passwordHash?: string;
  address?: string;
  walletBalance: number;
  avatarUrl?: string;
  merchantStoreId?: string;
  driverId?: string;
  createdAt: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  motorcycleModel: string;
  plateNumber: string;
  rating: number;
  totalTrips: number;
  approvalStatus: AccountApprovalStatus;
  isOnline: boolean;
  isBusy: boolean;
  currentLat: number;
  currentLng: number;
  lastLocationUpdate?: string;
  walletBalance: number;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  storeName: string;
  name?: string;
  category: 'kuliner' | 'pasar' | 'oleholeh' | 'apotek' | 'retail';
  address: string;
  subDistrict: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number;
  approvalStatus: AccountApprovalStatus;
  imageUrl: string;
  description?: string;
  isOpen: boolean;
  items: StoreItem[];
  popularItems?: StoreItem[];
  createdAt: string;
}

export interface StoreItem {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export type OrderServiceType =
  | 'jastip_makanan'
  | 'jastip_pasar'
  | 'antar_barang'
  | 'tebus_obat'
  | 'jastip_custom';

export type OrderStatus =
  | 'MENUNGGU_PEMBAYARAN'
  | 'MENUNGGU_DRIVER'
  | 'DITAWARKAN_KE_DRIVER'
  | 'DRIVER_MENUJU_LOKASI'
  | 'SEDANG_DIBELANJAKAN'
  | 'SEDANG_DIANTAR'
  | 'SELESAI'
  | 'DIBATALKAN';

export type PaymentMethod =
  | 'TRANSFER_BANK'
  | 'VIRTUAL_ACCOUNT'
  | 'QRIS'
  | 'MANUAL'
  | 'COD'
  | 'PAYKAPAY';

export type StoreCatalog = MerchantProfile;

export type PaymentStatus =
  | 'PENDING'
  | 'WAITING_VERIFICATION'
  | 'PAID'
  | 'REJECTED';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  serviceType: OrderServiceType;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  googleMapsUrl?: string;
  deliveryAddress: string;
  deliverySubDistrict: string;
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: number;
  items: OrderItem[];
  shoppingEstimatedCost: number;
  shippingFee: number;
  jastipFee: number;
  isExpress: boolean;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentProofUrl?: string;
  paymentNotes?: string;
  status: OrderStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  driverLat?: number;
  driverLng?: number;
  driverLastLocationUpdate?: string;
  currentOfferDriverId?: string;
  offerExpiresAt?: string;
  rejectedDriverIds?: string[];
  customerNotes?: string;
  driverShoppingReceiptUrl?: string;
  merchantStoreId?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SubDistrictZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  baseDeliveryFee: number;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  roleTarget?: UserRole;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'driver' | 'system';
  orderId?: string;
  createdAt: string;
  read: boolean;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'TOPUP' | 'PAYMENT' | 'EARNING' | 'REFUND';
  amount: number;
  description: string;
  status: 'SUCCESS' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  timestamp: string;
}

export interface BankTransferConfig {
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

export interface VirtualAccountConfig {
  enabled: boolean;
  provider: string;
  vaNumber: string;
  instructions: string;
}

export interface QRISConfig {
  enabled: boolean;
  merchantName: string;
  qrisImageUrl: string;
  instructions: string;
}

export interface ManualPaymentConfig {
  enabled: boolean;
  cashierLocation: string;
  instructions: string;
}

export interface CODConfig {
  enabled: boolean;
  maxCodAmount: number;
  instructions: string;
}

export interface AppSettings {
  appName?: string;
  appTagline?: string;
  baseFare: number;
  perKmFare: number;
  expressSurcharge: number;
  defaultJastipFee: number;
  operationalCity: string;
  contactSupportPhone: string;
  whatsappAdmin: string;
  logoUrl: string;
  bankTransfer: BankTransferConfig;
  virtualAccount: VirtualAccountConfig;
  qris: QRISConfig;
  manualPayment: ManualPaymentConfig;
  cod: CODConfig;
}
