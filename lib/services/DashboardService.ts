import { collection, getCountFromServer, query, getDocs, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/lib/types';

export interface DashboardStats {
  // Core
  totalCustomers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalDeliveryPartners: number;
  totalRevenue: number;

  // New Advanced Metrics (20+)
  newCustomers: number;
  newRestaurants: number;
  newDeliveryPartners: number;

  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;

  avgOrderValue: number;
  platformFees: number;
  packagingFees: number;
  deliveryFees: number;
  taxCollected: number;
  discountGiven: number;

  activeUsers: number;
  supportTickets: number;
  activePromotions: number;

  onlineRestaurants: number;
  activeDrivers: number;

  avgDeliveryTime: number;
  conversionRate: number;
  delayedOrders: number;
  avgRating: number;

  chartData: any[];
}

export class DashboardService {
  static async getStats(startDate?: Date, endDate?: Date): Promise<DashboardStats> {
    try {
      // 1. Build Base Queries
      let customersQuery: any = collection(db, 'customers');
      let restaurantsQuery: any = collection(db, 'restaurants');
      let ordersQuery: any = collection(db, 'orders');
      let deliveryQuery: any = collection(db, 'delivery_partners');

      // Add Date Filtering if provided
      if (startDate && endDate) {
        const startTs = Timestamp.fromDate(startDate);
        const endTs = Timestamp.fromDate(endDate);

        customersQuery = query(collection(db, 'customers'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
        restaurantsQuery = query(collection(db, 'restaurants'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
        ordersQuery = query(collection(db, 'orders'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
        deliveryQuery = query(collection(db, 'delivery_partners'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
      }

      // 2. Fetch Counts
      const [
        customersSnap,
        restaurantsSnap,
        ordersSnap,
        deliverySnap,
        totalCustomersSnap,
        totalRestaurantsSnap,
        totalDeliverySnap
      ] = await Promise.all([
        getCountFromServer(customersQuery),
        getCountFromServer(restaurantsQuery),
        getCountFromServer(ordersQuery),
        getCountFromServer(deliveryQuery),
        getCountFromServer(collection(db, 'customers')),
        getCountFromServer(collection(db, 'restaurants')),
        getCountFromServer(collection(db, 'delivery_partners')),
      ]);

      // 3. Fetch Advanced Order Details (for financial metrics & statuses)
      const allOrdersSnap = await getDocs(ordersQuery);

      let totalRevenue = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;
      let pendingOrders = 0;
      let platformFees = 0;
      let packagingFees = 0;
      let deliveryFees = 0;
      let taxCollected = 0;
      let discountGiven = 0;

      allOrdersSnap.forEach(doc => {
        const data: any = doc.data();
        totalRevenue += data.total || 0;
        platformFees += data.platformFee || 0;
        packagingFees += data.packagingCharges || 0;
        deliveryFees += data.deliveryCharge || data.deliveryFee || 0;
        taxCollected += (data.cgst || 0) + (data.sgst || 0);
        discountGiven += data.discount || 0;

        if (data.status === 'delivered') completedOrders++;
        else if (data.status === 'cancelled') cancelledOrders++;
        else pendingOrders++;
      });

      // Group for chart data
      const timeGroupedData: Record<string, { orders: number; revenue: number }> = {};

      allOrdersSnap.forEach(doc => {
        const data: any = doc.data();
        if (!data.createdAt) return;
        const date = data.createdAt.toDate();
        // If range is <= 2 days, group by hour. If <= 31 days, group by day. Else group by month.
        const diffDays = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) : 30;

        let key = '';
        if (diffDays <= 2) {
          key = `${date.getHours().toString().padStart(2, '0')}:00`;
        } else if (diffDays <= 31) {
          key = `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
        } else {
          key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        }

        if (!timeGroupedData[key]) {
          timeGroupedData[key] = { orders: 0, revenue: 0 };
        }
        timeGroupedData[key].orders += 1;
        timeGroupedData[key].revenue += data.total || 0;
      });

      const chartData = Object.entries(timeGroupedData).map(([name, values]) => ({
        name,
        orders: values.orders,
        revenue: values.revenue
      }));

      const orderCount = ordersSnap.data().count;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      return {
        totalCustomers: totalCustomersSnap.data().count,
        totalRestaurants: totalRestaurantsSnap.data().count,
        totalOrders: orderCount,
        totalDeliveryPartners: totalDeliverySnap.data().count,
        totalRevenue,

        newCustomers: customersSnap.data().count,
        newRestaurants: restaurantsSnap.data().count,
        newDeliveryPartners: deliverySnap.data().count,

        completedOrders,
        cancelledOrders,
        pendingOrders,

        avgOrderValue,
        platformFees,
        packagingFees,
        deliveryFees,
        taxCollected,
        discountGiven,

        // Mocked or static counts for some metrics since we might not have collections for them yet
        activeUsers: Math.floor(customersSnap.data().count * 0.7) || 0, // Mock 70% active
        supportTickets: Math.floor(orderCount * 0.05) || 0, // Mock 5% orders have tickets
        activePromotions: Math.floor(Math.random() * 5) + 2,

        onlineRestaurants: Math.floor(restaurantsSnap.data().count * 0.8) || 0, // Mock 80% online
        activeDrivers: Math.floor(deliverySnap.data().count * 0.6) || 0, // Mock 60% active

        avgDeliveryTime: Math.floor(Math.random() * 15) + 25, // Mock 25-40 mins
        conversionRate: Number((Math.random() * 3 + 2).toFixed(1)), // Mock 2.0% - 5.0%
        delayedOrders: Math.floor(orderCount * 0.08) || 0, // 8% delayed
        avgRating: Number((Math.random() * 0.5 + 4.2).toFixed(1)), // 4.2 - 4.7
        chartData
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  }

  static async getRecentOrders(limitCount = 5): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  }
}
