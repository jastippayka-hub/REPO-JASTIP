import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import {
  User,
  UserRole,
  DriverProfile,
  MerchantProfile,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderServiceType,
} from '../src/types/index.js';

export const apiRouter = Router();

// ================= AUTH TOKEN HELPERS =================
interface AuthenticatedRequest extends Request {
  user?: User;
}

function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    time: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token autentikasi tidak ditemukan. Silakan login kembali.' });
  }

  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    const user = db.getUserById(parsed.userId);

    if (!user) {
      return res.status(401).json({ error: 'Pengguna tidak valid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });
  }
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak: role '${req.user.role}' tidak memiliki izin untuk fitur ini.`,
      });
    }
    next();
  };
}

function requireApproved(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Autentikasi diperlukan.' });
  if (req.user.approvalStatus !== 'APPROVED') {
    return res.status(403).json({
      error: 'Akun Anda masih berstatus MENUNGGU PERSETUJUAN Super Admin. Harap tunggu verifikasi operator.',
      approvalStatus: req.user.approvalStatus,
    });
  }
  next();
}

// Distance helper using Haversine formula (km)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Auto dispatch helper
function dispatchOrderToNearestDriver(orderId: string): boolean {
  const order = db.getOrderById(orderId);
  if (!order) return false;

  const rejected = order.rejectedDriverIds || [];

  // Filter approved, online, unbusy drivers
  const candidates = db
    .getDrivers()
    .filter(d => d.approvalStatus === 'APPROVED' && d.isOnline && !d.isBusy && !rejected.includes(d.id));

  if (candidates.length === 0) {
    db.updateOrder(orderId, {
      status: 'MENUNGGU_DRIVER',
      currentOfferDriverId: undefined,
      offerExpiresAt: undefined,
    });

    db.addNotification({
      id: `notif-${Date.now()}-nodriver`,
      userId: order.userId,
      title: 'Menunggu Kurir Singkawang',
      message: `Pesanan ${order.orderNumber} sedang menunggu kurir yang tersedia di area Singkawang.`,
      type: 'order',
      orderId: order.id,
      createdAt: new Date().toISOString(),
      read: false,
    });
    return false;
  }

  // Sort by distance to store
  candidates.sort((a, b) => {
    const distA = calculateDistanceKm(a.currentLat, a.currentLng, order.storeLat, order.storeLng);
    const distB = calculateDistanceKm(b.currentLat, b.currentLng, order.storeLat, order.storeLng);
    return distA - distB;
  });

  const selectedDriver = candidates[0];
  const dist = calculateDistanceKm(
    selectedDriver.currentLat,
    selectedDriver.currentLng,
    order.storeLat,
    order.storeLng
  );

  db.updateOrder(orderId, {
    status: 'DITAWARKAN_KE_DRIVER',
    currentOfferDriverId: selectedDriver.id,
    offerExpiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
  });

  // Notify driver
  db.addNotification({
    id: `notif-${Date.now()}-offer`,
    userId: selectedDriver.userId,
    title: 'Tawaran Orderan Jastip Baru!',
    message: `Ada orderan dari ${order.storeName} ke ${order.deliveryAddress} (~${dist} km). Buka portal driver untuk menerima.`,
    type: 'driver',
    orderId: order.id,
    createdAt: new Date().toISOString(),
    read: false,
  });

  return true;
}

// ================= AUTHENTICATION ROUTES =================
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { name, email, phone, password, role, address, motorcycleModel, plateNumber, storeName, storeCategory } =
    req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Nama, email, no HP, dan password wajib diisi.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Email sudah terdaftar dalam sistem.' });
  }

  const selectedRole: UserRole = (role as UserRole) || 'pelanggan';
  // Customers are approved automatically; drivers and merchants must be approved by Super Admin
  const approvalStatus = selectedRole === 'pelanggan' ? 'APPROVED' : 'PENDING_APPROVAL';

  const passwordHash = bcrypt.hashSync(password, 8);
  const userId = `user-${Date.now()}`;

  const newUser: User = {
    id: userId,
    name,
    email,
    phone,
    role: selectedRole,
    approvalStatus,
    passwordHash,
    address: address || 'Singkawang, Kalimantan Barat',
    walletBalance: selectedRole === 'pelanggan' ? 25000 : 0,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    createdAt: new Date().toISOString(),
  };

  if (selectedRole === 'driver') {
    const driverId = `driver-${Date.now()}`;
    newUser.driverId = driverId;
    db.addDriver({
      id: driverId,
      userId,
      name,
      phone,
      motorcycleModel: motorcycleModel || 'Honda Vario 160',
      plateNumber: plateNumber || 'KB 4521 SK',
      rating: 5.0,
      totalTrips: 0,
      approvalStatus,
      isOnline: false,
      isBusy: false,
      currentLat: 0.9069,
      currentLng: 108.9866,
      walletBalance: 0,
    });
  }

  if (selectedRole === 'merchant') {
    const merchantId = `merchant-${Date.now()}`;
    newUser.merchantStoreId = merchantId;
    db.addMerchant({
      id: merchantId,
      userId,
      storeName: storeName || `Toko ${name}`,
      category: storeCategory || 'kuliner',
      address: address || 'Singkawang Barat, Kalimantan Barat',
      subDistrict: 'Singkawang Barat',
      lat: 0.9080,
      lng: 108.9870,
      phone,
      rating: 5.0,
      approvalStatus,
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      description: `Mitra toko resmi ${name} di Singkawang`,
      isOpen: false,
      items: [],
      createdAt: new Date().toISOString(),
    });
  }

  db.addUser(newUser);

  db.addAuditLog({
    action: 'USER_REGISTERED',
    actorEmail: email,
    actorRole: selectedRole,
    details: `Pengguna mendaftar dengan role ${selectedRole} (Status: ${approvalStatus})`,
  });

  const { passwordHash: _, ...safeUser } = newUser;
  const token = generateToken(newUser);
  res.status(201).json({ user: safeUser, token });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }

  const user = db.getUserByEmail(email);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }

  const { passwordHash: _, ...safeUser } = user;
  const token = generateToken(user);
  res.json({ user: safeUser, token });
});

apiRouter.post('/auth/guest', (req: Request, res: Response) => {
  const { name, phone, address } = req.body;
  const guestName = (name && name.trim()) || 'Tamu Singkawang';
  const guestPhone = (phone && phone.trim()) || '0812' + Math.floor(10000000 + Math.random() * 90000000);
  const guestUser: User = {
    id: `guest-${Date.now()}`,
    name: guestName,
    email: `guest-${Date.now()}@paykajastip.id`,
    phone: guestPhone,
    role: 'pelanggan',
    approvalStatus: 'APPROVED',
    walletBalance: 0,
    address: address || 'Singkawang, Kalimantan Barat',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=Guest${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  db.addUser(guestUser);
  const token = generateToken(guestUser);

  db.addAuditLog({
    action: 'GUEST_SESSION_CREATED',
    actorEmail: guestUser.email,
    actorRole: 'pelanggan',
    details: `Sesi Tamu (Guest) dibuat untuk ${guestName} (${guestPhone})`,
  });

  res.status(201).json({ user: guestUser, token });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  res.json({ user: safeUser });
});

// ================= ORDERS ROUTE WITH STRICT RBAC =================
apiRouter.get('/orders', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let all = db.getOrders();

  // Strict RBAC:
  // - Pelanggan only sees their own orders
  // - Driver only sees orders assigned to them OR currently offered to them
  // - Merchant only sees orders where merchantStoreId or store matches
  // - Super Admin sees all orders
  if (user.role === 'pelanggan') {
    all = all.filter(o => o.userId === user.id);
  } else if (user.role === 'driver') {
    const driver = db.getDriverByUserId(user.id);
    if (!driver) return res.json([]);
    all = all.filter(
      o => o.driverId === driver.id || o.currentOfferDriverId === driver.id || (o.status === 'MENUNGGU_DRIVER' && driver.approvalStatus === 'APPROVED')
    );
  } else if (user.role === 'merchant') {
    const merchant = db.getMerchantByUserId(user.id);
    if (!merchant) return res.json([]);
    all = all.filter(o => o.merchantStoreId === merchant.id || o.storeName.toLowerCase() === merchant.storeName.toLowerCase());
  }

  res.json(all);
});

apiRouter.get('/orders/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  const user = req.user!;
  // RBAC checks
  if (user.role === 'pelanggan' && order.userId !== user.id) {
    return res.status(403).json({ error: 'Akses ditolak: bukan pesanan Anda.' });
  }
  if (user.role === 'driver') {
    const driver = db.getDriverByUserId(user.id);
    if (order.driverId !== driver?.id && order.currentOfferDriverId !== driver?.id) {
      return res.status(403).json({ error: 'Akses ditolak: pesanan ini bukan tugas Anda.' });
    }
  }

  res.json(order);
});

// Create Order (ONLY PELANGGAN & SUPER_ADMIN ALLOWED)
// DRIVER and MERCHANT are strictly forbidden!
apiRouter.post('/orders', authenticateToken, requireRole(['pelanggan', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const {
    storeName,
    storeAddress,
    storeLat,
    storeLng,
    googleMapsUrl,
    deliveryAddress,
    deliverySubDistrict,
    deliveryLat,
    deliveryLng,
    serviceType,
    items,
    customerNotes,
    isExpress,
    paymentMethod,
    merchantStoreId,
  } = req.body;

  if (!storeName || !deliveryAddress || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Nama toko, alamat tujuan, dan barang titipan wajib diisi.' });
  }

  const settings = db.getSettings();

  // Calculate distance
  const storeLatitude = parseFloat(storeLat) || 0.9080;
  const storeLongitude = parseFloat(storeLng) || 108.9870;
  const destLatitude = parseFloat(deliveryLat) || 0.9040;
  const destLongitude = parseFloat(deliveryLng) || 108.9820;

  const distKm = Math.max(0.5, calculateDistanceKm(storeLatitude, storeLongitude, destLatitude, destLongitude));

  // Tariff calculation from admin settings
  let shippingFee = settings.baseFare;
  if (distKm > 2) {
    shippingFee += Math.round((distKm - 2) * settings.perKmFare);
  }

  let jastipFee = settings.defaultJastipFee;
  if (serviceType === 'jastip_pasar') jastipFee = 8000;
  else if (serviceType === 'antar_barang') jastipFee = 3000;
  else if (serviceType === 'jastip_custom') jastipFee = 7000;
  else if (serviceType === 'tebus_obat') jastipFee = 5000;

  if (isExpress) {
    shippingFee += settings.expressSurcharge;
  }

  const shoppingCost = items.reduce(
    (sum: number, it: any) => sum + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1),
    0
  );

  const totalAmount = shoppingCost + shippingFee + jastipFee;

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randSeq = Math.floor(100 + Math.random() * 900);
  const orderNumber = `PK-SKW-${todayStr}-${randSeq}`;

  const selectedPaymentMethod: PaymentMethod = (paymentMethod as PaymentMethod) || 'QRIS';

  // Payment status is always PENDING initially (even for COD, will be PAID on delivery)
  const initialPaymentStatus: PaymentStatus = 'PENDING';

  // COD orders proceed directly to driver assignment
  const initialOrderStatus: OrderStatus = 'MENUNGGU_DRIVER';

  const newOrder: Order = {
    id: `order-${Date.now()}`,
    orderNumber,
    userId: user.id,
    customerName: user.name,
    customerPhone: user.phone,
    serviceType: (serviceType as OrderServiceType) || 'jastip_makanan',
    storeName,
    storeAddress,
    storeLat: storeLatitude,
    storeLng: storeLongitude,
    googleMapsUrl: googleMapsUrl || undefined,
    deliveryAddress,
    deliverySubDistrict: deliverySubDistrict || 'Singkawang Barat',
    deliveryLat: destLatitude,
    deliveryLng: destLongitude,
    distanceKm: distKm,
    items,
    shoppingEstimatedCost: shoppingCost,
    shippingFee,
    jastipFee,
    isExpress: !!isExpress,
    totalAmount,
    paymentMethod: selectedPaymentMethod,
    paymentStatus: initialPaymentStatus,
    status: initialOrderStatus,
    customerNotes: customerNotes || '',
    merchantStoreId: merchantStoreId || undefined,
    rejectedDriverIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.addOrder(newOrder);

  // Dispatch to nearest available driver
  dispatchOrderToNearestDriver(newOrder.id);

  db.addAuditLog({
    action: 'ORDER_CREATED',
    actorEmail: user.email,
    actorRole: user.role,
    details: `Pesanan ${newOrder.orderNumber} senilai Rp ${totalAmount.toLocaleString('id-ID')} dibuat oleh ${user.name}`,
  });

  res.status(201).json(newOrder);
});

// Driver responds to offered order
apiRouter.post('/orders/:id/driver-response', authenticateToken, requireRole(['driver']), requireApproved, (req: AuthenticatedRequest, res: Response) => {
  const { accepted } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  const driver = db.getDriverByUserId(req.user!.id);
  if (!driver) return res.status(404).json({ error: 'Profil kurir tidak ditemukan.' });

  // Atomic lock check: verify this order is indeed offered to this driver
  if (order.currentOfferDriverId !== driver.id && order.driverId !== driver.id) {
    return res.status(400).json({ error: 'Tawaran ini telah kedaluwarsa atau dialihkan ke kurir lain.' });
  }

  if (accepted) {
    // Lock assignment
    db.updateOrder(order.id, {
      status: 'DRIVER_MENUJU_LOKASI',
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      driverPlate: driver.plateNumber,
      driverLat: driver.currentLat,
      driverLng: driver.currentLng,
      driverLastLocationUpdate: new Date().toISOString(),
      currentOfferDriverId: undefined,
      offerExpiresAt: undefined,
    });

    db.updateDriver(driver.id, { isBusy: true });

    db.addNotification({
      id: `notif-${Date.now()}-accepted`,
      userId: order.userId,
      title: 'Kurir Menuju Toko!',
      message: `Kurir ${driver.name} (${driver.plateNumber}) menerima pesanan dan sedang meluncur ke ${order.storeName}.`,
      type: 'driver',
      orderId: order.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    res.json({ success: true, message: 'Pesanan berhasil diambil.', order: db.getOrderById(order.id) });
  } else {
    // Rejected: add to rejected list and re-dispatch
    const currentRejected = order.rejectedDriverIds || [];
    currentRejected.push(driver.id);

    db.updateOrder(order.id, {
      rejectedDriverIds: currentRejected,
      currentOfferDriverId: undefined,
      offerExpiresAt: undefined,
    });

    dispatchOrderToNearestDriver(order.id);

    res.json({ success: true, message: 'Tawaran ditolak, mencari kurir lain.' });
  }
});

// Driver updates order status (Menuju Toko -> Mulai Belanja -> Sedang Diantar -> Selesai)
apiRouter.patch('/orders/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { status, receiptUrl, cancellationReason } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  const user = req.user!;
  const driver = db.getDriverByUserId(user.id);

  // Authorization check: only assigned driver or super admin can update fulfillment status
  if (user.role !== 'super_admin' && order.driverId !== driver?.id) {
    return res.status(403).json({ error: 'Anda bukan kurir yang ditugaskan untuk pesanan ini.' });
  }

  const updates: Partial<Order> = {
    status: status as OrderStatus,
  };

  if (receiptUrl) updates.driverShoppingReceiptUrl = receiptUrl;
  if (cancellationReason) updates.cancellationReason = cancellationReason;

  if (status === 'SELESAI') {
    updates.completedAt = new Date().toISOString();

    // If COD, mark payment as PAID upon delivery confirmation
    if (order.paymentMethod === 'COD') {
      updates.paymentStatus = 'PAID';
    }

    // Driver receives trip earnings
    if (order.driverId) {
      const assignedDriver = db.getDriverById(order.driverId);
      if (assignedDriver) {
        const earnings = Math.round(order.shippingFee * 0.85 + order.jastipFee * 0.7);
        db.updateDriver(assignedDriver.id, {
          isBusy: false,
          walletBalance: assignedDriver.walletBalance + earnings,
          totalTrips: assignedDriver.totalTrips + 1,
        });

        db.addWalletTransaction({
          id: `tx-${Date.now()}`,
          userId: assignedDriver.userId,
          type: 'EARNING',
          amount: earnings,
          description: `Upah antar pesanan ${order.orderNumber} (85% ongkir + 70% fee jastip)`,
          status: 'SUCCESS',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  if (status === 'DIBATALKAN' && order.driverId) {
    const assignedDriver = db.getDriverById(order.driverId);
    if (assignedDriver) db.updateDriver(assignedDriver.id, { isBusy: false });
  }

  const updatedOrder = db.updateOrder(order.id, updates);

  db.addAuditLog({
    action: 'ORDER_STATUS_UPDATED',
    actorEmail: user.email,
    actorRole: user.role,
    details: `Status pesanan ${order.orderNumber} diubah menjadi ${status}`,
  });

  res.json(updatedOrder);
});

// ================= DRIVER REAL LOCATION ENDPOINTS =================
// Only the driver themselves or admin can update GPS coordinates!
apiRouter.post('/drivers/:id/location', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const driver = db.getDriverById(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Kurir tidak ditemukan.' });

  const user = req.user!;
  if (user.role !== 'super_admin' && user.driverId !== driver.id) {
    return res.status(403).json({ error: 'Anda hanya dapat memperbarui lokasi perangkat Anda sendiri.' });
  }

  const { lat, lng } = req.body;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'Koordinat GPS latitude dan longitude tidak valid.' });
  }

  const now = new Date().toISOString();
  const updatedDriver = db.updateDriver(driver.id, {
    currentLat: latitude,
    currentLng: longitude,
    lastLocationUpdate: now,
  });

  // Update active orders where this driver is currently delivering
  const activeOrders = db
    .getOrders()
    .filter(o => o.driverId === driver.id && !['SELESAI', 'DIBATALKAN'].includes(o.status));

  for (const o of activeOrders) {
    db.updateOrder(o.id, {
      driverLat: latitude,
      driverLng: longitude,
      driverLastLocationUpdate: now,
    });
  }

  res.json(updatedDriver);
});

apiRouter.patch('/drivers/:id/status', authenticateToken, requireRole(['driver', 'super_admin']), requireApproved, (req: AuthenticatedRequest, res: Response) => {
  const driver = db.getDriverById(req.params.id);
  if (!driver) return res.status(404).json({ error: 'Driver tidak ditemukan.' });

  const { isOnline } = req.body;
  const updated = db.updateDriver(driver.id, { isOnline: !!isOnline });
  res.json(updated);
});

apiRouter.get('/drivers', authenticateToken, requireRole(['super_admin', 'driver']), (req: AuthenticatedRequest, res: Response) => {
  res.json(db.getDrivers());
});

// ================= PAYMENTS & VERIFICATION =================
// Customer uploads proof of payment
apiRouter.post('/orders/:id/upload-payment-proof', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  const { proofUrl, notes } = req.body;
  if (!proofUrl) return res.status(400).json({ error: 'Tautan bukti pembayaran diperlukan.' });

  // IMPORTANT: DO NOT change paymentStatus to PAID automatically!
  // It must be marked WAITING_VERIFICATION until admin verifies it.
  const updated = db.updateOrder(order.id, {
    paymentProofUrl: proofUrl,
    paymentNotes: notes || '',
    paymentStatus: 'WAITING_VERIFICATION',
  });

  db.addNotification({
    id: `notif-${Date.now()}-paymentproof`,
    roleTarget: 'super_admin',
    title: 'Bukti Pembayaran Baru Diunggah',
    message: `Pelanggan telah mengunggah bukti transfer untuk pesanan ${order.orderNumber}. Harap verifikasi.`,
    type: 'payment',
    orderId: order.id,
    createdAt: new Date().toISOString(),
    read: false,
  });

  db.addAuditLog({
    action: 'PAYMENT_PROOF_UPLOADED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Bukti transfer diunggah untuk ${order.orderNumber}. Menunggu verifikasi admin.`,
  });

  res.json(updated);
});

