'use client';

import { useEffect, useState } from 'react';
import { Star, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Review } from '@/lib/types';
import { format } from 'date-fns';

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [ratingFilter, setRatingFilter] = useState<string>('all');

    useEffect(() => {
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const reviewsQuery = query(
                    collection(db, 'reviews'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(reviewsQuery);
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate(),
                    updatedAt: doc.data().updatedAt?.toDate(),
                })) as Review[];
                setReviews(data);
                setFilteredReviews(data);
            } catch (error) {
                console.error('Error fetching reviews:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, []);

    useEffect(() => {
        let filtered = reviews;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(
                (r) =>
                    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    r.comment.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Rating filter
        if (ratingFilter !== 'all') {
            filtered = filtered.filter((r) => r.rating === parseInt(ratingFilter));
        }

        setFilteredReviews(filtered);
    }, [searchTerm, ratingFilter, reviews]);

    const renderStars = (rating: number) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${star <= rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-muted text-muted-foreground/30'
                            }`}
                    />
                ))}
            </div>
        );
    };

    const averageRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : '0.0';

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Reviews</h1>
                <p className="text-muted-foreground">Monitor and manage customer reviews</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Reviews
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reviews.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Average Rating
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">{averageRating}</div>
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            5 Star Reviews
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reviews.filter((r) => r.rating === 5).length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Low Ratings (≤2)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reviews.filter((r) => r.rating <= 2).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search reviews..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={ratingFilter} onValueChange={setRatingFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Ratings</SelectItem>
                                <SelectItem value="5">5 Stars</SelectItem>
                                <SelectItem value="4">4 Stars</SelectItem>
                                <SelectItem value="3">3 Stars</SelectItem>
                                <SelectItem value="2">2 Stars</SelectItem>
                                <SelectItem value="1">1 Star</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Reviews Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Review</TableHead>
                                <TableHead>Helpful</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Loading reviews...
                                    </TableCell>
                                </TableRow>
                            ) : filteredReviews.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No reviews found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredReviews.map((review) => (
                                    <TableRow key={review.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={review.customerAvatar} />
                                                    <AvatarFallback>
                                                        {review.customerName.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{review.customerName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{renderStars(review.rating)}</TableCell>
                                        <TableCell className="max-w-md">
                                            {review.title && (
                                                <div className="font-semibold text-sm mb-1">{review.title}</div>
                                            )}
                                            <p className="text-sm text-muted-foreground truncate">
                                                {review.comment}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{review.helpful}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {format(review.createdAt, 'MMM dd, yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {review.response ? (
                                                <Badge variant="secondary">Responded</Badge>
                                            ) : (
                                                <Badge variant="outline">Pending</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
