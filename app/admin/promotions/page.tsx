'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CreatePromotionDialog } from '@/components/promotions/CreatePromotionDialog';
import { getAllPromotions, updatePromotion } from '@/lib/promotions';
import { useToast } from '@/hooks/use-toast';
import type { Promotion } from '@/lib/types';
import { format } from 'date-fns';

export default function PromotionsPage() {
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const fetchPromotions = async () => {
        setLoading(true);
        const data = await getAllPromotions();
        setPromotions(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const handleToggleActive = async (promotion: Promotion) => {
        try {
            await updatePromotion(promotion.id, { isActive: !promotion.isActive });
            toast({
                title: 'Success',
                description: `Promotion ${promotion.isActive ? 'deactivated' : 'activated'}`,
            });
            fetchPromotions();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update promotion',
                variant: 'destructive',
            });
        }
    };

    const handleCopyCode = async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    const getDiscountText = (promo: Promotion) => {
        switch (promo.type) {
            case 'percentage':
                return `${promo.value}% OFF`;
            case 'fixed':
                return `₹${promo.value} OFF`;
            case 'free_delivery':
                return 'FREE DELIVERY';
        }
    };

    const getStatusBadge = (promo: Promotion) => {
        const now = new Date();
        const isExpired = now > promo.validUntil;
        const isUpcoming = now < promo.validFrom;

        if (isExpired) {
            return <Badge variant="destructive">Expired</Badge>;
        }
        if (isUpcoming) {
            return <Badge variant="secondary">Upcoming</Badge>;
        }
        if (!promo.isActive) {
            return <Badge variant="outline">Inactive</Badge>;
        }
        return <Badge className="bg-green-500">Active</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Promotions</h1>
                    <p className="text-muted-foreground">Manage promotional codes and discounts</p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Promotion
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Promotions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{promotions.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {promotions.filter((p) => p.isActive && new Date() >= p.validFrom && new Date() <= p.validUntil).length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {promotions.reduce((sum, p) => sum + p.usageCount, 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Expired
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {promotions.filter((p) => new Date() > p.validUntil).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Promotions Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Valid Period</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        Loading promotions...
                                    </TableCell>
                                </TableRow>
                            ) : promotions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No promotions yet. Create your first promotion to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                promotions.map((promo) => (
                                    <TableRow key={promo.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <code className="font-semibold">{promo.code}</code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => handleCopyCode(promo.code)}
                                                >
                                                    {copied === promo.code ? (
                                                        <Check className="w-3 h-3 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{getDiscountText(promo)}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {promo.description}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div>{format(promo.validFrom, 'MMM dd, yyyy')}</div>
                                                <div className="text-muted-foreground">to {format(promo.validUntil, 'MMM dd, yyyy')}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {promo.usageCount}
                                                {promo.usageLimit && ` / ${promo.usageLimit}`}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(promo)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleToggleActive(promo)}
                                                    title={promo.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {promo.isActive ? (
                                                        <ToggleRight className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Promotion Dialog */}
            <CreatePromotionDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                adminId="admin-temp-id" // Replace with actual admin ID from auth context
                onSuccess={fetchPromotions}
            />
        </div>
    );
}