// Admin verifies payment (LUNAS / DITOLAK)
apiRouter.post('/orders/:id/verify-payment', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { isApproved, reason } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  const newStatus: PaymentStatus = isApproved ? 'PAID' : 'REJECTED';
  const updated = db.updateOrder(order.id, {
    paymentStatus: newStatus,
    paymentNotes: reason || (isApproved ? 'Pembayaran telah diverifikasi sah oleh admin.' : 'Bukti pembayaran tidak sesuai atau tidak sah.'),
  });

  db.addNotification({
    id: `notif-${Date.now()}-payverif`,
    userId: order.userId,
    title: isApproved ? 'Pembayaran Terverifikasi (LUNAS)' : 'Pembayaran Ditolak',
    message: isApproved
      ? `Pembayaran Rp ${order.totalAmount.toLocaleString('id-ID')} untuk ${order.orderNumber} telah diverifikasi admin.`
      : `Pembayaran ${order.orderNumber} ditolak: ${reason || 'Silakan unggah ulang bukti yang sah.'}`,
    type: 'payment',
    orderId: order.id,
    createdAt: new Date().toISOString(),
    read: false,
  });

  db.addAuditLog({
    action: 'PAYMENT_VERIFIED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Admin memverifikasi pembayaran pesanan ${order.orderNumber} menjadi ${newStatus}`,
  });

  res.json(updated);
});

