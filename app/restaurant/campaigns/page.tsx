'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AdCampaign, MenuItem, PointsAccount, PointsTransaction } from '@/lib/types';
import {
    TrendingUp, Plus, Pause, Play, DollarSign, MousePointer,
    Eye, Target, CreditCard, Coins, History, Sparkles,
    BarChart3, ArrowUpRight, ArrowDownRight, Zap, Lightbulb
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Razorpay type definition
declare global {
    interface Window {
        Razorpay: any;
    }
}

// AI Suggestion Type
interface CampaignSuggestion {
    id: string;
    title: string;
    description: string;
    reason: string;
    estimatedReach: string;
    recommendedBudget: number;
    icon: any;
    color: string;
}

export default function AdCampaignsPage() {
    const router = useRouter();
    const { user, restaurant, loading: authLoading } = useRestaurantAuth();

    // Data State
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [pointsAccount, setPointsAccount] = useState<PointsAccount | null>(null);
    const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [campaignDialog, setCampaignDialog] = useState(false);
    const [pointsDialog, setPointsDialog] = useState(false);
    const [transHistoryDialog, setTransHistoryDialog] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<CampaignSuggestion[]>([]);

    // Form State
    const [newCampaign, setNewCampaign] = useState({
        menuItemId: '',
        title: '',
        description: '',
        budget: 'daily' as 'daily' | 'monthly',
        cost: '',
    });
    const [paymentAmount, setPaymentAmount] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/restaurant/login');
            return;
        }
        loadData();
        loadRazorpayScript();
    }, [user, authLoading, router]);

    useEffect(() => {
        if (menuItems.length > 0) {
            generateAiSuggestions();
        }
    }, [menuItems]);

    const loadRazorpayScript = () => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
    };

    const loadData = async () => {
        try {
            setLoading(true);

            // Load campaigns
            const campaignsRef = collection(db, 'adCampaigns');
            const campaignsQuery = query(campaignsRef, where('restaurantId', '==', user!.uid));
            const campaignsSnapshot = await getDocs(campaignsQuery);
            const campaignsList = campaignsSnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                startDate: doc.data().startDate?.toDate() || new Date(),
                endDate: doc.data().endDate?.toDate(),
            })) as AdCampaign[];
            // Sort by active status then date
            campaignsList.sort((a, b) => (b.isActive === a.isActive ? 0 : b.isActive ? 1 : -1));
            setCampaigns(campaignsList);

            // Load menu items
            const menuRef = collection(db, 'menuItems');
            const menuQuery = query(
                menuRef,
                where('restaurantId', '==', user!.uid),
                where('approvalStatus', '==', 'approved')
            );
            const menuSnapshot = await getDocs(menuQuery);
            const menuList = menuSnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
            })) as MenuItem[];
            setMenuItems(menuList);

            // Load points account
            const pointsDoc = await getDoc(doc(db, 'pointsAccounts', user!.uid));
            if (pointsDoc.exists()) {
                setPointsAccount({ ...pointsDoc.data(), id: pointsDoc.id } as PointsAccount);
            } else {
                // Initialize Account
                const newAccount: PointsAccount = {
                    userId: user!.uid,
                    userType: 'restaurant',
                    totalPoints: 0,
                    availablePoints: 0,
                    spentPoints: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                await setDoc(doc(db, 'pointsAccounts', user!.uid), newAccount);
                setPointsAccount(newAccount);
            }

            // Load transactions
            const transRef = collection(db, 'pointsTransactions');
            const transQuery = query(transRef, where('userId', '==', user!.uid));
            const transSnapshot = await getDocs(transQuery);
            const transList = transSnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as PointsTransaction[];
            transList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            setTransactions(transList.slice(0, 20));

        } catch (error) {
            console.error('[Campaigns] Error loading data:', error);
            toast.error("Failed to load campaign data");
        } finally {
            setLoading(false);
        }
    };

    const generateAiSuggestions = () => {
        // Mock AI Logic based on menu items
        if (menuItems.length === 0) return;

        // Suggest promoting the most expensive item
        const expensiveItem = [...menuItems].sort((a, b) => b.price - a.price)[0];
        // Suggest promoting a random item as "Deal of the Day"
        const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];

        const suggestions: CampaignSuggestion[] = [
            {
                id: 'suggest_via_ai_1',
                title: 'Weekend Mega Boost',
                description: `Promote your premium ${expensiveItem.name} to high-value customers.`,
                reason: 'High margin item potential',
                estimatedReach: '2k - 5k Users',
                recommendedBudget: 50,
                icon: Zap,
                color: 'text-amber-400'
            },
            {
                id: 'suggest_via_ai_2',
                title: 'Flash Sale Alert',
                description: `Run a quick 24h campaign for ${randomItem.name} to drive urgent traffic.`,
                reason: 'Creates FOMO (Fear Of Missing Out)',
                estimatedReach: '1k - 3k Users',
                recommendedBudget: 20,
                icon: Sparkles,
                color: 'text-purple-400'
            },
            {
                id: 'suggest_via_ai_3',
                title: 'New Customer Magnet',
                description: 'Target users who haven\'t ordered from you yet.',
                reason: 'Acquire new loyal customers',
                estimatedReach: '5k+ Users',
                recommendedBudget: 100,
                icon: Target,
                color: 'text-blue-400'
            }
        ];
        setAiSuggestions(suggestions);
    };

    const applyAiSuggestion = (suggestion: CampaignSuggestion) => {
        // Find a suitable menu item if not specific
        const defaultItem = menuItems[0]?.id || '';

        setNewCampaign({
            menuItemId: defaultItem,
            title: suggestion.title,
            description: suggestion.description,
            budget: 'daily',
            cost: suggestion.recommendedBudget.toString()
        });
        setCampaignDialog(true);
        toast.success("AI Suggestion applied! Review and launch.");
    };

    const handleCreateCampaign = async () => {
        if (!newCampaign.menuItemId || !newCampaign.title || !newCampaign.cost) {
            toast.error('Please fill all required fields');
            return;
        }

        const cost = parseFloat(newCampaign.cost);
        if (cost < 1) {
            toast.error('Cost must be at least 1 point');
            return;
        }

        if ((pointsAccount?.availablePoints || 0) < cost) {
            toast.error('Insufficient points! Please reacharge.');
            setPointsDialog(true);
            return;
        }

        try {
            setProcessing(true);

            const menuItem = menuItems.find(m => m.id === newCampaign.menuItemId);
            if (!menuItem) return;

            const campaign: Partial<AdCampaign> = {
                restaurantId: user!.uid,
                restaurantName: restaurant?.name || '',
                menuItemId: newCampaign.menuItemId,
                menuItemName: menuItem.name,
                menuItemImage: menuItem.image,
                title: newCampaign.title,
                description: newCampaign.description,
                budget: newCampaign.budget,
                dailyCost: newCampaign.budget === 'daily' ? cost : 0,
                monthlyCost: newCampaign.budget === 'monthly' ? cost : 0,
                status: 'active',
                isActive: true,
                totalClicks: 0,
                totalSpent: 0,
                pointsRemaining: cost,
                impressions: 0,
                clickThroughRate: 0,
                startDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await addDoc(collection(db, 'adCampaigns'), campaign);

            // Deduct points
            await updateDoc(doc(db, 'pointsAccounts', user!.uid), {
                availablePoints: (pointsAccount?.availablePoints || 0) - cost,
                spentPoints: (pointsAccount?.spentPoints || 0) + cost,
                updatedAt: serverTimestamp(),
            });

            // Add transaction
            await addDoc(collection(db, 'pointsTransactions'), {
                userId: user!.uid,
                type: 'spent',
                amount: cost,
                description: `Campaign: ${newCampaign.title}`,
                balanceBefore: pointsAccount?.availablePoints || 0,
                balanceAfter: (pointsAccount?.availablePoints || 0) - cost,
                createdAt: serverTimestamp(),
            });

            setNewCampaign({
                menuItemId: '',
                title: '',
                description: '',
                budget: 'daily',
                cost: '',
            });
            setCampaignDialog(false);
            await loadData();
            toast.success('Campaign launched successfully! 🚀');

        } catch (error) {
            console.error('[Campaigns] Error creating:', error);
            toast.error('Failed to launch campaign');
        } finally {
            setProcessing(false);
        }
    };

    const toggleCampaignStatus = async (campaignId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'adCampaigns', campaignId), {
                isActive: !currentStatus,
                status: !currentStatus ? 'active' : 'paused',
                updatedAt: serverTimestamp(),
            });
            setCampaigns(campaigns.map(c =>
                c.id === campaignId ? { ...c, isActive: !currentStatus, status: !currentStatus ? 'active' : 'paused' } : c
            ));
            toast.success(currentStatus ? 'Campaign paused' : 'Campaign resumed');
        } catch (error) {
            console.error('[Campaigns] Error toggling status:', error);
            toast.error('Failed to update status');
        }
    };

    const handleBuyPoints = async () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount < 100) {
            toast.error('Minimum purchase is ₹100');
            return;
        }

        try {
            setProcessing(true);
            const points = Math.floor(amount / 5); // ₹100 = 20 points

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_dummy',
                amount: amount * 100,
                currency: 'INR',
                name: 'Hunger',
                description: `Purchase ${points} ad points`,
                image: '/logo.png',
                handler: async function (response: any) {
                    try {
                        // Update Account
                        await updateDoc(doc(db, 'pointsAccounts', user!.uid), {
                            totalPoints: (pointsAccount?.totalPoints || 0) + points,
                            availablePoints: (pointsAccount?.availablePoints || 0) + points,
                            updatedAt: serverTimestamp(),
                        });

                        // Record Payment
                        await addDoc(collection(db, 'payments'), {
                            userId: user!.uid,
                            userType: 'restaurant',
                            amount: amount,
                            pointsPurchased: points,
                            status: 'success',
                            paymentMethod: 'razorpay',
                            razorpayPaymentId: response.razorpay_payment_id,
                            createdAt: serverTimestamp(),
                        });

                        // Record Transaction
                        await addDoc(collection(db, 'pointsTransactions'), {
                            userId: user!.uid,
                            type: 'purchase',
                            amount: points,
                            rupeesAmount: amount,
                            description: `Purchased ${points} points for ₹${amount}`,
                            balanceBefore: pointsAccount?.availablePoints || 0,
                            balanceAfter: (pointsAccount?.availablePoints || 0) + points,
                            createdAt: serverTimestamp(),
                        });

                        setPaymentAmount('');
                        setPointsDialog(false);
                        await loadData();
                        toast.success(`Succesfully added ${points} points! 🎉`);

                    } catch (error) {
                        console.error('[Payment] Error post-payment:', error);
                        toast.error('Payment succeeded but points update failed. Contact support.');
                    }
                },
                prefill: {
                    name: restaurant?.name,
                    email: user!.email,
                    contact: restaurant?.phone || '',
                },
                theme: { color: '#F97316' },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error('[Payment] Error:', error);
            toast.error('Payment initialization failed.');
        } finally {
            setProcessing(false);
        }
    };

    const activeCampaigns = campaigns.filter(c => c.isActive);
    const pausedCampaigns = campaigns.filter(c => !c.isActive);

    // Derived Analytics
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.totalClicks || 0), 0);
    const averageCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

    if (authLoading || loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Spinner className="w-12 h-12 text-primary mx-auto" />
                    <p className="text-muted-foreground animate-pulse">Loading Marketing Hub...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto font-sans transition-colors duration-300">

            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 mb-2"
                    >
                        Growth & Campaigns
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-muted-foreground text-base md:text-lg"
                    >
                        Supercharge your restaurant's visibility with AI-driven ads
                    </motion.p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setPointsDialog(true)}
                        className="border border-border hover:bg-muted text-foreground gap-2 transition-all hover:scale-105"
                    >
                        <Coins className="w-4 h-4 text-amber-500" />
                        Buy Points
                    </Button>
                    <Button
                        onClick={() => setCampaignDialog(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2 transition-all hover:scale-105"
                    >
                        <Plus className="w-5 h-5" />
                        Create Campaign
                    </Button>
                </div>
            </header>

            {/* Quick Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Available Points', value: pointsAccount?.availablePoints || 0, icon: Coins, color: 'text-amber-500', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-500/20', sub: 'Budget for ads' },
                    { label: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: Eye, color: 'text-blue-500', gradient: 'from-blue-500/10 to-cyan-500/10', border: 'border-blue-500/20', sub: 'Customer views' },
                    { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: MousePointer, color: 'text-emerald-500', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-500/20', sub: 'Menu visits' },
                    { label: 'Avg. CTR', value: `${averageCtr}%`, icon: BarChart3, color: 'text-purple-500', gradient: 'from-purple-500/10 to-pink-500/10', border: 'border-purple-500/20', sub: 'Click-through rate' },
                ].map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                    >
                        <Card className={`relative overflow-hidden bg-card border-border shadow-sm backdrop-blur-md transition-all hover:border-primary/30`}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl bg-muted ${stat.color} border border-border`}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <Badge variant="outline" className={`bg-muted/40 ${stat.color} border-border`}>Live</Badge>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{stat.value}</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">{stat.sub}</p>
                                </div>
                                <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-current opacity-5 blur-2xl ${stat.color}`} />
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* AI Assistant Section */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">AI Marketing Assistant</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground">Personalized strategies to boost your sales</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {aiSuggestions.map((suggestion, idx) => (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + idx * 0.1 }}
                            className="group relative"
                        >
                            <Card className="relative bg-card border-border hover:border-primary/40 shadow-sm transition-all duration-300 h-full flex flex-col overflow-hidden">
                                <div className={`absolute top-0 w-full h-1 bg-gradient-to-r ${idx === 0 ? 'from-amber-400 to-orange-500' : idx === 1 ? 'from-purple-400 to-pink-500' : 'from-blue-400 to-cyan-500'}`} />
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className={`p-2.5 rounded-xl bg-muted ${suggestion.color} border border-border`}>
                                            <suggestion.icon className="w-5 h-5" />
                                        </div>
                                        <Badge className="bg-primary/10 text-primary border-primary/20">Recommended</Badge>
                                    </div>
                                    <CardTitle className="text-lg text-foreground mt-4">{suggestion.title}</CardTitle>
                                    <CardDescription className="text-muted-foreground leading-relaxed">{suggestion.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col justify-end gap-4">
                                    <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-lg border border-border">
                                        <span className="text-muted-foreground">Est. Reach</span>
                                        <span className="font-semibold text-foreground tracking-wide">{suggestion.estimatedReach}</span>
                                    </div>
                                    <Button
                                        onClick={() => applyAiSuggestion(suggestion)}
                                        className="w-full bg-card hover:bg-muted text-foreground border border-border hover:border-primary/30 transition-all"
                                    >
                                        Use Strategy <ArrowUpRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Campaigns Management */}
            <Card className="bg-card border-border overflow-hidden min-h-[500px] shadow-sm">
                <Tabs defaultValue="active" className="w-full">
                    <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-center gap-6">
                        <h2 className="text-xl font-bold flex items-center gap-3 text-foreground">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Target className="w-5 h-5 text-orange-500" />
                            </div>
                            Campaign Performance
                        </h2>
                        <TabsList className="bg-muted/50 border border-border p-1 rounded-xl h-auto flex-wrap justify-center">
                            <TabsTrigger
                                value="active"
                                className="px-6 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                Active
                            </TabsTrigger>
                            <TabsTrigger
                                value="paused"
                                className="px-6 py-2 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                Paused
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="px-6 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all"
                            >
                                History
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6">
                        <TabsContent value="active" className="space-y-4 m-0">
                            {activeCampaigns.length === 0 ? (
                                <EmptyState
                                    icon={TrendingUp}
                                    title="No Active Campaigns"
                                    desc="Launch a new campaign to start getting more orders."
                                    action={() => setCampaignDialog(true)}
                                />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {activeCampaigns.map(c => (
                                        <CampaignCard
                                            key={c.id}
                                            campaign={c}
                                            onToggle={() => toggleCampaignStatus(c.id!, c.isActive)}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="paused" className="space-y-4 m-0">
                            {pausedCampaigns.length === 0 ? (
                                <EmptyState
                                    icon={Pause}
                                    title="No Paused Campaigns"
                                    desc="All your campaigns are currently running."
                                />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {pausedCampaigns.map(c => (
                                        <CampaignCard
                                            key={c.id}
                                            campaign={c}
                                            onToggle={() => toggleCampaignStatus(c.id!, c.isActive)}
                                            isPaused
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="m-0">
                            <div className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                                <div className="p-4 bg-muted/40 font-semibold text-muted-foreground text-sm grid grid-cols-4 gap-4">
                                    <div>Date</div>
                                    <div>Description</div>
                                    <div className="text-right">Amount</div>
                                    <div className="text-right">Balance</div>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {transactions.map(t => (
                                        <div key={t.id} className="p-4 border-t border-border grid grid-cols-4 gap-4 text-sm hover:bg-muted/30 transition-colors">
                                            <div className="text-muted-foreground">{t.createdAt.toLocaleDateString()}</div>
                                            <div className="text-foreground truncate">{t.description}</div>
                                            <div className={`text-right font-mono font-medium ${t.type === 'purchase' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                                {t.type === 'purchase' ? '+' : '-'}{t.amount}
                                            </div>
                                            <div className="text-right font-mono text-muted-foreground">{t.balanceAfter}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </Card>

            {/* Campaign Creation Dialog */}
            <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
                <DialogContent className="bg-card border-border text-card-foreground max-w-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2 text-foreground">
                            <Zap className="w-5 h-5 text-primary" />
                            Create High-Impact Campaign
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Design your ad to target specific time slots and customers.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-widest">Target Menu Item</Label>
                                <select
                                    value={newCampaign.menuItemId}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, menuItemId: e.target.value })}
                                    className="w-full bg-card border border-input text-foreground rounded-md h-10 px-3 focus:ring-primary focus:border-primary"
                                >
                                    <option value="">Select Item</option>
                                    {menuItems.map(item => (
                                        <option key={item.id} value={item.id}>{item.name} (₹{item.price})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-widest">Campaign Goal</Label>
                                <Input
                                    placeholder="e.g. Boost Weekend Sales"
                                    value={newCampaign.title}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                                    className="bg-card border-input text-foreground"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-widest">Ad Copy / Description</Label>
                            <Textarea
                                placeholder="Why should customers buy this? e.g. 'Freshly baked and 20% off!'"
                                value={newCampaign.description}
                                onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                                className="bg-card border-input text-foreground min-h-[80px]"
                            />
                        </div>

                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
                            <div className="flex items-center gap-2 text-primary font-semibold">
                                <Coins className="w-4 h-4" /> Budget Settings
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground text-xs mb-1.5 block">Budget Type</Label>
                                    <select
                                        value={newCampaign.budget}
                                        onChange={(e) => setNewCampaign({ ...newCampaign, budget: e.target.value as any })}
                                        className="w-full bg-card border border-input text-foreground rounded-md h-9 px-2 text-sm"
                                    >
                                        <option value="daily">Daily Cap</option>
                                        <option value="monthly">Total Budget</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs mb-1.5 block">Points Allocation</Label>
                                    <Input
                                        type="number"
                                        placeholder="Points (e.g. 50)"
                                        value={newCampaign.cost}
                                        onChange={(e) => setNewCampaign({ ...newCampaign, cost: e.target.value })}
                                        className="bg-card border-input text-foreground h-9"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Lightbulb className="w-3 h-3 text-amber-500" />
                                <span>Estimated reach: <strong>{newCampaign.cost ? parseInt(newCampaign.cost) * 40 : 0} views</strong> (approx)</span>
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCampaignDialog(false)} className="hover:bg-muted text-foreground">Cancel</Button>
                        <Button
                            onClick={handleCreateCampaign}
                            disabled={processing}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                        >
                            {processing ? <Spinner className="mr-2" /> : <TrendingUp className="mr-2 w-4 h-4" />}
                            Launch Campaign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={pointsDialog} onOpenChange={setPointsDialog}>
                <DialogContent className="bg-card border-border text-card-foreground shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Add Funds to Wallet</DialogTitle>
                        <DialogDescription className="text-muted-foreground">Secure payment via Razorpay. 1 Point = ₹5</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-3 py-4">
                        {[100, 500, 1000].map(amt => (
                            <button
                                key={amt}
                                onClick={() => setPaymentAmount(amt.toString())}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-1
                                    ${paymentAmount === amt.toString() ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-foreground hover:border-primary/40'}
                                `}
                            >
                                <span className="text-lg font-bold">₹{amt}</span>
                                <span className="text-[10px] uppercase opacity-70">{amt / 5} PTS</span>
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="Custom Amount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="bg-card border-input text-foreground pl-8"
                        />
                        <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={handleBuyPoints}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            disabled={processing || !paymentAmount}
                        >
                            {processing ? <Spinner className="mr-2" /> : <CreditCard className="mr-2 w-4 h-4" />}
                            Proceed to Pay
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// Sub-components
function EmptyState({ icon: Icon, title, desc, action }: { icon: any, title: string, desc: string, action?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-foreground text-lg font-semibold mb-2">{title}</h3>
            <p className="max-w-xs mx-auto mb-6">{desc}</p>
            {action && (
                <Button onClick={action} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                    Get Started
                </Button>
            )}
        </div>
    );
}

function CampaignCard({ campaign, onToggle, isPaused }: { campaign: AdCampaign, onToggle: () => void, isPaused?: boolean }) {
    return (
        <Card className={`bg-card border-border overflow-hidden shadow-sm ${isPaused ? 'opacity-70 grayscale' : ''}`}>
            <div className="flex h-full">
                {/* Image Section */}
                <div className="w-1/3 relative">
                    <img
                        src={campaign.menuItemImage || '/placeholder.png'}
                        alt={campaign.menuItemName}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/0 to-background/80" />
                </div>

                {/* Content Section */}
                <div className="flex-1 p-5">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-foreground leading-tight">{campaign.title}</h3>
                            <p className="text-sm text-muted-foreground">{campaign.menuItemName}</p>
                        </div>
                        <Badge className={`${isPaused ? 'bg-muted text-muted-foreground' : 'bg-emerald-600 text-white'} text-xs`}>
                            {isPaused ? 'PAUSED' : 'LIVE'}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-4">
                        <StatBox label="Clicks" value={campaign.totalClicks || 0} />
                        <StatBox label="Spent" value={campaign.totalSpent || 0} suffix="pts" />
                        <StatBox label="Budget" value={campaign.pointsRemaining} suffix="left" highlighted />
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Started {campaign.startDate instanceof Date ? campaign.startDate.toLocaleDateString() : 'N/A'}</span>
                        <Button size="sm" variant="ghost" onClick={onToggle} className="h-8 hover:bg-muted text-foreground">
                            {isPaused ? <><Play className="w-3 h-3 mr-2" /> Resume</> : <><Pause className="w-3 h-3 mr-2" /> Pause</>}
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function StatBox({ label, value, suffix, highlighted }: any) {
    return (
        <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-mono font-bold ${highlighted ? 'text-primary' : 'text-foreground'}`}>
                {value} <span className="text-[10px] font-normal text-muted-foreground">{suffix}</span>
            </p>
        </div>
    );
}
