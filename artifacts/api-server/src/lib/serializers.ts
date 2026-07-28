import type { Product, Order } from "@workspace/db";

export function serializeProduct(p: Product) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    detailNote: p.detailNote ?? "",
    category: p.category,
    price: p.price,
    originalPrice: p.originalPrice ?? null,
    shippingFee: p.shippingFee ?? null,
    currency: p.currency,
    imageUrl: p.imageUrl,
    images: (p.images ?? []) as string[],
    colors: (p.colors ?? []) as string[],
    productType: p.productType ?? "",
    rating: p.rating,
    stock: p.stock,
    sellerName: p.sellerName,
    tags: (p.tags ?? []) as string[],
    freeShipping: p.freeShipping ?? false,
    hidden: p.hidden ?? false,
  };
}

export function serializeOrder(o: Order) {
  return {
    id: o.id,
    status: o.status,
    total: o.total,
    currency: o.currency,
    trackingCode: o.trackingCode,
    shippingAddress: o.shippingAddress,
    receiverName: o.receiverName ?? null,
    receiverEmail: o.receiverEmail ?? null,
    receiverPhone: o.receiverPhone ?? null,
    cashbackCode: o.cashbackCode ?? null,
    cashbackDiscount: o.cashbackDiscount ?? null,
    placedBy: o.placedBy,
    paymentScreenshotUrl: o.paymentScreenshotUrl ?? null,
    paymentNote: o.paymentNote ?? null,
    paymentVerified: o.paymentVerified ?? "pending",
    bonusDiscount: (o as { bonusDiscount?: number | null }).bonusDiscount ?? null,
    createdAt: o.createdAt.toISOString(),
    items: o.items,
  };
}