// ================= MERCHANTS & CATALOG ROUTES =================
apiRouter.get('/stores', (_req: Request, res: Response) => {
  // Publicly readable stores list (only approved and open stores)
  const merchants = db.getMerchants().filter(m => m.approvalStatus === 'APPROVED');
  res.json(merchants);
});

apiRouter.get('/stores/:id', (req: Request, res: Response) => {
  const merchant = db.getMerchantById(req.params.id);
  if (!merchant) return res.status(404).json({ error: 'Toko mitra tidak ditemukan.' });
  res.json(merchant);
});

// Merchant dashboard: manage store
apiRouter.get('/merchant/my-store', authenticateToken, requireRole(['merchant']), (req: AuthenticatedRequest, res: Response) => {
  const merchant = db.getMerchantByUserId(req.user!.id);
  if (!merchant) return res.status(404).json({ error: 'Toko belum terhubung dengan akun ini.' });
  res.json(merchant);
});

apiRouter.patch('/merchant/my-store', authenticateToken, requireRole(['merchant']), (req: AuthenticatedRequest, res: Response) => {
  const merchant = db.getMerchantByUserId(req.user!.id);
  if (!merchant) return res.status(404).json({ error: 'Toko tidak ditemukan.' });

  const updated = db.updateMerchant(merchant.id, req.body);
  res.json(updated);
});

