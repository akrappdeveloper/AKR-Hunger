'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MenuItem, CartItem } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Leaf, Flame } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const handleAddToCart = () => {
    if (quantity === 0) return;

    const cartItem: CartItem = {
      id: `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      name: item.name,
      price: item.price,
      quantity,
      image: item.image,
      specialInstructions: specialInstructions || undefined,
      addedAt: new Date(),
    };

    addItem(cartItem);
    setQuantity(0);
    setSpecialInstructions('');
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex gap-4">
        {/* Item Image */}
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          <Image
            src={item.image || "/placeholder.svg"}
            alt={item.name}
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
            <span className="text-lg font-bold text-primary flex-shrink-0">
              ₹{item.price}
            </span>
          </div>

          {/* Badges */}
          <div className="flex gap-1 mb-2">
            {item.vegetarian && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Leaf className="w-3 h-3 mr-1" />
                Veg
              </Badge>
            )}
            {item.spicy && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Flame className="w-3 h-3 mr-1" />
                Spicy
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {item.description}
          </p>

          {/* Quantity Controls */}
          {quantity === 0 ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => setQuantity(1)}
              disabled={!item.available}
            >
              {item.available ? 'Add to Cart' : 'Out of Stock'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuantity(Math.max(0, quantity - 1))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="font-semibold w-8 text-center">{quantity}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddToCart}
              >
                Add
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
