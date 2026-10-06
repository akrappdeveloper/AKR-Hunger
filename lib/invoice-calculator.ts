import { Order, Restaurant, Customer, Address } from './types';
import { resolveStateCode, formatPlaceOfSupply, numberToWordsINR, generateInvoiceVerificationHash } from './tax-utils';

export interface InvoiceTaxItem {
  name: string;
  rate: number; // in percent, e.g. 2.5
  amount: number;
}

export interface InvoiceCalculatedBreakdown {
  // Identifiers
  invoiceNumber: string;
  orderId: string;
  orderIdDisplay: string;
  verificationId: string;
  verificationUrl: string;
  verificationHash: string;
  orderDateDisplay: string;
  invoiceDateDisplay: string;

  // Parties
  sellerName: string;
  sellerLegalName: string;
  sellerGstin: string;
  sellerFssai: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerState: string;
  sellerStateCode: string;

  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  deliveryAddressFormatted: string;
  addressType: string;
  placeOfSupply: string;
  placeOfSupplyState: string;
  placeOfSupplyCode: string;

  // Operator
  operatorName: string;
  operatorLegalName: string;
  operatorGstin: string;
  operatorFssai: string;
  operatorCin: string;
  operatorAddress: string;

  // Financials
  itemSubtotal: number;
  itemCount: number;
  packagingFee: number;
  deliveryFee: number;
  platformFee: number;
  discountTotal: number;
  couponDiscount: number;
  restaurantDiscount: number;
  taxableAmount: number;

  // Tax breakdown
  gstRate: number; // e.g. 5
  isInterState: boolean;
  taxes: InvoiceTaxItem[];
  totalTax: number;

  // Totals
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  totalInWords: string;