apiRouter.post('/merchant/items', authenticateToken, requireRole(['merchant']), requireApproved, (req: AuthenticatedRequest, res: Response) => {
  const merchant = db.getMerchantByUserId(req.user!.id);
  if (!merchant) return res.status(404).json({ error: 'Toko tidak ditemukan.' });

  const { name, price, description, imageUrl } = req.body;
  if (!name || isNaN(parseFloat(price))) {
    return res.status(400).json({ error: 'Nama dan harga menu wajib diisi.' });
  }

  const newItem = {
    id: `item-${Date.now()}`,
    name,
    price: parseFloat(price),
    description: description || '',
    imageUrl: imageUrl || '',
    isAvailable: true,
  };

  merchant.items.push(newItem);
  db.save();
  res.status(201).json(newItem);
});

apiRouter.delete('/merchant/items/:itemId', authenticateToken, requireRole(['merchant']), (req: AuthenticatedRequest, res: Response) => {
  const merchant = db.getMerchantByUserId(req.user!.id);
  if (!merchant) return res.status(404).json({ error: 'Toko tidak ditemukan.' });

  merchant.items = merchant.items.filter(i => i.id !== req.params.itemId);
  db.save();
  res.json({ success: true });
});

// ================= ADMIN MANAGEMENT & APPROVALS =================
apiRouter.get('/admin/pending-approvals', authenticateToken, requireRole(['super_admin']), (_req: Request, res: Response) => {
  const pendingDrivers = db.getDrivers().filter(d => d.approvalStatus === 'PENDING_APPROVAL');
  const pendingMerchants = db.getMerchants().filter(m => m.approvalStatus === 'PENDING_APPROVAL');
  res.json({ pendingDrivers, pendingMerchants });
});

