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
import java.util.ArrayList;
import java.util.List;

/**
 * ViewPager2 adapter for the product media carousel on the Product Detail screen.
 * Displays images and showcase video slides, matching the web ProductClient.tsx gallery.
 */
public class ProductImageAdapter extends RecyclerView.Adapter<ProductImageAdapter.ImageViewHolder> {

    public static class MediaSlide {
        public final boolean isVideo;
        public final String url;
        public final String posterUrl;

        public MediaSlide(boolean isVideo, String url, String posterUrl) {
            this.isVideo = isVideo;
            this.url = url;
            this.posterUrl = posterUrl;
        }
    }

    private final Context context;
    private final List<MediaSlide> slides = new ArrayList<>();
    private OnImageClickListener listener;
    private OnSlideClickListener slideListener;

    public interface OnImageClickListener {
        void onImageClick(int position, String url);
    }

    public interface OnSlideClickListener {
        void onSlideClick(int position, MediaSlide slide);
    }

    public ProductImageAdapter(Context context, List<String> imageUrls) {
        this.context = context;
        if (imageUrls != null) {
            for (String u : imageUrls) {
                if (u != null && !u.trim().isEmpty()) {
                    this.slides.add(new MediaSlide(false, u, u));
                }
            }
        }
    }

    public static ProductImageAdapter fromMediaSlides(Context context, List<MediaSlide> mediaSlides) {
        ProductImageAdapter adapter = new ProductImageAdapter(context, null);
        if (mediaSlides != null) {
            adapter.slides.addAll(mediaSlides);
        }
        return adapter;
    }

    public void setOnImageClickListener(OnImageClickListener listener) {
        this.listener = listener;
    }

    public void setOnSlideClickListener(OnSlideClickListener slideListener) {
        this.slideListener = slideListener;
    }

    public MediaSlide getSlide(int position) {
        if (position < 0 || position >= slides.size()) return null;
        return slides.get(position);
    }

    @NonNull
    @Override
    public ImageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_product_image, parent, false);
        return new ImageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ImageViewHolder holder, int position) {
        MediaSlide slide = slides.get(position);

        RequestOptions options = new RequestOptions()
                .placeholder(R.drawable.bg_card_rounded)
                .error(R.drawable.bg_card_rounded)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .centerCrop();

        if (slide.isVideo) {
            if (holder.llVideoBadge != null) {
                holder.llVideoBadge.setVisibility(View.VISIBLE);
            }
            String thumbSource = (slide.posterUrl != null && !slide.posterUrl.isEmpty())
                    ? slide.posterUrl
                    : slide.url;
            Glide.with(context)
                    .load(slide.url)
                    .thumbnail(Glide.with(context).load(thumbSource))
                    .apply(options)
                    .into(holder.ivSlide);
        } else {
            if (holder.llVideoBadge != null) {
                holder.llVideoBadge.setVisibility(View.GONE);
            }
            Glide.with(context)
                    .load(slide.url)
                    .apply(options)
                    .into(holder.ivSlide);
        }

        holder.itemView.setOnClickListener(v -> {
            if (slideListener != null) {
                slideListener.onSlideClick(position, slide);
            } else if (listener != null) {
                listener.onImageClick(position, slide.url);
            }
        });
    }

    @Override
    public int getItemCount() {
        return slides.size();
    }

    static class ImageViewHolder extends RecyclerView.ViewHolder {
        final ImageView ivSlide;
        final View llVideoBadge;

        ImageViewHolder(@NonNull View itemView) {
            super(itemView);
            ivSlide = itemView.findViewById(R.id.iv_slide_image);
            llVideoBadge = itemView.findViewById(R.id.ll_video_badge);
        }
    }
}
