'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle, XCircle } from 'lucide-react';
import { Order, Customer, Restaurant } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface InvoiceButtonProps {
    order: Order;
    customer: Customer | null;
}

export default function InvoiceButton({ order, customer }: InvoiceButtonProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setStatus('loading');
        try {
            // 1. Fetch Restaurant Details
            let restaurant: Restaurant | null = null;
            if (order.restaurantId) {
                try {
                    const docRef = doc(db, 'restaurants', order.restaurantId);
                    const snapshot = await getDoc(docRef);
                    if (snapshot.exists()) {
                        restaurant = snapshot.data() as Restaurant;
                    }
                } catch (err) {
                    console.error("Error fetching restaurant", err);
                }
            }

            // 2. Generate HTML
            const htmlContent = generateInvoiceHTML(order, customer, restaurant);

            // 3. Convert to PDF - Dynamic Import
            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default || html2pdfModule;

            if (!html2pdf) {
                throw new Error("Failed to load PDF library");
            }

            const opt = {
                margin: 10,
                filename: `Invoice_${order.id?.slice(-6).toUpperCase() || 'Order'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Generate and Save
            await html2pdf().set(opt).from(htmlContent).save();

            setStatus('success');
            setTimeout(() => setStatus('idle'), 2000); // Close success dialog after 2s

        } catch (error) {
            console.error("Invoice generation failed", error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000); // Close error dialog after 3s
        }
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={status === 'loading'}
                className="text-xs h-8 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
            >
                {status === 'loading' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                Invoice
            </Button>

            {/* Status Dialog */}
            <Dialog open={status !== 'idle'} onOpenChange={(open) => !open && status !== 'loading' && setStatus('idle')}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-xs flex flex-col items-center justify-center p-8 [&>button]:hidden">
                    <DialogTitle className="sr-only">Invoice Status</DialogTitle>
                    {status === 'loading' && (
                        <>
                            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                            <p className="font-bold text-lg">Generating Invoice...</p>
                            <p className="text-sm text-gray-500">Please wait a moment</p>
                        </>
                    )}
                    {status === 'success' && (
                        <>
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500 border border-green-500/50">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-lg text-green-500">Success!</p>
                            <p className="text-sm text-gray-500">Invoice downloaded successfully</p>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-500/50">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <p className="font-bold text-lg text-red-500">Failed</p>
                            <p className="text-sm text-gray-500 text-center">Could not generate invoice. Please try again.</p>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function generateInvoiceHTML(order: Order, customer: Customer | null, restaurant: Restaurant | null) {
    // Format dates
    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '';

    // Calculate totals if missing (fallback)
    const subtotal = order.subtotal || order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
    const delivery = order.deliveryCharge || 0;
    const tax = order.taxes || 0;
    const total = order.total || (subtotal + delivery + tax);

    // Address formatting
    const customerAddress = typeof order.deliveryAddress === 'object'
        ? `${order.deliveryAddress?.street || ''}, ${order.deliveryAddress?.city || ''}, ${order.deliveryAddress?.state || ''} - ${order.deliveryAddress?.pincode || ''}`
        : order.deliveryAddress || 'Address not provided';

    // Styles
    const styles = `
    font-family: 'Inter', system-ui, sans-serif;
    color: #1f2937;
    background: #ffffff;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
  `;

    return `
    <div style="${styles}">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #f3f4f6;">
            <div>
                 <h1 style="font-size: 24px; font-weight: 800; color: #f97316; margin: 0;">AKR<span style="color: #111827;">Hunger</span></h1>
                <p style="margin: 5px 0 0; color: #6b7280; font-size: 14px;">Premium Food Delivery</p>
            </div>
            <div style="text-align: right;">
                <h2 style="font-size: 32px; font-weight: 800; color: #111827; margin: 0; letter-spacing: -0.5px;">INVOICE</h2>
                <p style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">#${order.id?.slice(-6).toUpperCase()}</p>
                <p style="margin: 5px 0 0; color: #6b7280; font-size: 14px;">${orderDate}</p>
                 <div style="margin-top: 10px; display: inline-block; padding: 6px 12px; background: #ecfdf5; color: #059669; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                    ${order.status || 'PAID'}
                </div>
            </div>
        </div>

        <!-- Details -->
        <div style="display: flex; gap: 40px; margin-bottom: 40px;">
            <div style="flex: 1;">
                <h3 style="font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px;">Bill To</h3>
                <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                    <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 5px;">${order.customerName || customer?.name || 'Customer'}</p>
                    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5;">${customerAddress}</p>
                </div>
            </div>
            <div style="flex: 1;">
                <h3 style="font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px;">From</h3>
                <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
                    <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 5px;">${restaurant?.name || order.restaurantName || 'Restaurant'}</p>
                    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5;">${restaurant?.address || 'Restaurant Address'}</p>
                    ${restaurant?.phone ? `<p style="margin: 5px 0 0; color: #4b5563; font-size: 14px;">${restaurant.phone}</p>` : ''}
                </div>
            </div>
        </div>

        <!-- Order Items -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase; border-radius: 8px 0 0 8px;">Item</th>
                    <th style="text-align: center; padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Qty</th>
                    <th style="text-align: right; padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Price</th>
                    <th style="text-align: right; padding: 12px 16px; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase; border-radius: 0 8px 8px 0;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${order.items?.map((item, i) => `
                    <tr>
                        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                            <p style="margin: 0; font-weight: 600; color: #111827; font-size: 14px;">${item.name}</p>
                        </td>
                        <td style="text-align: center; padding: 16px; color: #4b5563; font-size: 14px; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                        <td style="text-align: right; padding: 16px; color: #4b5563; font-size: 14px; border-bottom: 1px solid #e5e7eb;">₹${item.price.toFixed(2)}</td>
                        <td style="text-align: right; padding: 16px; font-weight: 600; color: #111827; font-size: 14px; border-bottom: 1px solid #e5e7eb;">₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- Summary -->
        <div style="display: flex; justify-content: flex-end;">
            <div style="width: 250px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #4b5563; font-size: 14px;">
                    <span>Subtotal</span>
                    <span>₹${subtotal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #4b5563; font-size: 14px;">
                    <span>Delivery Fee</span>
                    <span>₹${delivery.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #4b5563; font-size: 14px;">
                    <span>Taxes</span>
                    <span>₹${tax.toFixed(2)}</span>
                </div>
                 ${order.discountAmount ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #16a34a; font-size: 14px;">
                    <span>Discount</span>
                    <span>-₹${order.discountAmount.toFixed(2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; padding: 16px 0 0; margin-top: 10px; border-top: 2px solid #e5e7eb; color: #111827; font-size: 18px; font-weight: 800;">
                    <span>Total</span>
                    <span>₹${total.toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 60px; text-align: center; font-size: 12px; color: #9ca3af;">
            <p>Thank you for ordering with AKR Hunger!</p>
        </div>
    </div>
  `;
}