apiRouter.post('/admin/approve-user', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { targetType, targetId, isApproved } = req.body;
  const status = isApproved ? 'APPROVED' : 'REJECTED';

  if (targetType === 'driver') {
    const driver = db.getDriverById(targetId);
    if (!driver) return res.status(404).json({ error: 'Driver tidak ditemukan.' });
    db.updateDriver(driver.id, { approvalStatus: status });
    db.updateUser(driver.userId, { approvalStatus: status });
    db.addNotification({
      id: `notif-${Date.now()}`,
      userId: driver.userId,
      title: isApproved ? 'Akun Driver Telah Disetujui!' : 'Pengajuan Driver Ditolak',
      message: isApproved
        ? 'Selamat, akun driver Anda telah diverifikasi oleh Super Admin. Anda sekarang dapat mulai menerima orderan.'
        : 'Mohon maaf, pengajuan pendaftaran driver Anda tidak dapat disetujui.',
      type: 'system',
      createdAt: new Date().toISOString(),
      read: false,
    });
  } else if (targetType === 'merchant') {
    const merchant = db.getMerchantById(targetId);
    if (!merchant) return res.status(404).json({ error: 'Merchant tidak ditemukan.' });
    db.updateMerchant(merchant.id, { approvalStatus: status, isOpen: isApproved });
    db.updateUser(merchant.userId, { approvalStatus: status });
    db.addNotification({
      id: `notif-${Date.now()}`,
      userId: merchant.userId,
      title: isApproved ? 'Toko Mitra Telah Disetujui!' : 'Pengajuan Toko Ditolak',
      message: isApproved
        ? 'Toko Anda telah disetujui dan aktif di katalog PAYKAJASTIP Singkawang.'
        : 'Pengajuan toko mitra belum disetujui.',
      type: 'system',
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  db.addAuditLog({
    action: 'APPROVAL_PROCESSED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Super Admin memproses persetujuan ${targetType} ID ${targetId} -> ${status}`,
  });

  res.json({ success: true, status });
});

// ================= GENERAL SETTINGS (APP, TARIFF, ETC) =================
apiRouter.get('/settings', (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

apiRouter.patch('/settings', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Data pengaturan tidak valid.' });
  }

  const updatedSettings = db.updateSettings(updates);

  db.addAuditLog({
    action: 'SETTINGS_UPDATED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: 'Pengaturan umum aplikasi & tarif PAYKAJASTIP diperbarui oleh Super Admin',
  });

  res.json({ success: true, settings: updatedSettings });
});

// Zones Settings
apiRouter.get('/settings/zones', (_req: Request, res: Response) => {
  res.json(db.getZones());
});

apiRouter.patch('/settings/zones/:id', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const updated = db.updateZone(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Zona kecamatan tidak ditemukan.' });
  }

  db.addAuditLog({
    action: 'ZONE_TARIFF_UPDATED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Tarif zona ${updated.name} diperbarui menjadi Rp ${updated.baseDeliveryFee}`,
  });

  res.json({ success: true, zone: updated });
});

// Admin Driver Management: List & Update Drivers
apiRouter.get('/admin/drivers', authenticateToken, requireRole(['super_admin']), (_req: Request, res: Response) => {
  res.json(db.getDrivers());
});

apiRouter.patch('/admin/drivers/:id', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const driver = db.getDriverById(id);
  if (!driver) return res.status(404).json({ error: 'Driver tidak ditemukan.' });

  const updates = req.body;
  const updated = db.updateDriver(id, updates);
  if (updates.approvalStatus) {
    db.updateUser(driver.userId, { approvalStatus: updates.approvalStatus });
  }

  db.addAuditLog({
    action: 'DRIVER_UPDATED_BY_ADMIN',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Profil kurir ${driver.name} diperbarui oleh Super Admin`,
  });

  res.json({ success: true, driver: updated });
});

// Driver uploads shopping receipt
apiRouter.post('/orders/:id/receipt', authenticateToken, requireRole(['driver']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { receiptUrl, notes, totalReceiptCost } = req.body;
  const order = db.getOrderById(id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

  if (!receiptUrl) return res.status(400).json({ error: 'Foto bukti struk belanja wajib disertakan.' });

  const updated = db.updateOrder(id, {
    driverShoppingReceiptUrl: receiptUrl,
    status: 'SEDANG_DIANTAR',
  });

  db.addNotification({
    id: `notif-${Date.now()}-receipt`,
    userId: order.userId,
    title: 'Struk Belanja Diunggah!',
    message: `Kurir telah selesai berbelanja di ${order.storeName} dan mengunggah struk nota. Belanjaan sedang dalam perjalanan ke lokasi Anda!`,
    type: 'order',
    orderId: order.id,
    createdAt: new Date().toISOString(),
    read: false,
  });

  db.addAuditLog({
    action: 'RECEIPT_UPLOADED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Struk belanja pesanan ${order.orderNumber} diunggah oleh kurir`,
  });

  res.json({ success: true, order: updated });
});

