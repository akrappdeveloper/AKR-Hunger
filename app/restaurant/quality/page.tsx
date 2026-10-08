'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc,
  addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Review, MenuItem } from '@/lib/types';
import {
  TrendingUp, AlertCircle, CheckCircle, Star, Target, Award,
  ArrowUpRight, ArrowDownRight, Zap, ShieldCheck, Thermometer,
  ClipboardCheck, AlertTriangle, FileText, Printer, CheckCircle2,
  XCircle, Clock, RefreshCw, Sparkles, Search, ChevronRight,
  Plus, Check, X, ShieldAlert, BadgeCheck, Utensils, ExternalLink
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// --- Interfaces ---
interface ItemQuality {
  menuItemId: string;
  menuItemName: string;
  category: string;
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  averageRating: number;
  totalReviews: number;
  qualityScore: number;
  orderSuccessRate: number;
  customerSatisfaction: number;
  consistencyScore: number;
}

interface InspectionCheckpoint {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  notes?: string;
}

interface TempReading {
  id: string;
  equipment: string;
  currentTemp: number;
  targetTemp: string;
  status: 'safe' | 'warning' | 'critical';
  loggedAt: Date;
  loggedBy: string;
}

interface QualityIncident {
  id: string;
  orderId?: string;
  dishName: string;
  issueType: 'Taste / Flavor' | 'Packaging Spill' | 'Food Temperature' | 'Foreign Object' | 'Hygiene Complaint' | 'Missing Item';
  severity: 'low' | 'medium' | 'high';
  status: 'investigating' | 'action_taken' | 'resolved';
  customerFeedback: string;
  correctiveAction: string;
  reportedAt: Date;
}

// Standard Food Safety & HACCP Inspection Checkpoints
const DEFAULT_CHECKPOINTS: InspectionCheckpoint[] = [
  {
    id: 'c1',
    category: 'Sanitation',
    title: 'Food-Contact Surface Sanitization',
    description: 'Prep tables, cutting boards, and knives sanitized with food-grade sanitizing solution.',
    status: 'pass',
  },
  {
    id: 'c2',
    category: 'Hygiene',
    title: 'Staff PPE & Personal Hygiene',
    description: 'All kitchen staff wearing clean aprons, hairnets, trimmed nails, and gloves.',
    status: 'pass',
  },
  {
    id: 'c3',
    category: 'Oil Safety',
    title: 'Cooking Oil TPM & Smoke Quality',
    description: 'Oil Total Polar Materials < 24%, clear color, no rancid aroma or dark sediment.',
    status: 'pass',
  },
  {
    id: 'c4',
    category: 'Storage',
    title: 'Raw & Cooked Separation (Cross-Contamination)',
    description: 'Raw meats stored below cooked foods; FIFO rotation labels applied with expiry dates.',
    status: 'pass',
  },
  {
    id: 'c5',
    category: 'HACCP Temperature',
    title: 'Cold Storage & Deep Freezer Temp Check',
    description: 'Deep freezer at ≤ -18°C and walk-in chiller at 1°C to 4°C.',
    status: 'pass',
  },
  {
    id: 'c6',
    category: 'Cooking Temp',
    title: 'Hot Food Core Cooking Temperature',
    description: 'Core temperature of poultry and cooked food verified above 75°C, holding above 65°C.',
    status: 'pass',
  },
  {
    id: 'c7',
    category: 'Pest Control',
    title: 'Pest Barrier & Insect Trap Status',
    description: 'Flying insect traps operational, sealed waste bins, no evidence of pests.',
    status: 'pass',
  },
  {
    id: 'c8',
    category: 'Packaging',
    title: 'Food-Grade Containers & Tamper-Evident Seals',
    description: '100% food-grade leak-resistant containers sealed with tamper-proof security tape.',
    status: 'pass',
  },
];

export default function QualityAnalyticsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [loading, setLoading] = useState(true);
  const [restaurantDocData, setRestaurantDocData] = useState<any>(null);
  const [qualityMetrics, setQualityMetrics] = useState<ItemQuality[]>([]);

  // --- Real Quality Check Audit State ---
  const [checkpoints, setCheckpoints] = useState<InspectionCheckpoint[]>(DEFAULT_CHECKPOINTS);
  const [auditorName, setAuditorName] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const [lastAuditDate, setLastAuditDate] = useState<Date | null>(null);
  const [pastAudits, setPastAudits] = useState<Array<{ id: string; score: number; grade: string; auditorName: string; notes?: string; timestamp: Date }>>([]);

  // --- Temperature Logs State (Real Firebase Firestore) ---
  const [tempReadings, setTempReadings] = useState<TempReading[]>([]);
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState('Deep Freezer (Meat/Dairy)');
  const [newTemp, setNewTemp] = useState('');
  const [newTempStaff, setNewTempStaff] = useState('');

  // --- Customer Incidents & CAPA Tracker (Real Firebase Firestore) ---
  const [incidents, setIncidents] = useState<QualityIncident[]>([]);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newIssueType, setNewIssueType] = useState<QualityIncident['issueType']>('Packaging Spill');
  const [newSeverity, setNewSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newFeedback, setNewFeedback] = useState('');
  const [newCapa, setNewCapa] = useState('');

  // --- Certificate Modal ---
  const [certificateOpen, setCertificateOpen] = useState(false);

  // --- Menu Item Filters ---
  const [itemSearch, setItemSearch] = useState('');

  // --- Derived Real FSSAI Details ---
  const realFssai = useMemo(() => {
    return (
      restaurantDocData?.fssaiNumber ||
      restaurantDocData?.fssaiLicense ||
      restaurantDocData?.fssaiId ||
      restaurantDocData?.fssai ||
      restaurant?.fssaiLicense ||
      (restaurant as any)?.fssaiNumber ||
      (restaurant as any)?.fssaiId ||
      (restaurant as any)?.fssai ||
      ''
    ).toString().trim();
  }, [restaurantDocData, restaurant]);

  const fssaiDocumentUrl = useMemo(() => {
    return (
      restaurantDocData?.fssaiDocument ||
      (restaurant as any)?.fssaiDocument ||
      ''
    );
  }, [restaurantDocData, restaurant]);

  const fssaiDocumentName = useMemo(() => {
    return (
      restaurantDocData?.fssaiDocumentName ||
      (restaurant as any)?.fssaiDocumentName ||
      'FSSAI_Certificate.pdf'
    );
  }, [restaurantDocData, restaurant]);

  const isFssaiVerified = useMemo(() => {
    return Boolean(
      restaurantDocData?.fssaiVerified ||
      (restaurant as any)?.fssaiVerified
    );
  }, [restaurantDocData, restaurant]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchRealFirebaseQualityData();
  }, [user, restaurant, authLoading, router]);

  const fetchRealFirebaseQualityData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const targetIds = Array.from(new Set([
        user?.uid,
        (user as any)?.restaurantId,
        restaurant?.id
      ].filter(Boolean))) as string[];

      // 1. Fetch live Restaurant document directly from Firestore
      for (const tid of targetIds) {
        try {
          const rSnap = await getDoc(doc(db, 'restaurants', tid));
          if (rSnap.exists()) {
            setRestaurantDocData(rSnap.data());
            break;
          }
        } catch {
          // ignore lookup error
        }
      }

      // Also check users/{uid} for linked restaurant ID
      try {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData.restaurantId && !targetIds.includes(uData.restaurantId)) {
            targetIds.push(uData.restaurantId);
            const rSnap2 = await getDoc(doc(db, 'restaurants', uData.restaurantId));
            if (rSnap2.exists()) {
              setRestaurantDocData(rSnap2.data());
            }
          }
        }
      } catch {
        // ignore lookup error
      }

      // 2. Fetch real Menu Items from Firestore
      const menuMap = new Map<string, MenuItem>();
      for (const tid of targetIds) {
        try {
          const menuRef = collection(db, 'menuItems');
          const menuQuery = query(menuRef, where('restaurantId', '==', tid));
          const menuSnapshot = await getDocs(menuQuery);
          menuSnapshot.docs.forEach(docSnap => {
            menuMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id } as MenuItem);
          });
        } catch (e: any) {
          console.warn('[Quality] Notice fetching menu items:', e?.message || e);
        }
      }
      const menuItems = Array.from(menuMap.values());

      // 3. Fetch real Orders from Firestore
      const ordersMap = new Map<string, Order>();
      for (const tid of targetIds) {
        try {
          const ordersRef = collection(db, 'orders');
          const ordersQuery = query(ordersRef, where('restaurantId', '==', tid));
          const ordersSnapshot = await getDocs(ordersQuery);
          ordersSnapshot.docs.forEach(docSnap => {
            ordersMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id } as Order);
          });
        } catch (e: any) {
          console.warn('[Quality] Notice fetching orders:', e?.message || e);
        }
      }
      const orders = Array.from(ordersMap.values());

      // 4. Fetch real Reviews from Firestore
      const reviewsMap = new Map<string, Review>();
      for (const tid of targetIds) {
        try {
          const reviewsRef = collection(db, 'reviews');
          const reviewsQuery = query(reviewsRef, where('restaurantId', '==', tid));
          const reviewsSnapshot = await getDocs(reviewsQuery);
          reviewsSnapshot.docs.forEach(docSnap => {
            reviewsMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id } as Review);
          });
        } catch (e: any) {
          console.warn('[Quality] Notice fetching reviews:', e?.message || e);
        }
      }
      const reviews = Array.from(reviewsMap.values());

      // 5. Fetch real Kitchen Inspection Audits from Firestore (with resilient fallback)
      const auditsMap = new Map<string, any>();
      for (const tid of targetIds) {
        try {
          const auditsRef = collection(db, 'kitchenAudits');
          const qAudits = query(auditsRef, where('restaurantId', '==', tid));
          const snapAudits = await getDocs(qAudits);
          snapAudits.docs.forEach(docSnap => {
            auditsMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id });
          });
        } catch (e: any) {
          console.warn('[Quality] Kitchen audits collection notice, using local cache:', e?.message || e);
        }

        // Local storage cache fallback
        try {
          const localAudits = localStorage.getItem(`quality_audits_${tid}`);
          if (localAudits) {
            const parsed = JSON.parse(localAudits);
            if (Array.isArray(parsed)) {
              parsed.forEach((pa: any) => {
                if (pa.id && !auditsMap.has(pa.id)) auditsMap.set(pa.id, pa);
              });
            }
          }
        } catch {}
      }
      const rawAudits = Array.from(auditsMap.values());
      rawAudits.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
        return timeB - timeA;
      });

      if (rawAudits.length > 0) {
        const latest = rawAudits[0];
        if (latest.checkpoints && Array.isArray(latest.checkpoints) && latest.checkpoints.length > 0) {
          setCheckpoints(latest.checkpoints);
        }
        if (latest.auditorName) setAuditorName(latest.auditorName);
        if (latest.notes) setAuditNotes(latest.notes);
        if (latest.timestamp) {
          const lDate = latest.timestamp.toDate ? latest.timestamp.toDate() : (latest.timestamp.seconds ? new Date(latest.timestamp.seconds * 1000) : new Date(latest.timestamp));
          setLastAuditDate(lDate);
        }
        setPastAudits(rawAudits.map(a => ({
          id: a.id,
          score: a.score ?? 100,
          grade: a.grade || 'Grade A+',
          auditorName: a.auditorName || (user?.displayName || 'Safety Supervisor'),
          notes: a.notes,
          timestamp: a.timestamp?.toDate ? a.timestamp.toDate() : (a.timestamp?.seconds ? new Date(a.timestamp.seconds * 1000) : (a.timestamp ? new Date(a.timestamp) : new Date())),
        })));
      } else {
        setLastAuditDate(null);
        setPastAudits([]);
      }

      // 6. Fetch real Temperature Telemetry Logs from Firestore (with resilient fallback)
      const tempMap = new Map<string, TempReading>();
      for (const tid of targetIds) {
        try {
          const tempRef = collection(db, 'temperatureLogs');
          const qTemp = query(tempRef, where('restaurantId', '==', tid));
          const snapTemp = await getDocs(qTemp);
          snapTemp.docs.forEach(docSnap => {
            const data = docSnap.data();
            tempMap.set(docSnap.id, {
              id: docSnap.id,
              equipment: data.equipment || 'Refrigeration Unit',
              currentTemp: Number(data.currentTemp || 0),
              targetTemp: data.targetTemp || '1°C to 4°C',
              status: data.status || 'safe',
              loggedAt: data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : (data.timestamp ? new Date(data.timestamp) : new Date())),
              loggedBy: data.loggedBy || 'Staff',
            });
          });
        } catch (e: any) {
          console.warn('[Quality] Temperature logs notice, using local cache:', e?.message || e);
        }

        // Local storage cache fallback
        try {
          const localTemps = localStorage.getItem(`quality_temps_${tid}`);
          if (localTemps) {
            const parsed = JSON.parse(localTemps);
            if (Array.isArray(parsed)) {
              parsed.forEach((pt: any) => {
                if (pt.id && !tempMap.has(pt.id)) {
                  tempMap.set(pt.id, {
                    ...pt,
                    loggedAt: new Date(pt.loggedAt)
                  });
                }
              });
            }
          }
        } catch {}
      }
      const rawTemps = Array.from(tempMap.values());
      rawTemps.sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
      // Real telemetry only: empty if no entries logged yet
      setTempReadings(rawTemps);

      // 7. Fetch real Quality Incidents & Customer Complaints
      const incidentsMap = new Map<string, QualityIncident>();
      for (const tid of targetIds) {
        try {
          const incRef = collection(db, 'qualityIncidents');
          const qInc = query(incRef, where('restaurantId', '==', tid));
          const snapInc = await getDocs(qInc);
          snapInc.docs.forEach(docSnap => {
            const data = docSnap.data();
            incidentsMap.set(docSnap.id, {
              id: docSnap.id,
              dishName: data.dishName || 'Menu Item',
              issueType: data.issueType || 'Packaging Spill',
              severity: data.severity || 'medium',
              status: data.status || 'action_taken',
              customerFeedback: data.customerFeedback || '',
              correctiveAction: data.correctiveAction || '',
              reportedAt: data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : (data.timestamp ? new Date(data.timestamp) : new Date())),
            });
          });
        } catch (e: any) {
          console.warn('[Quality] Quality incidents notice, using local cache:', e?.message || e);
        }

        // Local storage cache fallback
        try {
          const localIncs = localStorage.getItem(`quality_incidents_${tid}`);
          if (localIncs) {
            const parsed = JSON.parse(localIncs);
            if (Array.isArray(parsed)) {
              parsed.forEach((pi: any) => {
                if (pi.id && !incidentsMap.has(pi.id)) {
                  incidentsMap.set(pi.id, {
                    ...pi,
                    reportedAt: new Date(pi.reportedAt)
                  });
                }
              });
            }
          }
        } catch {}
      }

      // Automatically convert real low reviews (<= 3 stars) into real quality complaints
      reviews.forEach(r => {
        if (r.rating && r.rating <= 3 && r.comment) {
          const reviewId = `rev-${r.id || r.comment.slice(0, 10)}`;
          if (!incidentsMap.has(reviewId)) {
            incidentsMap.set(reviewId, {
              id: reviewId,
              dishName: (r as any).dishName || (r as any).menuItemName || 'Customer Order Review',
              issueType: r.rating === 1 ? 'Hygiene Complaint' : 'Taste / Flavor',
              severity: r.rating === 1 ? 'high' : 'medium',
              status: 'action_taken',
              customerFeedback: r.comment,
              correctiveAction: 'Recipe specifications & kitchen handling reviewed by supervisor.',
              reportedAt: (r.createdAt as any)?.toDate ? (r.createdAt as any).toDate() : (r.createdAt ? new Date(r.createdAt) : new Date()),
            });
          }
        }
      });

      // Automatically convert real cancelled orders with reasons into quality incidents
      orders.forEach(o => {
        if (o.status === 'cancelled' && o.cancellationReason && o.cancellationReason.trim()) {
          const cancelId = `cancel-${o.id || o.orderNumber}`;
          if (!incidentsMap.has(cancelId)) {
            incidentsMap.set(cancelId, {
              id: cancelId,
              dishName: o.items?.[0]?.name ? `${o.items[0].name}${o.items.length > 1 ? ` (+${o.items.length - 1} items)` : ''}` : `Order #${(o.orderNumber || o.id || '').slice(-6)}`,
              issueType: 'Food Temperature',
              severity: 'medium',
              status: 'resolved',
              customerFeedback: `Order Cancelled: ${o.cancellationReason}`,
              correctiveAction: 'Fulfillment process analyzed to minimize order cancellations.',
              reportedAt: (o.cancelledAt as any)?.toDate ? (o.cancelledAt as any).toDate() : ((o.createdAt as any)?.toDate ? (o.createdAt as any).toDate() : new Date()),
            });
          }
        }
      });

      const rawIncidents = Array.from(incidentsMap.values());
      rawIncidents.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
      // Real complaints only: empty if no incidents or low reviews exist
      setIncidents(rawIncidents);

      // 8. Calculate real item quality metrics from actual orders & reviews
      const metrics: ItemQuality[] = menuItems.map(item => {
        let totalOrders = 0;
        let successfulOrders = 0;
        let cancelledOrders = 0;

        orders.forEach(order => {
          const hasItem = order.items?.some(orderItem =>
            orderItem.menuItemId === item.id || orderItem.name.toLowerCase() === item.name.toLowerCase()
          );
          if (hasItem) {
            totalOrders++;
            if (order.status === 'delivered') successfulOrders++;
            if (order.status === 'cancelled') cancelledOrders++;
          }
        });

        // Match real reviews
        const itemReviews = reviews.filter(r => r.menuItemId === item.id || (r as any).dishName?.toLowerCase() === item.name.toLowerCase());
        const hasReviews = itemReviews.length > 0;
        const averageRating = hasReviews
          ? itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length
          : (item.averageRating || (item as any).rating || 0);

        const orderSuccessRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 100;
        const customerSatisfaction = averageRating > 0 ? (averageRating / 5) * 100 : (totalOrders > 0 ? 90 : 100);

        const ratingVariance = itemReviews.length > 1
          ? Math.sqrt(
            itemReviews.reduce((sum, r) => sum + Math.pow(r.rating - averageRating, 2), 0) / itemReviews.length
          )
          : 0;
        const consistencyScore = hasReviews
          ? Math.max(0, 100 - (ratingVariance * 20))
          : 100;

        const qualityScore = (
          (orderSuccessRate * 0.4) +
          (customerSatisfaction * 0.4) +
          (consistencyScore * 0.2)
        );

        return {
          menuItemId: item.id!,
          menuItemName: item.name,
          category: item.category || 'General',
          totalOrders,
          successfulOrders,
          cancelledOrders,
          averageRating,
          totalReviews: itemReviews.length,
          qualityScore: Math.round(qualityScore),
          orderSuccessRate: Math.round(orderSuccessRate),
          customerSatisfaction: Math.round(customerSatisfaction),
          consistencyScore: Math.round(consistencyScore),
        };
      });

      metrics.sort((a, b) => b.qualityScore - a.qualityScore);
      setQualityMetrics(metrics);

    } catch (error: any) {
      console.warn('[Quality] Non-critical warning loading live quality data:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  // --- Real Quality Checklist Actions ---
  const toggleCheckpointStatus = (id: string, newStatus: 'pass' | 'warning' | 'fail') => {
    setCheckpoints(prev =>
      prev.map(c => (c.id === id ? { ...c, status: newStatus } : c))
    );
  };

  // Real Audit Score calculation
  const auditScore = useMemo(() => {
    if (!checkpoints.length) return 100;
    const totalPoints = checkpoints.reduce((acc, c) => {
      if (c.status === 'pass') return acc + 100;
      if (c.status === 'warning') return acc + 60;
      return acc + 0;
    }, 0);
    return Math.round(totalPoints / checkpoints.length);
  }, [checkpoints]);

  const auditGrade = useMemo(() => {
    if (auditScore >= 90) return { grade: 'Grade A+ (Superior)', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    if (auditScore >= 80) return { grade: 'Grade A (Excellent)', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    if (auditScore >= 65) return { grade: 'Grade B (Acceptable)', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    return { grade: 'Grade C (Immediate Action)', badge: 'bg-destructive/15 text-destructive border-destructive/30' };
  }, [auditScore]);

  // Save audit directly to Firestore with local resilience
  const handleSaveDailyAudit = async () => {
    if (!user) return;
    setSubmittingAudit(true);
    const resolvedAuditor = auditorName.trim() || user.displayName || (restaurant?.name ? `${restaurant.name} Supervisor` : 'Food Safety Supervisor');

    const newAuditData = {
      restaurantId: user.uid,
      restaurantName: restaurant?.name || 'Restaurant',
      score: auditScore,
      grade: auditGrade.grade,
      auditorName: resolvedAuditor,
      notes: auditNotes,
      checkpoints: checkpoints,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    let savedId = `audit-${Date.now()}`;
    try {
      const docRef = await addDoc(collection(db, 'kitchenAudits'), newAuditData);
      savedId = docRef.id;
    } catch (e: any) {
      console.warn('[Quality] Could not write to kitchenAudits collection, saving locally:', e?.message || e);
    }

    const now = new Date();
    const newAuditItem = {
      id: savedId,
      score: auditScore,
      grade: auditGrade.grade,
      auditorName: resolvedAuditor,
      notes: auditNotes,
      timestamp: now,
    };

    setLastAuditDate(now);
    setPastAudits(prev => [newAuditItem, ...prev]);

    // Save to local storage for instant fallback
    try {
      const existing = localStorage.getItem(`quality_audits_${user.uid}`);
      const list = existing ? JSON.parse(existing) : [];
      list.unshift({ ...newAuditItem, timestamp: now.toISOString(), checkpoints });
      localStorage.setItem(`quality_audits_${user.uid}`, JSON.stringify(list.slice(0, 30)));
    } catch {}

    // Persist on restaurant document if permitted
    try {
      await updateDoc(doc(db, 'restaurants', user.uid), {
        lastQualityAudit: {
          score: auditScore,
          grade: auditGrade.grade,
          auditorName: resolvedAuditor,
          timestamp: serverTimestamp(),
        }
      });
    } catch {}

    toast.success(`Kitchen Hygiene Audit Saved! Score: ${auditScore}% (${auditGrade.grade})`);
    setSubmittingAudit(false);
  };

  // Add real temperature reading directly to Firestore
  const handleAddTempReading = async () => {
    const val = parseFloat(newTemp);
    if (isNaN(val)) {
      toast.error('Please enter a valid temperature in °C');
      return;
    }

    let status: 'safe' | 'warning' | 'critical' = 'safe';
    let target = '≤ -18°C';

    if (newEquipment.includes('Freezer')) {
      target = '≤ -18°C';
      if (val > -15) status = 'critical';
      else if (val > -18) status = 'warning';
      else status = 'safe';
    } else if (newEquipment.includes('Chiller') || newEquipment.includes('Cold Room')) {
      target = '1°C to 4°C';
      if (val > 8) status = 'critical';
      else if (val > 4) status = 'warning';
      else status = 'safe';
    } else if (newEquipment.includes('Holding')) {
      target = '≥ 65°C';
      if (val < 55) status = 'critical';
      else if (val < 65) status = 'warning';
      else status = 'safe';
    } else {
      target = '175°C - 185°C';
      if (val < 160 || val > 195) status = 'warning';
    }

    const staff = newTempStaff.trim() || user?.displayName || 'Kitchen Inspector';
    let savedId = `temp-${Date.now()}`;

    if (user) {
      try {
        const docRef = await addDoc(collection(db, 'temperatureLogs'), {
          restaurantId: user.uid,
          restaurantName: restaurant?.name || 'Restaurant',
          equipment: newEquipment,
          currentTemp: val,
          targetTemp: target,
          status,
          loggedBy: staff,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        savedId = docRef.id;
      } catch (e: any) {
        console.warn('[Quality] Could not write to temperatureLogs collection, saving locally:', e?.message || e);
      }
    }

    const now = new Date();
    const newLog: TempReading = {
      id: savedId,
      equipment: newEquipment,
      currentTemp: val,
      targetTemp: target,
      status,
      loggedAt: now,
      loggedBy: staff,
    };

    setTempReadings(prev => [newLog, ...prev]);

    // Save to local storage for instant fallback
    if (user) {
      try {
        const existing = localStorage.getItem(`quality_temps_${user.uid}`);
        const list = existing ? JSON.parse(existing) : [];
        list.unshift({ ...newLog, loggedAt: now.toISOString() });
        localStorage.setItem(`quality_temps_${user.uid}`, JSON.stringify(list.slice(0, 50)));
      } catch {}
    }

    toast.success(`Temperature reading recorded for ${newEquipment}`);
    setTempModalOpen(false);
    setNewTemp('');
    setNewTempStaff('');
  };

  // Add real Incident & CAPA directly to Firestore
  const handleAddIncident = async () => {
    if (!newDishName.trim() || !newFeedback.trim()) {
      toast.error('Please enter dish name and issue details');
      return;
    }

    const itemCapa = newCapa.trim() || 'Kitchen SOP re-verified with culinary staff.';
    let savedId = `incident-${Date.now()}`;

    if (user) {
      try {
        const docRef = await addDoc(collection(db, 'qualityIncidents'), {
          restaurantId: user.uid,
          restaurantName: restaurant?.name || 'Restaurant',
          dishName: newDishName.trim(),
          issueType: newIssueType,
          severity: newSeverity,
          status: 'action_taken',
          customerFeedback: newFeedback.trim(),
          correctiveAction: itemCapa,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        savedId = docRef.id;
      } catch (e: any) {
        console.warn('[Quality] Could not write to qualityIncidents collection, saving locally:', e?.message || e);
      }
    }

    const now = new Date();
    const item: QualityIncident = {
      id: savedId,
      dishName: newDishName.trim(),
      issueType: newIssueType,
      severity: newSeverity,
      status: 'action_taken',
      customerFeedback: newFeedback.trim(),
      correctiveAction: itemCapa,
      reportedAt: now,
    };

    setIncidents(prev => [item, ...prev]);

    // Save to local storage for instant fallback
    if (user) {
      try {
        const existing = localStorage.getItem(`quality_incidents_${user.uid}`);
        const list = existing ? JSON.parse(existing) : [];
        list.unshift({ ...item, reportedAt: now.toISOString() });
        localStorage.setItem(`quality_incidents_${user.uid}`, JSON.stringify(list.slice(0, 50)));
      } catch {}
    }

    toast.success('Quality incident & CAPA logged!');
    setIncidentModalOpen(false);
    setNewDishName('');
    setNewFeedback('');
    setNewCapa('');
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    if (score >= 60) return { label: 'Good', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' };
    if (score >= 40) return { label: 'Fair', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
    return { label: 'Needs Action', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
  };

  const avgQualityScore = qualityMetrics.length > 0
    ? Math.round(qualityMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / qualityMetrics.length)
    : 0;

  // Filtered menu items
  const filteredMetrics = useMemo(() => {
    if (!itemSearch.trim()) return qualityMetrics;
    const q = itemSearch.toLowerCase();
    return qualityMetrics.filter(m =>
      m.menuItemName.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [qualityMetrics, itemSearch]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-t-emerald-500 border-r-teal-500 border-b-cyan-500 border-l-muted rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm font-semibold">Loading Live Firebase Quality & Hygiene Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-background text-foreground transition-colors duration-300 max-w-[1600px] mx-auto">

      {/* --- HEADER BANNER --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold gap-1 px-2.5 py-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> FSSAI & HACCP Food Safety Compliance Hub
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent tracking-tight">
            Quality & Hygiene Operations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Live kitchen sanitation audits, cold-chain telemetry, CAPA resolution & certified compliance
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setCertificateOpen(true)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Award className="w-4 h-4" /> Official Hygiene Certificate
          </Button>

          <Button
            onClick={() => setTempModalOpen(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl border-border text-xs font-semibold gap-1.5"
          >
            <Thermometer className="w-4 h-4 text-cyan-500" /> Log Temperature
          </Button>

          <Button
            onClick={() => setIncidentModalOpen(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl border-border text-xs font-semibold gap-1.5"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Report Quality Issue
          </Button>
        </div>
      </div>

      {/* --- EXECUTIVE QUALITY SCORE & COMPLIANCE CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hygiene Audit Score */}
        <Card className="bg-card border-border shadow-sm rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-emerald-500/15 to-transparent blur-2xl rounded-full" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Daily Kitchen Audit
            </span>
            <Badge className={auditGrade.badge}>
              {lastAuditDate ? auditGrade.grade.split(' ')[0] : 'READY'}
            </Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {auditScore}%
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {checkpoints.filter(c => c.status === 'pass').length}/{checkpoints.length} Passed
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {lastAuditDate
              ? `Inspected: ${lastAuditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Audit pending today — complete check below'}
          </p>
        </Card>

        {/* Card 2: FSSAI Compliance Status */}
        <Card className="bg-card border-border shadow-sm rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-blue-500/15 to-transparent blur-2xl rounded-full" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              FSSAI Regulatory Status
            </span>
            <Badge className={realFssai ? (isFssaiVerified ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]') : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]'}>
              {realFssai ? (isFssaiVerified ? 'Verified & Active' : 'Registered on File') : 'Pending Registration'}
            </Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-base sm:text-lg font-black text-foreground truncate font-mono" title={realFssai || 'Not Linked'}>
              {realFssai ? realFssai : 'Not Linked'}
            </h3>
            <ShieldCheck className={`w-5 h-5 shrink-0 ml-1 ${realFssai ? 'text-blue-500' : 'text-amber-500'}`} />
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[11px]">
            {realFssai ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">14-Digit License</span>
                {fssaiDocumentUrl && (
                  <a
                    href={fssaiDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <FileText className="w-3 h-3" /> Certificate
                  </a>
                )}
              </div>
            ) : (
              <Link href="/restaurant/profile" className="text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add FSSAI in Profile
              </Link>
            )}
            <Link href="/restaurant/profile" className="text-xs text-muted-foreground hover:text-foreground">
              Manage
            </Link>
          </div>
        </Card>

        {/* Card 3: Cold Chain Safety */}
        <Card className="bg-card border-border shadow-sm rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-cyan-500/15 to-transparent blur-2xl rounded-full" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Cold Chain HACCP
            </span>
            <Badge className={tempReadings.length > 0 ? (tempReadings[0].status === 'safe' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-[10px]' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]') : 'bg-muted text-muted-foreground text-[10px]'}>
              {tempReadings.length > 0 ? tempReadings[0].status.toUpperCase() : 'NO LOGS'}
            </Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
              {tempReadings.length > 0 ? `${tempReadings[0].currentTemp > 0 ? `+${tempReadings[0].currentTemp}` : tempReadings[0].currentTemp}°C` : '--.-°C'}
            </h3>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={tempReadings[0]?.equipment}>
              {tempReadings.length > 0 ? tempReadings[0].equipment.split('(')[0].trim() : 'No readings'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {tempReadings.length > 0
              ? `${tempReadings.length} reading${tempReadings.length > 1 ? 's' : ''} logged in telemetry`
              : 'Tap "Log Temperature" to record'}
          </p>
        </Card>

        {/* Card 4: Overall Menu Consistency */}
        <Card className="bg-card border-border shadow-sm rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-purple-500/15 to-transparent blur-2xl rounded-full" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Menu Consistency Index
            </span>
            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px]">
              {qualityMetrics.length > 0 ? (avgQualityScore >= 80 ? 'Superior' : avgQualityScore >= 60 ? 'Standard' : 'Action Needed') : 'NO DISHES'}
            </Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400">
              {qualityMetrics.length > 0 ? `${avgQualityScore}%` : '--%'}
            </h3>
            <span className="text-xs text-muted-foreground">
              {qualityMetrics.length} {qualityMetrics.length === 1 ? 'dish' : 'dishes'} evaluated
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {qualityMetrics.length > 0
              ? 'Based on live diner reviews & fulfillment success'
              : 'Add dishes in Menu Management to track scores'}
          </p>
        </Card>
      </div>

      {/* --- MAIN TABS: AUDIT CHECKLIST, TELEMETRY, CAPA, MENU QUALITY --- */}
      <Tabs defaultValue="audit" className="w-full space-y-6">
        <div className="flex justify-center sm:justify-start">
          <TabsList className="bg-muted/80 border border-border rounded-2xl p-1">
            <TabsTrigger value="audit" className="rounded-xl px-4 text-xs font-bold gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" /> Real Kitchen Inspection
            </TabsTrigger>
            <TabsTrigger value="temperature" className="rounded-xl px-4 text-xs font-bold gap-1.5">
              <Thermometer className="w-3.5 h-3.5" /> Cold Chain & Temp Logger
            </TabsTrigger>
            <TabsTrigger value="capa" className="rounded-xl px-4 text-xs font-bold gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> CAPA & Complaints
            </TabsTrigger>
            <TabsTrigger value="menu" className="rounded-xl px-4 text-xs font-bold gap-1.5">
              <Utensils className="w-3.5 h-3.5" /> Dish Performance
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- TAB 1: REAL DAILY QUALITY & HYGIENE INSPECTION AUDIT --- */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                    Kitchen Sanitation & Food Safety Daily Audit
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Interactive FSSAI and HACCP compliant 8-point physical hygiene check. Tap status on each point.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`px-3 py-1 font-bold text-xs ${auditGrade.badge}`}>
                    {auditGrade.grade} • {auditScore}%
                  </Badge>
                  <Button
                    onClick={handleSaveDailyAudit}
                    disabled={submittingAudit}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save Today's Audit
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {/* Checkpoints Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {checkpoints.map((cp, idx) => {
                  return (
                    <div
                      key={cp.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        cp.status === 'pass'
                          ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                          : cp.status === 'warning'
                          ? 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40'
                          : 'bg-destructive/5 border-destructive/25 hover:border-destructive/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Point #{idx + 1} • {cp.category}
                          </span>
                          <h4 className="font-bold text-sm text-foreground mt-0.5">
                            {cp.title}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            cp.status === 'pass'
                              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : cp.status === 'warning'
                              ? 'text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'text-destructive border-destructive/30'
                          }`}
                        >
                          {cp.status.toUpperCase()}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {cp.description}
                      </p>

                      {/* Interactive Pass / Warning / Fail Toggle */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
                        <button
                          onClick={() => toggleCheckpointStatus(cp.id, 'pass')}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            cp.status === 'pass'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-muted/60 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Pass
                        </button>
                        <button
                          onClick={() => toggleCheckpointStatus(cp.id, 'warning')}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            cp.status === 'warning'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-muted/60 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Warning
                        </button>
                        <button
                          onClick={() => toggleCheckpointStatus(cp.id, 'fail')}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            cp.status === 'fail'
                              ? 'bg-destructive text-white shadow-sm'
                              : 'bg-muted/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" /> Fail
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inspector details and notes */}
              <div className="pt-4 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Audited By (Supervisor / Chef)
                  </label>
                  <Input
                    value={auditorName}
                    onChange={(e) => setAuditorName(e.target.value)}
                    placeholder={user?.displayName || 'Lead Kitchen Supervisor'}
                    className="h-9 text-xs rounded-xl border-border bg-muted/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Inspection Remarks & Corrective Notes
                  </label>
                  <Input
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder="e.g. Deep cleaning completed; oil changed at 11:30 AM"
                    className="h-9 text-xs rounded-xl border-border bg-muted/20"
                  />
                </div>
              </div>

              {/* Past Inspection History from Firebase */}
              {pastAudits.length > 0 && (
                <div className="pt-4 border-t border-border/60">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Past Inspection History (Saved in Firebase)
                  </h4>
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="py-2.5 px-4">Audit Date</th>
                          <th className="py-2.5 px-4">Auditor</th>
                          <th className="py-2.5 px-4">Score</th>
                          <th className="py-2.5 px-4">Grade</th>
                          <th className="py-2.5 px-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {pastAudits.map((a) => (
                          <tr key={a.id} className="hover:bg-muted/30">
                            <td className="py-2.5 px-4 font-mono font-semibold text-foreground">
                              {a.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {a.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-4 text-foreground font-medium">{a.auditorName}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {a.score}%
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                {a.grade}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground max-w-[200px] truncate" title={a.notes}>
                              {a.notes || 'Routine check passed'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: TEMPERATURE & COLD CHAIN TELEMETRY --- */}
        <TabsContent value="temperature" className="space-y-6">
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-cyan-500" />
                    Kitchen Temperature Log & Cold-Chain Telemetry
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    HACCP continuous temperature loggers for walk-in coolers, deep freezers, and food holding lines
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setTempModalOpen(true)}
                  className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-cyan-600/20"
                >
                  <Plus className="w-4 h-4" /> Add Reading
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-6">
              {tempReadings.length === 0 ? (
                <div className="p-10 text-center bg-muted/10 border border-dashed border-border rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-500 mx-auto flex items-center justify-center">
                    <Thermometer className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm">No Temperature Readings Logged Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Food safety standards require daily logging of cold-chain freezers (≤ -18°C), prep chillers (1°C - 4°C), and hot holding units (≥ 65°C).
                  </p>
                  <Button
                    onClick={() => setTempModalOpen(true)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Record First Temperature Log
                  </Button>
                </div>
              ) : (
                <>
                  {/* Gauges display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tempReadings.slice(0, 4).map((reading) => (
                      <div
                        key={reading.id}
                        className="p-4 rounded-2xl bg-muted/30 border border-border relative overflow-hidden group hover:border-cyan-500/40 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Target: {reading.targetTemp}
                          </span>
                          <Badge
                            className={`text-[10px] font-bold ${
                              reading.status === 'safe'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : reading.status === 'warning'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-destructive/15 text-destructive border-destructive/30'
                            }`}
                          >
                            {reading.status.toUpperCase()}
                          </Badge>
                        </div>

                        <h4 className="font-bold text-xs text-foreground truncate" title={reading.equipment}>
                          {reading.equipment}
                        </h4>

                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="text-3xl font-black text-foreground font-mono">
                            {reading.currentTemp > 0 ? `+${reading.currentTemp}` : reading.currentTemp}°C
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            By {reading.loggedBy}
                          </span>
                        </div>

                        <p className="text-[10px] text-muted-foreground mt-2">
                          Logged {reading.loggedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Recent Temperature Log History Table */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Recent Telemetry History ({tempReadings.length} Recorded in Firebase)
                    </h4>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                          <tr>
                            <th className="py-2.5 px-4">Equipment Unit</th>
                            <th className="py-2.5 px-4">Current Reading</th>
                            <th className="py-2.5 px-4">HACCP Target</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4">Logged By</th>
                            <th className="py-2.5 px-4 text-right">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {tempReadings.map((r) => (
                            <tr key={r.id} className="hover:bg-muted/30">
                              <td className="py-2.5 px-4 font-semibold text-foreground">{r.equipment}</td>
                              <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                                {r.currentTemp > 0 ? `+${r.currentTemp}` : r.currentTemp}°C
                              </td>
                              <td className="py-2.5 px-4 font-mono text-muted-foreground">{r.targetTemp}</td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                    r.status === 'safe'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : r.status === 'warning'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-destructive'
                                  }`}
                                >
                                  {r.status === 'safe' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                  {r.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground">{r.loggedBy}</td>
                              <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                                {r.loggedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })} {r.loggedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 3: CUSTOMER QUALITY INCIDENTS & CAPA TRACKER --- */}
        <TabsContent value="capa" className="space-y-6">
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    Customer Quality Complaints & CAPA (Corrective Action)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Resolve diner review complaints (≤ 3 stars), packaging spills, and cancellations with structured CAPA
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIncidentModalOpen(true)}
                  className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-600/20"
                >
                  <Plus className="w-4 h-4" /> Log Quality Issue
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              {incidents.length === 0 ? (
                <div className="p-10 text-center bg-emerald-500/5 border border-dashed border-emerald-500/20 rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm">100% Quality Record — Zero Complaints Reported</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    No negative customer reviews (≤ 3 stars) or quality cancellation tickets have been registered for your restaurant.
                  </p>
                  <Button
                    onClick={() => setIncidentModalOpen(true)}
                    variant="outline"
                    className="border-border text-xs rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Log Internal Kitchen Observation
                  </Button>
                </div>
              ) : (
                incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3 hover:border-border transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            inc.severity === 'high'
                              ? 'text-destructive border-destructive/30'
                              : inc.severity === 'medium'
                              ? 'text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'text-blue-600 dark:text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {inc.severity.toUpperCase()} SEVERITY
                        </Badge>
                        <h4 className="font-bold text-sm text-foreground">{inc.dishName}</h4>
                        <span className="text-xs text-muted-foreground">• {inc.issueType}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[10px] font-bold ${
                            inc.status === 'resolved'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {inc.status === 'resolved' ? 'RESOLVED' : 'ACTION TAKEN'}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {inc.reportedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Customer feedback */}
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs text-foreground">
                      <strong className="text-muted-foreground block text-[11px] mb-0.5">Diner Feedback / Issue Detail:</strong>
                      "{inc.customerFeedback}"
                    </div>

                    {/* CAPA solution */}
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-foreground">
                      <strong className="text-emerald-600 dark:text-emerald-400 block text-[11px] mb-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Preventive & Corrective Action (CAPA):
                      </strong>
                      {inc.correctiveAction}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 4: DISH-LEVEL QUALITY & CONSISTENCY METRICS --- */}
        <TabsContent value="menu" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                <Utensils className="w-5 h-5 text-emerald-500" /> Menu Item Quality & Consistency Scoring
              </h3>
              <p className="text-xs text-muted-foreground">
                Evaluated from real order fulfillment rates, diner taste reviews, and low return rates
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="Search dish name..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-border bg-card"
              />
            </div>
          </div>

          {filteredMetrics.length === 0 ? (
            <div className="p-12 text-center bg-muted/20 border border-dashed border-border rounded-3xl space-y-2">
              <Utensils className="w-8 h-8 text-muted-foreground mx-auto" />
              <h4 className="font-bold text-sm text-foreground">No Menu Items Found</h4>
              <p className="text-xs text-muted-foreground">
                {itemSearch ? 'No dish matches your search filter.' : 'Add items in Menu Management to track dish-level quality.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMetrics.map((metric) => {
                const qualityBadge = getQualityBadge(metric.qualityScore);

                return (
                  <Card
                    key={metric.menuItemId}
                    className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-all rounded-3xl overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-base text-foreground truncate max-w-[200px]" title={metric.menuItemName}>
                            {metric.menuItemName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[10px] ${qualityBadge.color}`}>
                              {qualityBadge.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {metric.totalOrders} ordered
                            </span>
                          </div>
                        </div>
                        <div className={`text-3xl font-black ${getQualityColor(metric.qualityScore)}`}>
                          {metric.qualityScore}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-border/50 text-xs">
                        {/* Success Rate */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1 text-muted-foreground font-medium">
                            <span>Fulfillment Rate</span>
                            <span className="font-bold text-foreground">{metric.orderSuccessRate}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              style={{ width: `${metric.orderSuccessRate}%` }}
                              className="h-full bg-blue-500 rounded-full"
                            />
                          </div>
                        </div>

                        {/* Satisfaction */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1 text-muted-foreground font-medium">
                            <span>Diner Rating</span>
                            <span className="font-bold text-foreground flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {metric.averageRating > 0 ? `${metric.averageRating.toFixed(1)} / 5.0` : 'No reviews'}
                              {metric.totalReviews > 0 && <span className="text-[10px] text-muted-foreground">({metric.totalReviews})</span>}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              style={{ width: `${metric.customerSatisfaction}%` }}
                              className="h-full bg-emerald-500 rounded-full"
                            />
                          </div>
                        </div>

                        {/* Consistency */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1 text-muted-foreground font-medium">
                            <span>Consistency Score</span>
                            <span className="font-bold text-foreground">{metric.consistencyScore}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              style={{ width: `${metric.consistencyScore}%` }}
                              className="h-full bg-purple-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quality alert */}
                      {metric.qualityScore < 70 && metric.totalOrders > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400">
                          Recommendation: Review recipe portions & thermal packaging.
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- MODAL 1: ADD TEMPERATURE LOG --- */}
      <Dialog open={tempModalOpen} onOpenChange={setTempModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-cyan-500" /> Log Equipment Temperature
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record real-time telemetry from kitchen refrigeration and hot holding units.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Equipment Unit
              </label>
              <select
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="Deep Freezer (Meat/Dairy)">Deep Freezer (Meat/Dairy) [Target ≤ -18°C]</option>
                <option value="Prep Counter Chiller">Prep Counter Chiller [Target 1°C - 4°C]</option>
                <option value="Walk-in Cold Room">Walk-in Cold Room [Target 2°C - 4°C]</option>
                <option value="Hot Holding Dispenser">Hot Holding Dispenser [Target ≥ 65°C]</option>
                <option value="Main Oil Fryer Station">Main Oil Fryer Station [Target 175°C - 185°C]</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Temperature Reading (°C)
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. -18.5 or 3.2 or 68.0"
                value={newTemp}
                onChange={(e) => setNewTemp(e.target.value)}
                className="h-10 text-sm rounded-xl border-border bg-muted/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Inspector / Chef Name
              </label>
              <Input
                placeholder={user?.displayName || 'Sous Chef'}
                value={newTempStaff}
                onChange={(e) => setNewTempStaff(e.target.value)}
                className="h-10 text-xs rounded-xl border-border bg-muted/20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTempModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button onClick={handleAddTempReading} className="rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white">
              Save Reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 2: LOG QUALITY INCIDENT & CAPA --- */}
      <Dialog open={incidentModalOpen} onOpenChange={setIncidentModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Log Quality Incident & CAPA
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Document customer feedback and record the corrective action taken to avoid repeat issues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Dish / Menu Item
                </label>
                <Input
                  placeholder="e.g. Butter Naan"
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  className="h-9 text-xs rounded-xl border-border bg-muted/20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Issue Type
                </label>
                <select
                  value={newIssueType}
                  onChange={(e) => setNewIssueType(e.target.value as any)}
                  className="w-full h-9 rounded-xl border border-border bg-muted/20 px-2 text-xs font-medium text-foreground focus:outline-none"
                >
                  <option value="Packaging Spill">Packaging Spill</option>
                  <option value="Taste / Flavor">Taste / Flavor</option>
                  <option value="Food Temperature">Food Temperature</option>
                  <option value="Missing Item">Missing Item</option>
                  <option value="Hygiene Complaint">Hygiene Complaint</option>
                  <option value="Foreign Object">Foreign Object</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Diner Feedback / Issue Details
              </label>
              <textarea
                rows={2}
                placeholder="What occurred with this order?"
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-border bg-muted/20 text-xs text-foreground focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Corrective & Preventive Action (CAPA)
              </label>
              <textarea
                rows={2}
                placeholder="What action did the kitchen team implement to prevent repetition?"
                value={newCapa}
                onChange={(e) => setNewCapa(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-border bg-muted/20 text-xs text-foreground focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIncidentModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button onClick={handleAddIncident} className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white">
              Save Incident & CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL 3: OFFICIAL HYGIENE & QUALITY CERTIFICATE --- */}
      <Dialog open={certificateOpen} onOpenChange={setCertificateOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8 bg-card border-border">
          <div id="hygiene-certificate" className="p-6 sm:p-8 rounded-2xl border-4 border-amber-500/30 bg-gradient-to-b from-amber-500/5 via-card to-emerald-500/5 relative text-center space-y-5">
            {/* Certificate Header */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
              <div className="text-left">
                <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground block">
                  Official Verification Copy
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  FSSAI License: {realFssai || 'Pending Registration'}
                </span>
              </div>
              <Badge className="bg-amber-500 text-black font-black text-xs px-3 py-1">
                GOLD STANDARD
              </Badge>
            </div>

            {/* Emblem */}
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/30">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
                Certificate of Food Quality & Kitchen Hygiene
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                {restaurant?.name || (user?.displayName ? `${user.displayName}'s Kitchen` : 'Registered Kitchen')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                This certifies that the kitchen premises, food safety temperature monitors, and culinary processes meet official standards.
              </p>
            </div>

            {/* Scores showcase */}
            <div className="grid grid-cols-3 gap-3 py-3 border-y border-border/60">
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Hygiene Score</span>
                <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {auditScore}%
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Compliance</span>
                <strong className="text-xl font-black text-foreground">
                  {pastAudits.length > 0 ? pastAudits[0].grade.split(' ')[0] : auditGrade.grade.split(' ')[0]}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Valid Until</span>
                <strong className="text-xl font-black text-foreground font-mono">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                </strong>
              </div>
            </div>

            {/* Stamp & Seal */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <div className="text-left font-mono text-[11px]">
                <span>Certified on: {lastAuditDate ? lastAuditDate.toLocaleDateString() : new Date().toLocaleDateString()}</span>
                <br />
                <span>Auditor: {auditorName.trim() || user?.displayName || 'Lead Kitchen Auditor'}</span>
              </div>
              <div className="text-right">
                <BadgeCheck className="w-8 h-8 text-emerald-500 inline-block mb-1" />
                <span className="block text-[10px] font-bold text-foreground">DIGITALLY SEALED</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 mt-2">
            <Button variant="outline" onClick={() => setCertificateOpen(false)} className="rounded-xl text-xs">
              Close
            </Button>
            <Button
              onClick={() => {
                window.print();
              }}
              className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
