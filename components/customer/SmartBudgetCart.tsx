'use client';

/**
 * Hunger Smart Budget Cart ("Build My Meal")
 * ============================================
 * User enters a budget, system finds the best combination
 * of items that fits. Shows what's included, remaining budget,
 * and optional extra item suggestions.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Plus, Trash2, RefreshCw, ShoppingBag, TrendingUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MenuItem } from '@/lib/types';
import SafeImage from '@/components/ui/safe-image';

interface BudgetCartItem {
  item: MenuItem & { restaurantName: string };
  quantity: number;
}

interface BudgetCartResult {
  items: BudgetCartItem[];
  foodTotal: number;
  deliveryFee: number;
  total: number;
  remaining: number;
  extraItemSuggestion?: MenuItem & { restaurantName: string };
}

interface SmartBudgetCartProps {
  availableItems: (MenuItem & { restaurantName: string })[];
  deliveryFee: number;
  onAddToCart: (items: BudgetCartItem[]) => void;
  className?: string;
}

/** Rule-based budget optimizer — no AI needed */
function optimizeMealForBudget(
  budget: number,
  items: (MenuItem & { restaurantName: string })[],
  deliveryFee: number
): BudgetCartResult {
  const foodBudget = Math.max(0, budget - deliveryFee);
  const available = items
    .filter(i => i.isLive && i.available && i.price <= foodBudget)
    .sort((a, b) => b.price - a.price); // Sort by price descending for greedy approach

  const selectedItems: BudgetCartItem[] = [];
  let remaining = foodBudget;

  // Greedy selection: pick highest-value items that fit
  for (const item of available) {
    if (item.price <= remaining) {
      const existingIdx = selectedItems.findIndex(s => s.item.id === item.id);
      if (existingIdx >= 0) {
        // Add another of the same item if there's room
        const newQty = selectedItems[existingIdx].quantity + 1;
        if (item.price * newQty <= remaining + item.price) {
          selectedItems[existingIdx].quantity = newQty;
          remaining -= item.price;
        }
      } else {
        selectedItems.push({ item, quantity: 1 });
        remaining -= item.price;
      }
    }
    if (remaining < 30) break; // Stop if less than ₹30 left
  }

  const foodTotal = selectedItems.reduce(
    (s, si) => s + si.item.price * si.quantity, 0
  );
  const total = foodTotal + deliveryFee;
  const finalRemaining = budget - total;

  // Find an extra item suggestion within remaining budget
  let extraItemSuggestion: (MenuItem & { restaurantName: string }) | undefined;
  if (finalRemaining >= 20) {
    extraItemSuggestion = items.find(i =>
      i.isLive &&
      i.available &&
      i.price <= finalRemaining &&
      !selectedItems.find(s => s.item.id === i.id)
    );
  }

  return {
    items: selectedItems,
    foodTotal,
    deliveryFee,
    total,
    remaining: finalRemaining,
    extraItemSuggestion,
  };
}

export default function SmartBudgetCart({
  availableItems,
  deliveryFee,
  onAddToCart,
  className,
}: SmartBudgetCartProps) {
  const [budget, setBudget] = useState('');
  const [result, setResult] = useState<BudgetCartResult | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const buildMeal = useCallback(() => {
    const budgetNum = parseInt(budget);
    if (!budgetNum || budgetNum < 50) return;

    setIsBuilding(true);
    // Simulate brief processing
    setTimeout(() => {
      const optimized = optimizeMealForBudget(budgetNum, availableItems, deliveryFee);
      setResult(optimized);
      setIsBuilding(false);
    }, 600);
  }, [budget, availableItems, deliveryFee]);

  const addExtraItem = useCallback(() => {
    if (!result?.extraItemSuggestion || !result) return;
    const extra: BudgetCartItem = { item: result.extraItemSuggestion, quantity: 1 };
    setResult(prev => {
      if (!prev) return prev;
      const newItems = [...prev.items, extra];
      const newFoodTotal = newItems.reduce((s, si) => s + si.item.price * si.quantity, 0);
      const newTotal = newFoodTotal + prev.deliveryFee;
      return {
        ...prev,
        items: newItems,
        foodTotal: newFoodTotal,
        total: newTotal,
        remaining: parseInt(budget) - newTotal,
        extraItemSuggestion: undefined,
      };
    });
  }, [result, budget]);

  return (
    <div className={`${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-base">Build My Meal</h2>
          <p className="text-xs text-muted-foreground">AI picks the best combo for your budget</p>
        </div>
      </div>

      {/* Budget Input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
          <Input
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buildMeal()}
            placeholder="Enter your budget (e.g. 299)"
            className="pl-8 h-12 text-base font-medium"
            min={50}
            max={9999}
          />
        </div>
        <Button
          onClick={buildMeal}
          disabled={isBuilding || !budget || parseInt(budget) < 50}
          className="h-12 px-5 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
        >
          {isBuilding ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Build
            </>
          )}
        </Button>
      </div>

      {/* Quick budget chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[99, 149, 199, 299, 399].map(b => (
          <button
            key={b}
            onClick={() => { setBudget(String(b)); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              budget === String(b)
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                : 'border-border text-muted-foreground hover:border-violet-500/30'
            }`}
          >
            ₹{b}
          </button>
        ))}
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && !isBuilding && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-3"
          >
            {/* Items list */}
            {result.items.length > 0 ? (
              <>
                <div className="space-y-2">
                  {result.items.map((si, i) => (
                    <motion.div
                      key={si.item.id + i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <SafeImage
                          src={si.item.image}
                          alt={si.item.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{si.item.name}</div>
                        <div className="text-xs text-muted-foreground">{si.item.restaurantName}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {si.quantity > 1 && (
                          <Badge className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
                            ×{si.quantity}
                          </Badge>
                        )}
                        <span className="text-sm font-semibold">₹{si.item.price * si.quantity}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Price breakdown */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20">
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Food</span>
                      <span>₹{result.foodTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>₹{result.deliveryFee}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-border pt-1.5">
                      <span>Total</span>
                      <span className="text-violet-400">₹{result.total}</span>
                    </div>
                  </div>

                  {result.remaining > 0 && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      ₹{result.remaining.toFixed(0)} remaining from your budget
                    </div>
                  )}
                </div>

                {/* Extra item suggestion */}
                {result.extraItemSuggestion && result.remaining > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-emerald-400 mb-1">
                          💡 Add for ₹{result.extraItemSuggestion.price} more?
                        </div>
                        <div className="text-sm font-medium">{result.extraItemSuggestion.name}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={addExtraItem}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </motion.div>
                )}

                {result.items.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No items found within ₹{budget}. Try a higher budget.
                  </div>
                )}

                {/* Add to Cart */}
                <Button
                  onClick={() => onAddToCart(result.items)}
                  className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-500/30"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Add All to Cart
                </Button>

                {/* Regenerate */}
                <button
                  onClick={buildMeal}
                  className="w-full text-xs text-muted-foreground hover:text-violet-400 transition-colors flex items-center justify-center gap-1 py-1"
                >
                  <RefreshCw className="w-3 h-3" /> Generate different combination
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No items fit within ₹{budget} (including ₹{result.deliveryFee} delivery).
                </p>
                <p className="text-xs text-muted-foreground mt-1">Try a budget of ₹{Math.ceil(deliveryFee + 80)}+</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
