import { Order, Restaurant, DeliveryPerson } from './types';
import html2pdf from 'html2pdf.js';

export interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  columns: string[];
}

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    console.warn('[v0] No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (htmlContent: string, filename: string) => {
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  
  const opt = {
    margin: 10,
    filename: `${filename}-${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
  };

  // Note: This requires html2pdf library - for now we'll provide JSON export fallback
  console.log('[v0] PDF export requires html2pdf library');
  exportToJSON(htmlContent, filename);
};

export const exportToJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateOrderReport = (orders: Order[]): any[] => {
  return orders.map((order) => ({
    'Order ID': order.id,
    'Customer Name': order.customerName || 'N/A',
    'Restaurant': order.restaurantName || 'N/A',
    'Status': order.status || 'pending',
    'Payment Method': order.paymentMethod || 'N/A',
    'Subtotal': order.subtotal || 0,
    'Delivery Charge': order.deliveryCharge || 0,
    'Taxes': order.taxes || 0,
    'Total': order.total || 0,
    'Date': order.createdAt instanceof Date ? order.createdAt.toLocaleDateString() : 'N/A',
    'Time': order.createdAt instanceof Date ? order.createdAt.toLocaleTimeString() : 'N/A',
  }));
};

export const generateRestaurantReport = (restaurants: Restaurant[]): any[] => {
  return restaurants.map((restaurant) => ({
    'Restaurant ID': restaurant.id,
    'Name': restaurant.name,
    'Email': restaurant.email,
    'Phone': restaurant.phone,
    'Address': restaurant.address,
    'Cuisine Type': restaurant.cuisineType?.join(', ') || 'N/A',
    'Delivery Time (min)': restaurant.deliveryTime || 'N/A',
    'Delivery Charge': restaurant.deliveryCharge || 0,
    'Minimum Order': restaurant.minimumOrder || 0,
    'Status': restaurant.isActive ? 'Active' : 'Inactive',
  }));
};

export const generateDeliveryReport = (deliveries: DeliveryPerson[]): any[] => {
  return deliveries.map((delivery) => ({
    'Partner ID': delivery.id,
    'Name': delivery.name,
    'Phone': delivery.phone,
    'Email': delivery.email,
    'Vehicle': delivery.vehicle,
    'Vehicle Number': delivery.vehicleNumber,
    'Rating': delivery.rating || 0,
    'Status': delivery.status || 'offline',
    'Created At': delivery.createdAt instanceof Date ? delivery.createdAt.toLocaleDateString() : 'N/A',
  }));
};
