package com.ssr.hunger.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.bumptech.glide.request.RequestOptions;
import com.ssr.hunger.R;
import java.util.List;

/**
 * ViewPager2 adapter for the product image carousel on the Product Detail screen.
 * Displays multiple images with Glide loading, matching the web ProductClient.tsx
 * ImageCarousel component behaviour.
 */
public class ProductImageAdapter extends RecyclerView.Adapter<ProductImageAdapter.ImageViewHolder> {

    private final Context context;
    private final List<String> imageUrls;
    private OnImageClickListener listener;

    public interface OnImageClickListener {
        void onImageClick(int position, String url);
    }

    public ProductImageAdapter(Context context, List<String> imageUrls) {
        this.context = context;
        this.imageUrls = imageUrls;
    }

    public void setOnImageClickListener(OnImageClickListener listener) {
        this.listener = listener;
    }

    @NonNull
    @Override
    public ImageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_product_image, parent, false);
        return new ImageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ImageViewHolder holder, int position) {
        String url = imageUrls.get(position);

        RequestOptions options = new RequestOptions()
                .placeholder(R.drawable.bg_card_rounded)
                .error(R.drawable.bg_card_rounded)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .centerCrop();

        Glide.with(context)
                .load(url)
                .apply(options)
                .into(holder.ivSlide);

        if (listener != null) {
            holder.itemView.setOnClickListener(v -> listener.onImageClick(position, url));
        }
    }

    @Override
    public int getItemCount() {
        return imageUrls == null ? 0 : imageUrls.size();
    }

    static class ImageViewHolder extends RecyclerView.ViewHolder {
        final ImageView ivSlide;

        ImageViewHolder(@NonNull View itemView) {
            super(itemView);
            ivSlide = itemView.findViewById(R.id.iv_slide_image);
        }
    }
}