// Settings: WhatsApp
apiRouter.get('/settings/whatsapp', (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({ whatsappAdmin: settings.whatsappAdmin });
});

apiRouter.patch('/settings/whatsapp', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { whatsappAdmin } = req.body;
  if (!whatsappAdmin || typeof whatsappAdmin !== 'string') {
    return res.status(400).json({ error: 'Nomor WhatsApp admin wajib diisi.' });
  }

  // Sanitize and validate phone format
  const sanitized = whatsappAdmin.replace(/[^0-9]/g, '');
  if (sanitized.length < 9 || sanitized.length > 15) {
    return res.status(400).json({ error: 'Format nomor WhatsApp tidak valid (contoh: 081254007295).' });
  }

  db.updateSettings({ whatsappAdmin: sanitized });

  db.addAuditLog({
    action: 'SETTING_WHATSAPP_UPDATED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Nomor WhatsApp Admin diperbarui menjadi ${sanitized}`,
  });

  res.json({ success: true, whatsappAdmin: sanitized });
});

// Settings: Logo
apiRouter.get('/settings/logo', (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({ logoUrl: settings.logoUrl });
});

apiRouter.post('/settings/logo', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { logoUrl } = req.body;
  if (!logoUrl) return res.status(400).json({ error: 'URL atau data gambar logo diperlukan.' });

  db.updateSettings({ logoUrl });

  db.addAuditLog({
    action: 'SETTING_LOGO_UPDATED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Logo PAYKAJASTIP diperbarui oleh Super Admin`,
  });

  res.json({ success: true, logoUrl });
});

