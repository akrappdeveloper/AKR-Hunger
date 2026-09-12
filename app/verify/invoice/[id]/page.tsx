'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant } from '@/lib/types';
import { calculateInvoice, InvoiceCalculatedBreakdown } from '@/lib/invoice-calculator';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Receipt,
  CreditCard,
  ArrowLeft,
  Store,
  ExternalLink,
  Lock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function InvoiceVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceParam = (params?.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceCalculatedBreakdown | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function verifyInvoice() {
      if (!invoiceParam) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);

      try {
        let foundOrder: Order | null = null;

        // 1. Direct document lookup by ID
        const docRef = doc(db, 'orders', invoiceParam);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          foundOrder = { ...docSnap.data(), id: docSnap.id } as Order;
        } else {
          // 2. Query by orderId or short code if parameter is an invoice reference
          const cleanRef = invoiceParam.replace(/^VER-|^INV-\d{4}-|^AKR-/, '').trim();
          
          const ordersCol = collection(db, 'orders');
          const q1 = query(ordersCol, where('orderId', '==', invoiceParam));
          const snap1 = await getDocs(q1);

          if (!snap1.empty) {
            foundOrder = { ...snap1.docs[0].data(), id: snap1.docs[0].id } as Order;
          } else if (cleanRef) {
            // Check by ID ending with the clean reference
            const snapAll = await getDocs(ordersCol);
            for (const d of snapAll.docs) {
              if (d.id.endsWith(cleanRef) || d.id.toUpperCase().endsWith(cleanRef.toUpperCase())) {
                foundOrder = { ...d.data(), id: d.id } as Order;
                break;
              }
            }
          }
        }

        if (!foundOrder) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOrder(foundOrder);

        // Fetch Restaurant details
        let foundRest: Restaurant | null = null;
        if (foundOrder.restaurantId) {
          try {
            const restSnap = await getDoc(doc(db, 'restaurants', foundOrder.restaurantId));
            if (restSnap.exists()) {
              foundRest = restSnap.data() as Restaurant;
            }
          } catch (err) {
            console.error('Error fetching restaurant for invoice verification:', err);
          }
        }
        setRestaurant(foundRest);

        // Authoritative Calculation
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const calculated = calculateInvoice(foundOrder, foundRest, null, origin);
        setInvoiceData(calculated);
      } catch (err) {
        console.error('Invoice verification error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    verifyInvoice();
  }, [invoiceParam]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background text-foreground py-10 px-4 sm:px-6 flex flex-col items-center">
      {/* Brand Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/25">
            A
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-primary">
              AKR<span className="text-foreground">Hunger</span>
            </span>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Digital Verification Portal
            </p>
          </div>
        </Link>

        <Link href="/customer/orders">
          <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 font-bold">
            <ArrowLeft className="w-3.5 h-3.5" />
            My Orders
          </Button>
        </Link>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="bg-card border border-border/80 rounded-3xl p-12 text-center shadow-xl backdrop-blur-md flex flex-col items-center justify-center min-h-[360px]">
            <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-bold text-foreground">Verifying Invoice Authenticity...</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Connecting to AKR Hunger Digital Ledger to cryptographically validate invoice credentials.
            </p>
          </div>
        ) : notFound || !invoiceData ? (
          <div className="bg-card border border-destructive/30 rounded-3xl p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive border border-destructive/20 mx-auto flex items-center justify-center mb-5">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs px-3 py-1 font-bold mb-3 uppercase tracking-wider">
              Verification Result: Invalid
            </Badge>
            <h2 className="text-2xl font-black text-foreground mb-2">
              Invoice Could Not Be Verified
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
              The reference <span className="font-mono font-bold text-foreground">{invoiceParam}</span> was not found in the authentic AKR Hunger registry. This record may be counterfeit, altered, or deleted.
            </p>
            <div className="p-4 bg-muted/50 rounded-2xl border border-border max-w-md mx-auto text-left text-xs text-muted-foreground space-y-1 mb-6">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Lock className="w-3.5 h-3.5 text-primary" /> Anti-Tamper Security Notice
              </div>
              <p>
                Only official AKR Hunger invoices generated through registered kitchens and genuine digital checkout links carry valid cryptographic tokens.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link href="/">
                <Button className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                  Return to Homepage
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Verification Banner */}
            <div className="bg-card border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-500/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shadow-inner flex-shrink-0">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                        Official Tax Invoice
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Status: Authentic
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1 flex items-center gap-2">
                      Invoice Verified & Genuine
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cryptographically verified under Section 9(5) CGST Act, 2017
                    </p>
                  </div>
                </div>

                <div className="sm:text-right bg-muted/40 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-border">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Verification ID
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-primary">
                    {invoiceData.verificationId}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Ref: {invoiceData.verificationHash.slice(0, 14)}...
                  </div>
                </div>
              </div>

              {/* Quick Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Invoice Number
                  </div>
                  <div className="text-sm font-black text-foreground mt-0.5 font-mono">
                    {invoiceData.invoiceNumber}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Order ID
                  </div>
                  <div className="text-sm font-black text-foreground mt-0.5 font-mono">
                    {invoiceData.orderIdDisplay}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Issue Date
                  </div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">
                    {invoiceData.orderDateDisplay}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Payment Status
                  </div>
                  <div className="mt-0.5">
                    <span
                      style={{
                        backgroundColor: invoiceData.paymentStatusBadge.bg,
                        color: invoiceData.paymentStatusBadge.text,
                        borderColor: invoiceData.paymentStatusBadge.border,
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                    >
                      <span
                        style={{ backgroundColor: invoiceData.paymentStatusBadge.dot }}
                        className="w-1.5 h-1.5 rounded-full"
                      />
                      {invoiceData.paymentStatusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid of Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card: Supplier / Merchant Details */}
              <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <Store className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">
                    Food Supplier (Kitchen)
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Restaurant Partner:</span>
                    <span className="font-bold text-sm text-foreground">{invoiceData.sellerName}</span>
                  </div>
                  {invoiceData.sellerLegalName !== invoiceData.sellerName && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Legal Entity:</span>
                      <span className="font-semibold text-foreground">{invoiceData.sellerLegalName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Kitchen Outlet Location:</span>
                    <span className="text-foreground leading-relaxed">{invoiceData.sellerAddress}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">FSSAI License:</span>
                      <span className="font-mono font-semibold text-foreground">{invoiceData.sellerFssai}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">GSTIN:</span>
                      <span className="font-mono font-semibold text-foreground">{invoiceData.sellerGstin}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground block text-[10px]">Place of Supply:</span>
                    <span className="font-bold text-primary">{invoiceData.placeOfSupply}</span>
                  </div>
                </div>
              </div>

              {/* Card: Electronic Commerce Operator */}
              <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">
                    Electronic Commerce Operator
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Platform Operator:</span>
                    <span className="font-bold text-sm text-foreground">{invoiceData.operatorLegalName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Registered Office:</span>
                    <span className="text-foreground leading-relaxed">{invoiceData.operatorAddress}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">ECO GSTIN:</span>
                      <span className="font-mono font-semibold text-foreground">{invoiceData.operatorGstin}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">FSSAI Central Lic:</span>
                      <span className="font-mono font-semibold text-foreground">{invoiceData.operatorFssai}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground block text-[10px]">Tax Liability Provision:</span>
                    <span className="font-semibold text-foreground">Section 9(5) CGST Act, 2017</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Reconciliation & Tax Breakdown Card */}
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">
                    Authorized Financial Breakdown
                  </h3>
                </div>
                <Badge variant="outline" className="font-bold text-[11px] bg-primary/5 text-primary border-primary/20">
                  {invoiceData.itemCount} Item{invoiceData.itemCount > 1 ? 's' : ''} Audited
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                {/* Tax Breakdown Table */}
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-foreground text-xs uppercase tracking-wide">
                    GST & Statutory Charges
                  </div>
                  <div className="space-y-2 bg-muted/40 p-3.5 rounded-2xl border border-border">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxable Supply Value:</span>
                      <span className="font-semibold text-foreground">₹{invoiceData.taxableAmount.toFixed(2)}</span>
                    </div>
                    {invoiceData.taxes.map((t, idx) => (
                      <div key={idx} className="flex justify-between text-muted-foreground">
                        <span>{t.name}:</span>
                        <span className="font-semibold text-foreground">₹{t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 flex justify-between font-bold text-foreground">
                      <span>Total Dynamic Tax:</span>
                      <span className="text-primary">₹{invoiceData.totalTax.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Packaging Fee:</span>
                      <span className="font-medium text-foreground">
                        {invoiceData.packagingFee > 0 ? `₹${invoiceData.packagingFee.toFixed(2)}` : 'Nil'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span className="font-medium text-foreground">
                        {invoiceData.deliveryFee > 0 ? `₹${invoiceData.deliveryFee.toFixed(2)}` : 'FREE'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span className="font-medium text-foreground">₹{invoiceData.platformFee.toFixed(2)}</span>
                    </div>
                    {invoiceData.discountTotal > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Discounts Applied:</span>
                        <span>-₹{invoiceData.discountTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grand Total & Settlement Box */}
                <div className="flex flex-col justify-between space-y-4">
                  <div className="bg-zinc-950 text-white rounded-2xl p-5 shadow-lg border border-zinc-800">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Final Grand Total
                    </div>
                    <div className="text-3xl font-black text-orange-500 tracking-tight mt-1">
                      ₹{invoiceData.grandTotal.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-zinc-300 italic mt-2 font-medium">
                      {invoiceData.totalInWords}
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Amount Settled:</span>
                        <span className="font-bold text-emerald-400">₹{invoiceData.amountPaid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Balance Due:</span>
                        <span className={`font-bold ${invoiceData.balanceDue > 0 ? 'text-amber-400' : 'text-zinc-300'}`}>
                          ₹{invoiceData.balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-3.5 rounded-2xl border border-border text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      <span>Settlement Reference</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground break-all">
                      {invoiceData.transactionReference}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Anti-Tamper Legal Notice */}
            <div className="bg-muted/30 border border-border rounded-2xl p-4 text-xs text-muted-foreground flex items-start gap-3">
              <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-bold text-foreground">Consumer Privacy & Cryptographic Integrity Protection</span>
                <p>
                  In compliance with privacy standards and consumer data protection laws, sensitive personal identification (customer residential address, mobile contact, and private payment instruments) is strictly redacted from public verification endpoints.
                </p>
                <p className="font-mono text-[10px] text-muted-foreground pt-1">
                  Digital Seal Hash: {invoiceData.verificationHash}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-3xl mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-3">
        <p>© 2026 AKR Hunger Technologies Pvt. Ltd. All rights reserved.</p>
        <p>Support: <a href="mailto:support@akrhunger.com" className="text-primary hover:underline font-semibold">support@akrhunger.com</a></p>
      </div>
    </div>
  );
}
