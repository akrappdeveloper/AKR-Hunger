'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Clock, Heart, Eye, ChefHat, Salad, TrendingUp, Lightbulb, Store } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '📰' },
  { id: 'recipe', name: 'Recipes', icon: '👨🍳' },
  { id: 'nutrition', name: 'Nutrition', icon: '🥗' },
  { id: 'tips', name: 'Tips', icon: '💡' },
  { id: 'restaurant_spotlight', name: 'Spotlights', icon: '🏪' },
  { id: 'food_trends', name: 'Trends', icon: '📈' },
];

const SAMPLE_ARTICLES = [
  {
    id: '1', title: '10 Best Street Foods You Must Try in India',
    excerpt: 'From Mumbai vada pav to Delhi chaat, explore the vibrant street food culture of India.',
    coverImage: '', category: 'food_trends', readTime: 5, views: 1234, likes: 89,
    author: 'Hunger Team', publishedAt: new Date(),
  },
  {
    id: '2', title: 'High-Protein Meal Prep Guide for Busy Professionals',
    excerpt: 'Simple and delicious meal prep ideas that keep you fueled throughout the week.',
    coverImage: '', category: 'nutrition', readTime: 7, views: 892, likes: 56,
    author: 'Hunger Team', publishedAt: new Date(),
  },
  {
    id: '3', title: 'How to Make Perfect Butter Chicken at Home',
    excerpt: 'Step-by-step guide to creating restaurant-quality butter chicken in your kitchen.',
    coverImage: '', category: 'recipe', readTime: 10, views: 2341, likes: 178,
    author: 'Hunger Team', publishedAt: new Date(),
  },
  {
    id: '4', title: '5 Tips for Ordering Healthy on Food Delivery Apps',
    excerpt: 'Make smarter choices when ordering food online without compromising on taste.',
    coverImage: '', category: 'tips', readTime: 4, views: 567, likes: 34,
    author: 'Hunger Team', publishedAt: new Date(),
  },
  {
    id: '5', title: 'Spotlight: The Journey of a Local Biryani Legend',
    excerpt: 'How a small home kitchen turned into one of the most loved biryani spots in the city.',
    coverImage: '', category: 'restaurant_spotlight', readTime: 6, views: 1543, likes: 123,
    author: 'Hunger Team', publishedAt: new Date(),
  },
];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [articles, setArticles] = useState(SAMPLE_ARTICLES);

  const filteredArticles = selectedCategory === 'all'
    ? articles
    : articles.filter(a => a.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/customer">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-black flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Food Blog
            </h1>
            <p className="text-xs text-muted-foreground">Articles, recipes & food tips</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Featured Article */}
        {filteredArticles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="overflow-hidden cursor-pointer hover:shadow-xl transition-shadow">
              <div className="h-48 sm:h-56 bg-gradient-to-br from-primary/80 via-orange-500 to-amber-500 flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-white/50" />
              </div>
              <div className="p-5">
                <Badge className="mb-2 text-xs">{filteredArticles[0].category.replace('_', ' ')}</Badge>
                <h2 className="text-xl font-black text-foreground mb-2">{filteredArticles[0].title}</h2>
                <p className="text-sm text-muted-foreground line-clamp-2">{filteredArticles[0].excerpt}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {filteredArticles[0].readTime} min read</span>
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {filteredArticles[0].views}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {filteredArticles[0].likes}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredArticles.slice(1).map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="h-32 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <div className="p-4">
                  <Badge variant="outline" className="mb-2 text-[10px]">{article.category.replace('_', ' ')}</Badge>
                  <h3 className="font-bold text-sm line-clamp-2 mb-1">{article.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readTime} min</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.views}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