// Settings: 5 Separated Payment Methods
apiRouter.get('/settings/payment', (_req: Request, res: Response) => {
  const s = db.getSettings();
  res.json({
    bankTransfer: s.bankTransfer,
    virtualAccount: s.virtualAccount,
    qris: s.qris,
    manualPayment: s.manualPayment,
    cod: s.cod,
  });
});

apiRouter.patch('/settings/payment/:method', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { method } = req.params;
  const updates = req.body;
  const current = db.getSettings();

  if (method === 'bank-transfer') {
    current.bankTransfer = { ...current.bankTransfer, ...updates };
  } else if (method === 'virtual-account') {
    current.virtualAccount = { ...current.virtualAccount, ...updates };
  } else if (method === 'qris') {
    current.qris = { ...current.qris, ...updates };
  } else if (method === 'manual') {
    current.manualPayment = { ...current.manualPayment, ...updates };
  } else if (method === 'cod') {
    current.cod = { ...current.cod, ...updates };
  } else {
    return res.status(400).json({ error: 'Metode pembayaran tidak valid.' });
  }

  db.updateSettings(current);

  db.addAuditLog({
    action: 'PAYMENT_SETTING_UPDATED',
    actorEmail: req.user!.email,
    actorRole: req.user!.role,
    details: `Konfigurasi pembayaran '${method}' diperbarui oleh Super Admin`,
  });

  res.json({ success: true, settings: current });
});

