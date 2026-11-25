'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ExternalLink,
  Share2,
  ShieldCheck,
  Eye,
  Check,
} from 'lucide-react';
import { Order, Customer, Restaurant, Address } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { calculateInvoice, InvoiceCalculatedBreakdown } from '@/lib/invoice-calculator';
import { getItemCustomizations, formatSelectedOptionPrice } from '@/lib/customization-utils';
import { generateInvoiceQRDataURL } from '@/lib/qr-generator';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface InvoiceButtonProps {
  order: Order;
  customer: Customer | null;
}

export default function InvoiceButton({ order, customer }: InvoiceButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preparedData, setPreparedData] = useState<{
    breakdown: InvoiceCalculatedBreakdown;
    html: string;
    logoBase64: string;
    qrBase64: string;
  } | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [copied, setCopied] = useState(false);

  // Prepares authoritative invoice data, Base64 logo, and scannable QR code
  const prepareInvoiceData = async () => {
    if (preparedData) return preparedData;
    setLoadingData(true);

    try {
      // 1. Fetch Restaurant details if missing
      let restaurant: Restaurant | null = null;
      if (order.restaurantId) {
        try {
          const docRef = doc(db, 'restaurants', order.restaurantId);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            restaurant = snapshot.data() as Restaurant;
          }
        } catch (err) {
          console.error('Error fetching restaurant for invoice:', err);
        }
      }

      // 2. Fetch Customer details if incomplete
      let fullCustomer: Customer | null = customer;
      if (order.customerId && (!fullCustomer || !fullCustomer.email || !fullCustomer.phone)) {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', order.customerId));
          if (customerDoc.exists()) {
            fullCustomer = {
              ...customerDoc.data(),
              id: customerDoc.id,
            } as Customer;
          }
        } catch (err) {
          console.error('Error fetching customer for invoice:', err);
        }
      }

      // 3. Compute Authoritative Invoice Calculations
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const breakdown = calculateInvoice(order, restaurant, fullCustomer, baseUrl);

      // 4. Generate Base64 assets (Logo & Real Verification QR Code)
      const logoBase64 = await getBase64Logo('/hunger.png');
      const qrBase64 = await generateInvoiceQRDataURL(breakdown.verificationUrl, {
        width: 120,
        margin: 1,
      });

      // 5. Build Enterprise Print-Ready HTML
      const html = generateEnterpriseInvoiceHTML(breakdown, order, logoBase64, qrBase64);

      const result = { breakdown, html, logoBase64, qrBase64 };
      setPreparedData(result);
      return result;
    } catch (err) {
      console.error('Failed to prepare invoice:', err);
      toast.error('Could not prepare invoice data. Please try again.');
      return null;
    } finally {
      setLoadingData(false);
    }
  };

  // Open Web Invoice Modal
  const handleOpenPreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
    await prepareInvoiceData();
  };

  // Download high-definition PDF using isolated iframe to bypass Tailwind v4 oklch/lab errors
  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setDownloading(true);
    try {
      const data = preparedData || (await prepareInvoiceData());
      if (!data) throw new Error('Invoice data not ready');

      // Create isolated hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Failed to create isolated document context');

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.breakdown.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background: #ffffff !important; color: #09090b !important; padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print {
      body { margin: 0; padding: 0; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  ${data.html}
</body>
</html>`);
      iframeDoc.close();

      // Give browser time to layout fonts and images
      await new Promise((resolve) => setTimeout(resolve, 350));

      try {
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default || html2canvasModule;

        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF || jsPDFModule;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${data.breakdown.invoiceNumber}.pdf`);

        toast.success('Tax Invoice downloaded successfully!');
      } catch (canvasErr) {
        console.warn('Canvas conversion fallback to native print window:', canvasErr);
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        toast.info('Opening print dialog for invoice');
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Direct Browser Print
  const handlePrint = async () => {
    const data = preparedData || (await prepareInvoiceData());
    if (!data) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Please allow popups to print invoice');
      return;
    }

    printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.breakdown.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { background: #ffffff !important; color: #09090b !important; padding: 20px; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  ${data.html}
  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>`);
    printWin.document.close();
  };

  // Copy Verification Link
  const handleCopyLink = async () => {
    if (!preparedData?.breakdown.verificationUrl) return;
    await copyToClipboard(preparedData.breakdown.verificationUrl);
    setCopied(true);
    toast.success('Verification URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenPreview}
        className="text-xs h-8 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-bold transition-all shadow-xs gap-1.5"
      >
        <FileText className="w-3.5 h-3.5" />
        Invoice
      </Button>

      {/* Modern Web Invoice Preview Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!w-[96vw] !max-w-[1500px] !h-[94vh] !max-h-[94vh] flex flex-col p-0 bg-zinc-100 dark:bg-zinc-950 border-border overflow-hidden rounded-3xl shadow-2xl">
          <DialogHeader className="px-6 py-4 bg-background border-b border-border flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                <ReceiptIcon className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                  Tax Invoice
                  {preparedData && (
                    <span className="text-xs font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                      {preparedData.breakdown.invoiceNumber}
                    </span>
                  )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Hunger Technologies Pvt. Ltd. &bull; Official GST Record
                </p>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                disabled={!preparedData}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl hidden sm:inline-flex"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Share'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!preparedData}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl hidden sm:inline-flex"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>

              {preparedData && (
                <a
                  href={preparedData.breakdown.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex"
                >
                  <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verify
                  </Button>
                </a>
              )}

              <Button
                size="sm"
                onClick={() => handleDownloadPDF()}
                disabled={downloading || !preparedData}
                className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? 'Exporting...' : 'Download PDF'}
              </Button>
            </div>
          </DialogHeader>

          {/* Web Invoice Scroll Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-zinc-200/50 dark:bg-zinc-900/60">
            {loadingData || !preparedData ? (
              <div className="h-96 flex flex-col items-center justify-center text-center p-8">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="font-bold text-base text-foreground">Preparing Enterprise Tax Invoice...</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Calculating dynamic GST, intra/inter-state rates, and generating cryptographically signed QR seal.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-[780px] bg-white rounded-2xl shadow-xl overflow-hidden text-zinc-950 border border-zinc-200 my-auto">
                <div
                  dangerouslySetInnerHTML={{ __html: preparedData.html }}
                  className="w-full overflow-x-auto"
                />
              </div>
            )}
          </div>

          {/* Mobile Footer Toolbar */}
          <div className="px-4 py-3 bg-background border-t border-border flex sm:hidden items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!preparedData}
              className="text-xs font-bold gap-1 rounded-xl h-8"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            {preparedData && (
              <a
                href={preparedData.breakdown.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="text-xs font-bold gap-1 rounded-xl h-8 text-emerald-600 border-emerald-500/20 bg-emerald-500/10">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify
                </Button>
              </a>
            )}
            <Button
              size="sm"
              onClick={() => handleDownloadPDF()}
              disabled={downloading || !preparedData}
              className="text-xs font-bold gap-1 rounded-xl bg-primary text-primary-foreground h-8"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Convert image URL to Base64 Data URL for zero-latency embedding
async function getBase64Logo(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function ReceiptIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}

/**
 * Generates Enterprise-Grade High-Fidelity Invoice HTML
 * Preserves the iconic Hunger visual identity (orange accents, clean cards, deep charcoal grand total)
 * Separates Packaging, Delivery, Platform Fee, and Dynamic CGST + SGST or IGST.
 */
function generateEnterpriseInvoiceHTML(
  inv: InvoiceCalculatedBreakdown,
  order: Order,
  logoBase64: string,
  qrBase64: string
): string {
  const isInterState = inv.isInterState;

  return `
    <div style="width: 780px; max-width: 780px; margin: 0 auto; background: #ffffff; padding: 34px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #09090b; box-sizing: border-box; position: relative;">
      
      <!-- Top Brand Vibrant Gradient Line -->
      <div style="position: absolute; top: 0; left: 36px; right: 36px; height: 3px; background: linear-gradient(90deg, #ea580c 0%, #f97316 45%, #fb923c 100%); border-radius: 3px;"></div>

      <!-- ================= 1. ENTERPRISE HEADER ================= -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid #f4f4f5;">
        
        <!-- Left: Hunger ECO Brand -->
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="position: relative;">
            ${logoBase64
      ? `<img src="${logoBase64}" width="50" height="50" style="width: 50px; height: 50px; object-fit: contain; border-radius: 12px; border: 1px solid rgba(234, 88, 12, 0.18); box-shadow: 0 4px 12px rgba(234, 88, 12, 0.1); display: block;" alt="Hunger Logo" />`
      : `<div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #ea580c, #f97316); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 19px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2);">H</div>`
    }
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.03em; color: #ea580c;">Hunger</span>
              <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background: #fff7ed; color: #ea580c; border: 1.5px solid #fed7aa; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; line-height: 1;">TAX INVOICE</span>
            </div>
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #52525b;">${inv.operatorLegalName}</p>
            <p style="margin: 1px 0 0 0; font-size: 10px; color: #71717a;">
              ECO u/s 9(5) CGST Act, 2017 &bull; GSTIN: <span style="font-family: monospace; font-weight: 600; color: #27272a;">${inv.operatorGstin}</span> &bull; FSSAI Lic: <span style="font-family: monospace;">${inv.operatorFssai}</span>
            </p>
          </div>
        </div>

        <!-- Right: Invoice Metadata & Payment Status -->
        <div style="text-align: right;">
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; margin-bottom: 2px;">TAX INVOICE NO.</div>
          <div style="font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: #09090b; font-family: monospace;">${inv.invoiceNumber}</div>
          <div style="font-size: 11px; color: #71717a; margin-top: 3px;">
            Date: <span style="font-weight: 600; color: #27272a;">${inv.invoiceDateDisplay}</span>
          </div>
          <div style="margin-top: 5px;">
            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: ${inv.paymentStatusBadge.bg}; color: ${inv.paymentStatusBadge.text}; border: 1px solid ${inv.paymentStatusBadge.border};">
              <span style="width: 5px; height: 5px; border-radius: 50%; background: ${inv.paymentStatusBadge.dot}; display: inline-block;"></span>
              ${inv.paymentStatusBadge.label}
            </span>
          </div>
        </div>
      </div>

      <!-- ================= 2. THREE-COLUMN PARTIES CARDS ================= -->
      <div style="display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        
        <!-- Card 1: Billed To (Customer Details & Place of Supply) -->
        <div style="background: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 13px 15px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a;">Billed To (Customer)</span>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; background: #e0f2fe; color: #0284c7; text-transform: uppercase;">${inv.addressType}</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #09090b; margin-bottom: 4px;">${inv.buyerName}</div>
          <div style="font-size: 10.5px; color: #52525b; line-height: 1.45; margin-bottom: 2px;">
            <strong style="color: #27272a; font-weight: 600;">Phone:</strong> ${inv.buyerPhone}
          </div>
          <div style="font-size: 10.5px; color: #52525b; line-height: 1.45; margin-bottom: 6px;">
            <strong style="color: #27272a; font-weight: 600;">Email:</strong> ${inv.buyerEmail}
          </div>
          <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 7px 9px; margin-top: auto;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 2px;">Delivery Destination & Place of Supply</div>
            <div style="font-size: 10.5px; color: #3f3f46; line-height: 1.35;">
              ${inv.deliveryAddressFormatted}
            </div>
            <div style="font-size: 9.5px; font-weight: 700; color: #ea580c; margin-top: 3px;">
              Place of Supply: <span style="color: #09090b;">${inv.placeOfSupply}</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Billed By (Restaurant / Supplier Details) -->
        <div style="background: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 13px 15px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a;">Billed By (Food Supplier)</span>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; background: #fef3c7; color: #d97706; text-transform: uppercase;">Kitchen</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #09090b; margin-bottom: 4px;">${inv.sellerName}</div>
          <div style="font-size: 10.5px; color: #52525b; line-height: 1.45; margin-bottom: 2px;">
            <strong style="color: #27272a; font-weight: 600;">GSTIN:</strong> <span style="font-family: monospace;">${inv.sellerGstin}</span>
          </div>
          <div style="font-size: 10.5px; color: #52525b; line-height: 1.45; margin-bottom: 6px;">
            <strong style="color: #27272a; font-weight: 600;">FSSAI Lic:</strong> <span style="font-family: monospace;">${inv.sellerFssai}</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 7px 9px; margin-top: auto;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 2px;">Kitchen Outlet Station</div>
            <div style="font-size: 10.5px; color: #3f3f46; line-height: 1.35;">${inv.sellerAddress}</div>
            <div style="font-size: 9.5px; color: #71717a; margin-top: 3px;">
              State: <strong style="color: #27272a;">${inv.sellerState} (${inv.sellerStateCode})</strong>
            </div>
          </div>
        </div>

        <!-- Card 3: Payment Summary & Order Metadata -->
        <div style="background: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 13px 15px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a;">Payment Summary</span>
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; background: #f4f4f5; color: #52525b; text-transform: uppercase;">Audited</span>
          </div>
          <div style="margin-bottom: 5px;">
            <div style="font-size: 9px; font-weight: 600; color: #71717a;">ORDER IDENTIFIER</div>
            <div style="font-size: 12px; font-weight: 800; color: #09090b; font-family: monospace;">${inv.orderIdDisplay}</div>
          </div>
          <div style="margin-bottom: 6px;">
            <div style="font-size: 9px; font-weight: 600; color: #71717a;">METHOD & TRANSACTION REF</div>
            <div style="font-size: 11px; font-weight: 700; color: #09090b;">${inv.paymentMethodDisplay}</div>
            <div style="font-family: monospace; font-size: 10px; font-weight: 600; color: #0284c7; word-break: break-all; margin-top: 1px;">
              ${inv.transactionReference}
            </div>
          </div>
          <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 7px 9px; margin-top: auto;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 2px;">Fulfillment Status</div>
            <div style="font-size: 10.5px; font-weight: 600; color: #059669;">Direct Doorstep Delivery &bull; Verified</div>
          </div>
        </div>
      </div>

      <!-- ================= 3. PRODUCTION-READY ITEM TABLE ================= -->
      <div style="margin-bottom: 20px; border: 1px solid #f4f4f5; border-radius: 12px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #fafafa; border-bottom: 1px solid #e4e4e7;">
              <th style="padding: 10px 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; width: 36px; text-align: center;">#</th>
              <th style="padding: 10px 14px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a;">Item & Details</th>
              <th style="padding: 10px 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; width: 75px; text-align: center;">SAC Code</th>
              <th style="padding: 10px 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; text-align: center; width: 55px;">Qty</th>
              <th style="padding: 10px 14px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; text-align: right; width: 95px;">Rate</th>
              <th style="padding: 10px 16px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; text-align: right; width: 105px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items && order.items.length > 0
      ? order.items
        .map((item, i) => {
          const itemTotal = (item.price * item.quantity).toFixed(2);
          const { basePrice, extrasTotal, badges } = getItemCustomizations(item);
          const legacyCustomizations =
            (item as any).customizations || (item as any).addons || [];
          const legacyNotes =
            Array.isArray(legacyCustomizations) && legacyCustomizations.length > 0
              ? legacyCustomizations
                .map((c: any) =>
                  typeof c === 'string' ? c : c.name || c.title || ''
                )
                .filter(Boolean)
                .join(' • ')
              : '';
          const structuredHtml = badges
            .map((b) => {
              if (b.kind === 'spice') {
                return `<span style="display: inline-block; font-size: 9px; font-weight: 600; color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; padding: 1px 5px; border-radius: 4px; margin-right: 4px; margin-top: 2px;">Spice: ${b.label.replace(/^Spice:\s*/, '')}</span>`;
              }
              if (b.kind === 'size') {
                return `<span style="display: inline-block; font-size: 9px; font-weight: 600; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; padding: 1px 5px; border-radius: 4px; margin-right: 4px; margin-top: 2px;">${b.label} (${formatSelectedOptionPrice(b.price)})</span>`;
              }
              if (b.kind === 'addon') {
                const pStr = Number(b.price || 0) > 0 ? `+₹${Number(b.price)}` : 'Free';
                return `<span style="display: inline-block; font-size: 9px; font-weight: 600; color: #ea580c; background: #fff7ed; border: 1px solid #fdba74; padding: 1px 5px; border-radius: 4px; margin-right: 4px; margin-top: 2px;">+ ${b.label} (${pStr})</span>`;
              }
              return `<div style="font-size: 9.5px; color: #71717a; font-style: italic; margin-top: 2px;">Note: ${b.label}</div>`;
            })
            .join('');

          return `
                        <tr style="border-bottom: 1px solid #f4f4f5; background: ${i % 2 === 0 ? '#ffffff' : '#fcfcfd'
            };">
                          <td style="padding: 11px 12px; font-size: 10.5px; font-weight: 600; color: #a1a1aa; text-align: center;">${i + 1
            }</td>
                          <td style="padding: 11px 14px;">
                            <div style="font-size: 12px; font-weight: 700; color: #09090b;">${item.name
            }</div>
                            ${extrasTotal > 0
              ? `<div style="font-size: 9.5px; color: #52525b; margin-top: 1px;">Base Price: ₹${basePrice.toFixed(basePrice % 1 === 0 ? 0 : 2)}</div>`
              : ''
            }
                            ${legacyNotes
              ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">+ ${legacyNotes}</div>`
              : ''
            }
                            ${structuredHtml ? `<div style="margin-top: 2px;">${structuredHtml}</div>` : ''}
                          </td>
                          <td style="padding: 11px 12px; font-size: 10px; font-family: monospace; color: #71717a; text-align: center;">996331</td>
                          <td style="padding: 11px 12px; text-align: center;">
                            <span style="display: inline-block; min-width: 22px; padding: 1px 6px; border-radius: 10px; background: #f4f4f5; color: #18181b; font-size: 11px; font-weight: 700;">${item.quantity
            }</span>
                          </td>
                          <td style="padding: 11px 14px; text-align: right; font-size: 11.5px; font-weight: 600; color: #52525b;">₹${item.price.toFixed(
              2
            )}</td>
                          <td style="padding: 11px 16px; text-align: right; font-size: 12px; font-weight: 800; color: #09090b;">₹${itemTotal}</td>
                        </tr>
                      `;
        })
        .join('')
      : `
                  <tr>
                    <td colspan="6" style="padding: 20px; text-align: center; color: #71717a; font-size: 11px;">No itemized food records found.</td>
                  </tr>
                `
    }
          </tbody>
        </table>
      </div>

      <!-- ================= 4. DYNAMIC TAX BREAKDOWN & REAL DIGITAL SEAL ================= -->
      <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
        
        <!-- Left: Real Cryptographic Seal & Scannable QR Verification -->
        <div style="flex: 1.15; background: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 14px 16px;">
          
          <!-- Verification QR & Token -->
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="width: 54px; height: 54px; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 10px; padding: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
              ${qrBase64
      ? `<img src="${qrBase64}" width="48" height="48" style="width: 48px; height: 48px; display: block;" alt="Verification QR Code" />`
      : `<div style="font-size: 8px; text-align: center; font-weight: bold; color: #ea580c;">VERIFIED</div>`
    }
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #09090b;">Digital Verification Seal</span>
                <span style="font-size: 8.5px; font-weight: 700; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 1px 5px; border-radius: 4px;">AUTHENTIC</span>
              </div>
              <div style="font-size: 9.5px; color: #52525b; margin-top: 1px;">
                Verification ID: <strong style="color: #ea580c; font-family: monospace;">${inv.verificationId}</strong>
              </div>
              <div style="font-size: 8.5px; color: #a1a1aa; font-family: monospace; margin-top: 1px;">
                Hash: ${inv.verificationHash}
              </div>
            </div>
          </div>

          <!-- Amount in Words -->
          <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 8px 10px; margin-bottom: 9px;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; margin-bottom: 2px;">Invoice Total in Words</div>
            <div style="font-size: 10.5px; font-weight: 700; color: #09090b; font-style: italic; line-height: 1.35;">${inv.totalInWords}</div>
          </div>

          <!-- Statutory ECO Notice -->
          <div style="font-size: 9px; color: #71717a; line-height: 1.4;">
            Prepared by <strong>${inv.sellerName}</strong>. Food delivery facilitated by <strong>${inv.operatorLegalName}</strong> as Electronic Commerce Operator under Section 9(5) of the CGST Act, 2017.
          </div>
        </div>

        <!-- Right: Unbundled Charges & Authoritative Tax Breakdown -->
        <div style="flex: 1; max-width: 320px; background: #fafafa; border: 1px solid #f4f4f5; border-radius: 12px; padding: 14px 16px;">
          
          ${inv.customizationExtrasTotal > 0
      ? `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 10.5px; color: #71717a;">Base Dishes Price</span>
            <span style="font-size: 10.5px; font-weight: 600; color: #3f3f46;">₹${inv.baseItemsSubtotal.toFixed(2)}</span>
          </div>
          ${inv.sizeExtrasTotal > 0
        ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 10.5px; color: #1d4ed8;">Size Upgrades</span>
            <span style="font-size: 10.5px; font-weight: 600; color: #1d4ed8;">+₹${inv.sizeExtrasTotal.toFixed(2)}</span>
          </div>`
        : ''
      }
          ${inv.addOnsExtrasTotal > 0
        ? `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 10.5px; color: #ea580c;">Add-ons &amp; Extras</span>
            <span style="font-size: 10.5px; font-weight: 600; color: #ea580c;">+₹${inv.addOnsExtrasTotal.toFixed(2)}</span>
          </div>`
        : ''
      }
          `
      : ''
    }

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #71717a;">Item Subtotal</span>
            <span style="font-size: 11px; font-weight: 700; color: #09090b;">₹${inv.itemSubtotal.toFixed(2)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #71717a;">Packaging Charges</span>
            <span style="font-size: 11px; font-weight: 700; color: #09090b;">
              ${inv.packagingFee > 0 ? `₹${inv.packagingFee.toFixed(2)}` : '₹0.00'}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #71717a;">Delivery Partner Fee</span>
            <span>
              ${inv.deliveryFee === 0
      ? '<span style="font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: #ecfdf5; color: #059669;">FREE</span>'
      : `<span style="font-size: 11px; font-weight: 700; color: #09090b;">₹${inv.deliveryFee.toFixed(2)}</span>`
    }
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; color: #71717a;">Platform Fee</span>
            <span style="font-size: 11px; font-weight: 700; color: #09090b;">₹${inv.platformFee.toFixed(2)}</span>
          </div>

          ${inv.discountTotal > 0
      ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; color: #059669; font-weight: 600;">Discounts Applied</span>
              <span style="font-size: 11px; font-weight: 800; color: #059669;">-₹${inv.discountTotal.toFixed(2)}</span>
            </div>
          `
      : ''
    }

          <div style="height: 1px; background: #e4e4e7; margin: 8px 0;"></div>

          <!-- Dynamic Tax Lines (Never combined with packaging) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 600; color: #71717a;">Taxable Supply Value</span>
            <span style="font-size: 10px; font-weight: 700; color: #3f3f46;">₹${inv.taxableAmount.toFixed(2)}</span>
          </div>

          ${inv.taxes && inv.taxes.length > 0
      ? inv.taxes
        .map(
          (t) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 10.5px; color: #52525b;">${t.name}</span>
                  <span style="font-size: 10.5px; font-weight: 700; color: #09090b;">₹${t.amount.toFixed(2)}</span>
                </div>
              `
        )
        .join('')
      : `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 10.5px; color: #52525b;">GST (Tax Exempt / 0%)</span>
                  <span style="font-size: 10.5px; font-weight: 700; color: #09090b;">₹0.00</span>
                </div>
              `
    }

          <div style="height: 1px; background: #e4e4e7; margin: 8px 0;"></div>

          <!-- Iconic Deep Charcoal Grand Total Box -->
          <div style="background: #09090b; border-radius: 10px; padding: 11px 13px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa;">Grand Total</div>
              <div style="font-size: 8.5px; color: #71717a;">(All taxes included)</div>
            </div>
            <div style="font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: #f97316;">₹${inv.grandTotal.toFixed(2)}</div>
          </div>

          <!-- Settlement Summary (Amount Paid vs Balance Due) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 0 4px; font-size: 10px;">
            <div>
              <span style="color: #71717a;">Amount Paid: </span>
              <strong style="color: #059669;">₹${inv.amountPaid.toFixed(2)}</strong>
            </div>
            <div>
              <span style="color: #71717a;">Balance Due: </span>
              <strong style="color: ${inv.balanceDue > 0 ? '#d97706' : '#27272a'};">₹${inv.balanceDue.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 5. FOOTER & COMPLIANCE ================= -->
      <div style="border-top: 1px solid #f4f4f5; padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 0; font-size: 9.5px; color: #71717a; line-height: 1.4;">
            This is a computer-generated tax invoice issued in compliance with the Information Technology Act 2000 and GST Rules.
          </p>
          <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #a1a1aa;">
            Disputes & support: <a href="mailto:hunger@gmail.com" style="color: #ea580c; text-decoration: none; font-weight: 600;">hunger@gmail.com</a> &bull; 24x7 Customer Desk (+91 6393752013) &bull; akrhunger.com
          </p>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-size: 10.5px; font-weight: 800; color: #09090b; letter-spacing: -0.01em;">Hunger &bull; Happy Dining! 🍽️</div>
          <div style="font-size: 8.5px; color: #a1a1aa; margin-top: 1px;">Taste Delivered in Minutes</div>
        </div>
      </div>
    </div>
  `;
}
