import { Order, Restaurant, DeliveryPerson } from './types';

export interface AnalyticsMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  completedOrders: number;
  cancelledOrders: number;
  fulfillmentRate: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number;
  topRestaurants: Array<{ name: string; orders: number; revenue: number }>;
  topDeliveryPartners: Array<{ name: string; deliveries: number; rating: number }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export const calculateDateRange = (range: 'today' | 'week' | 'month' | 'year' | 'custom', customStart?: Date, customEnd?: Date): DateRange => {
  const endDate = new Date();
  let startDate = new Date();

  switch (range) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
      }
      break;
  }

  return { startDate, endDate };
};

export const filterOrdersByDateRange = (orders: Order[], dateRange: DateRange): Order[] => {
  return orders.filter((order) => {
    const orderDate = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || 0);
    return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate;
  });
};

export const calculateMetrics = (orders: Order[]): AnalyticsMetrics => {
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === 'delivered').length;
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const fulfillmentRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue,
    completedOrders,
    cancelledOrders,
    fulfillmentRate,
    onTimeDeliveryRate: 95,
    averageDeliveryTime: 32,
    topRestaurants: [],
    topDeliveryPartners: [],
  };
};

export const exportToCSV = (data: any[], filename: string) => {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((header) => JSON.stringify(row[header] || '')).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${Math.round(value * 10) / 10}%`;
};