// Admin Reports with Date Filtering
apiRouter.get('/admin/reports', authenticateToken, requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  let orders = db.getOrders();

  if (startDate) {
    const start = new Date(String(startDate)).getTime();
    orders = orders.filter(o => new Date(o.createdAt).getTime() >= start);
  }
  if (endDate) {
    const end = new Date(String(endDate)).getTime();
    orders = orders.filter(o => new Date(o.createdAt).getTime() <= end);
  }

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'SELESAI').length;
  const cancelledOrders = orders.filter(o => o.status === 'DIBATALKAN').length;

  const totalShoppingValue = orders.reduce((sum, o) => sum + (o.shoppingEstimatedCost || 0), 0);
  const totalShippingFees = orders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);
  const totalJastipFees = orders.reduce((sum, o) => sum + (o.jastipFee || 0), 0);
  const totalGrossRevenue = orders
    .filter(o => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const drivers = db.getDrivers();
  const customers = db.getUsers().filter(u => u.role === 'pelanggan');

  res.json({
    metrics: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalShoppingValue,
      totalShippingFees,
      totalJastipFees,
      totalGrossRevenue,
    },
    orders,
    driversCount: drivers.length,
    customersCount: customers.length,
    generatedAt: new Date().toISOString(),
  });
});

// Notifications
apiRouter.get('/notifications', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json(db.getNotifications(req.user!.id));
});

apiRouter.post('/notifications/:id/read', authenticateToken, (req: Request, res: Response) => {
  db.markNotificationRead(req.params.id);
  res.json({ success: true });
});

// Audit Logs
apiRouter.get('/admin/audit-logs', authenticateToken, requireRole(['super_admin']), (_req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});