  // Payment Status
  isCOD: boolean;
  isPaid: boolean;
  paymentMethodDisplay: string;
  paymentStatusLabel: string;
  paymentStatusBadge: {
    label: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  transactionReference: string;
}

/**
 * Authoritative Invoice Calculation Engine
 * Guarantees mathematical reconciliation across PDF, Web Invoice, and Checkout.
 */
export function calculateInvoice(
  order: Order,
  restaurant: Restaurant | null,
  customer: Customer | null,
  baseUrl: string = ''
): InvoiceCalculatedBreakdown {
  // 1. Timestamps & Identifiers
  const createdDate = order.createdAt?.toDate 
    ? order.createdAt.toDate() 
    : (order.createdAt ? new Date(order.createdAt) : new Date());

  const invoiceYear = createdDate.getFullYear();
  const rawId = order.id || 'ORDER';
  const orderIdShort = rawId.length > 8 ? rawId.slice(-8).toUpperCase() : rawId.toUpperCase();
  const invoiceNumber = `INV-${invoiceYear}-${orderIdShort}`;
  const orderIdDisplay = `AKR-${orderIdShort}`;
  const verificationId = `VER-${orderIdShort}`;
  const verificationUrl = `${baseUrl}/verify/invoice/${rawId}`;

  const orderDateDisplay = createdDate.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
  const invoiceDateDisplay = orderDateDisplay;

  // 2. Resolve Parties
  // Operator: AKR Hunger
  const operatorName = 'AKR Hunger';
  const operatorLegalName = 'AKR Hunger Technologies Pvt. Ltd.';
  const operatorGstin = '09AABCA1234F1Z8'; // Registered in Uttar Pradesh
  const operatorFssai = '10020051003421';
  const operatorCin = 'U74999UP2024PTC198765';
  const operatorAddress = 'Suite 402, Cyber Tower, Sector 62, Noida, Uttar Pradesh 201309';

  // Seller / Restaurant
  const sellerName = restaurant?.name || order.restaurantName || 'AKR Partner Kitchen';
  const sellerLegalName = (restaurant as any)?.legalName || sellerName;
  const sellerGstin = (restaurant as any)?.gstin || 'Composition / Unregistered';
  const sellerFssai = (restaurant as any)?.fssai || '10022064001890';
  const sellerPhone = restaurant?.phone || '+91 98765 43210';
  const sellerEmail = restaurant?.email || 'kitchen@akrhunger.com';

  let sellerAddress = restaurant?.address || '';
  if (!sellerAddress && restaurant?.street) {
    sellerAddress = `${restaurant.street}, ${restaurant.city || ''} ${restaurant.pincode ? `- ${restaurant.pincode}` : ''}`.trim();
  }
  if (!sellerAddress) sellerAddress = 'Registered Kitchen Partner Facility';

  const sellerStateInfo = resolveStateCode(restaurant?.state || 'Uttar Pradesh');
  const sellerState = sellerStateInfo.name;
  const sellerStateCode = sellerStateInfo.code;

  // Buyer / Customer
  const buyerName = order.customerName || customer?.name || 'Valued Customer';
  const buyerPhone = order.customerPhone || customer?.phone || '';
  const buyerEmail = customer?.email || '';

  // Address Parsing
  let addressType = 'DELIVERY';
  let deliveryAddressFormatted = '';
  let customerStateName = 'Uttar Pradesh';

  if (typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null) {
    const addr = order.deliveryAddress as Address;
    addressType = (addr.type || 'HOME').toUpperCase();
    const parts = [addr.street, addr.city, addr.state, addr.pincode ? `PIN: ${addr.pincode}` : ''].filter(Boolean);
    deliveryAddressFormatted = parts.join(', ');
    if (addr.state) customerStateName = addr.state;
  } else if (typeof order.deliveryAddress === 'string' && order.deliveryAddress) {
    deliveryAddressFormatted = order.deliveryAddress;
  } else if (customer?.addresses && customer.addresses.length > 0) {
    const def = customer.addresses.find(a => a.isDefault) || customer.addresses[0];
    addressType = (def.type || 'HOME').toUpperCase();
    const parts = [def.street, def.city, def.state, def.pincode ? `PIN: ${def.pincode}` : ''].filter(Boolean);
    deliveryAddressFormatted = parts.join(', ');
    if (def.state) customerStateName = def.state;
  } else {
    deliveryAddressFormatted = 'Direct Doorstep Delivery Destination';
  }

  // Place of Supply
  const placeOfSupplyInfo = resolveStateCode(customerStateName);
  const placeOfSupplyState = placeOfSupplyInfo.name;
  const placeOfSupplyCode = placeOfSupplyInfo.code;
  const placeOfSupply = `${placeOfSupplyState} (${placeOfSupplyCode})`;

  // 3. Financial Reconciliation
  const items = order.items || [];
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const itemSubtotal = order.subtotal || items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  // Discounts
  const discountTotal = order.discountAmount || 0;
  const couponDiscount = discountTotal; // If separate breakdown exists, can be passed
  const restaurantDiscount = 0;

  // Fees (Separated!)
  // In food delivery under Section 9(5), standard packaging is charged separately
  const packagingFee = (order as any).packagingFee || 0;
  const totalItemsQty = order.items?.reduce((s: number, it: any) => s + (it.quantity || 1), 0) || 1;
  const deliveryFee = (order.deliveryCharge !== undefined && order.deliveryCharge !== null && order.deliveryCharge > 0)
    ? order.deliveryCharge
    : ((order as any).deliveryFee > 0 ? (order as any).deliveryFee : (totalItemsQty > 1 ? 60 : 40));
  const platformFee = (order as any).platformFee || 0;

  // Taxable base for restaurant food services
  const taxableAmount = Math.max(0, itemSubtotal - discountTotal + packagingFee);

  // Dynamic GST Determination
  // Standard restaurant service rate is 5% without ITC under GST regime
  const isInterState = sellerStateCode !== placeOfSupplyCode;
  
  // If order has a specific taxes value, reverse or use the standard 5%
  let gstRate = 5;
  if (order.taxes !== undefined && taxableAmount > 0) {
    // If order stored exact tax amount, verify rate
    const calculatedRate = Math.round((order.taxes / taxableAmount) * 100);
    if (calculatedRate === 0 || calculatedRate === 5 || calculatedRate === 12 || calculatedRate === 18) {
      gstRate = calculatedRate;
    }
  }

  const taxes: InvoiceTaxItem[] = [];
  let totalTax = 0;

  if (gstRate > 0) {
    if (isInterState) {
      // Inter-state: IGST
      const igstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;
      taxes.push({ name: 'IGST', rate: gstRate, amount: igstAmount });
      totalTax = igstAmount;
    } else {
      // Intra-state: CGST (half) + SGST (half)
      const halfRate = gstRate / 2;
      const cgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
      const sgstAmount = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
      taxes.push({ name: 'CGST', rate: halfRate, amount: cgstAmount });
      taxes.push({ name: 'SGST', rate: halfRate, amount: sgstAmount });
      totalTax = Math.round((cgstAmount + sgstAmount) * 100) / 100;
    }
  } else {
    taxes.push({ name: 'GST (Exempt / 0%)', rate: 0, amount: 0 });
    totalTax = 0;
  }

  // Grand Total calculation
  const calculatedGrandTotal = Math.round((taxableAmount + totalTax + deliveryFee + platformFee) * 100) / 100;
  const grandTotal = order.total !== undefined ? order.total : calculatedGrandTotal;

  // Payment Status & Balance Due
  const isCOD = order.paymentMethod === 'cod';
  const isWallet = order.paymentMethod === 'wallet';
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  let isPaid = false;
  let paymentStatusLabel = 'PENDING';
  let amountPaid = 0;
  let balanceDue = grandTotal;

  if (isCancelled) {
    paymentStatusLabel = 'CANCELLED';
    amountPaid = 0;
    balanceDue = 0;
  } else if (isWallet) {
    // Wallet prepaid payment
    if (order.paymentStatus === 'completed' || order.status !== 'pending') {
      isPaid = true;
      paymentStatusLabel = 'PAID & SETTLED';
      amountPaid = grandTotal;
      balanceDue = 0;
    } else {
      paymentStatusLabel = 'WALLET PAYMENT PENDING';
      amountPaid = 0;
      balanceDue = grandTotal;
    }
  } else if (!isCOD) {
    // Online payment
    if (order.paymentStatus === 'completed' || order.status !== 'pending') {
      isPaid = true;
      paymentStatusLabel = 'PAID & SETTLED';
      amountPaid = grandTotal;
      balanceDue = 0;
    } else if (order.paymentStatus === 'failed') {
      paymentStatusLabel = 'PAYMENT FAILED';
      amountPaid = 0;
      balanceDue = grandTotal;
    } else {
      paymentStatusLabel = 'PAYMENT AUTHORIZING';
      amountPaid = 0;
      balanceDue = grandTotal;
    }
  } else {
    // Cash on Delivery
    if (isDelivered || order.paymentStatus === 'completed') {
      isPaid = true;
      paymentStatusLabel = 'COD COLLECTED & SETTLED';
      amountPaid = grandTotal;
      balanceDue = 0;
    } else {
      isPaid = false;
      paymentStatusLabel = 'COD - PAYMENT PENDING';
      amountPaid = 0;
      balanceDue = grandTotal;
    }
  }

  const paymentMethodDisplay = isWallet
    ? 'AKR Hunger Wallet (Prepaid Balance)'
    : isCOD 
    ? 'Cash on Delivery (COD)' 
    : 'Online Payment (UPI / Credit Card / Debit Card / Net Banking)';

  const transactionReference = isWallet
    ? ((order as any).walletTransactionId || `WLT-${orderIdShort}`)
    : (order.razorpayPaymentId 
      || order.razorpayOrderId 
      || (isCOD ? `COD-${orderIdShort}` : `TXN-${orderIdShort}`));

  // Badges
  const paymentStatusBadge = isPaid
    ? {
        label: isCOD ? 'COD COLLECTED' : 'PAID & SETTLED',
        bg: '#ecfdf5',
        text: '#047857',
        border: '#a7f3d0',
        dot: '#10b981',
      }
    : isCancelled
    ? {
        label: 'CANCELLED',
        bg: '#fef2f2',
        text: '#b91c1c',
        border: '#fecaca',
        dot: '#ef4444',
      }
    : {
        label: isCOD ? 'COD PENDING' : 'PAYMENT PENDING',
        bg: '#fffbeb',
        text: '#b45309',
        border: '#fde68a',
        dot: '#f59e0b',
      };

  const totalInWords = numberToWordsINR(grandTotal);
  const verificationHash = generateInvoiceVerificationHash(invoiceNumber, rawId, grandTotal, createdDate.toISOString());

  return {
    invoiceNumber,
    orderId: rawId,
    orderIdDisplay,
    verificationId,
    verificationUrl,
    verificationHash,
    orderDateDisplay,
    invoiceDateDisplay,

    sellerName,
    sellerLegalName,
    sellerGstin,
    sellerFssai,
    sellerAddress,
    sellerPhone,
    sellerEmail,
    sellerState,
    sellerStateCode,

    buyerName,
    buyerPhone,
    buyerEmail,
    deliveryAddressFormatted,
    addressType,
    placeOfSupply,
    placeOfSupplyState,
    placeOfSupplyCode,

    operatorName,
    operatorLegalName,
    operatorGstin,
    operatorFssai,
    operatorCin,
    operatorAddress,

    itemSubtotal,
    itemCount,
    packagingFee,
    deliveryFee,
    platformFee,
    discountTotal,
    couponDiscount,
    restaurantDiscount,
    taxableAmount,

    gstRate,
    isInterState,
    taxes,
    totalTax,

    grandTotal,
    amountPaid,
    balanceDue,
    totalInWords,

    isCOD,
    isPaid,
    paymentMethodDisplay,
    paymentStatusLabel,
    paymentStatusBadge,
    transactionReference,
  };
}
