import { BaseModel } from './common.model';

/**
 * Product Category Interface
 */
export interface ProductCategory extends BaseModel {
    id: number;
    name: string;
    description?: string;
    parent_id?: number;
    image_url?: string;
    is_active: boolean;
}

/**
 * Product Category Create Input
 */
export interface ProductCategoryCreateInput {
    name: string;
    description?: string;
    parent_id?: number;
    image_url?: string;
    is_active?: boolean;
}

/**
 * Product Category Update Input
 */
export interface ProductCategoryUpdateInput {
    name?: string;
    description?: string;
    parent_id?: number;
    image_url?: string;
    is_active?: boolean;
}

/**
 * Product Interface
 */
export interface Product extends BaseModel {
    id: number;
    sku: string;
    name: string;
    description?: string;
    price: number;
    compare_at_price?: number;
    cost_price?: number;
    weight?: number;
    weight_unit?: string;
    featured: boolean;
    is_active: boolean;
    categories?: ProductCategory[];
    images?: ProductImage[];
    variants?: ProductVariant[];
}

/**
 * Product Create Input
 */
export interface ProductCreateInput {
    sku: string;
    name: string;
    description?: string;
    price: number;
    compare_at_price?: number;
    cost_price?: number;
    weight?: number;
    weight_unit?: string;
    featured?: boolean;
    is_active?: boolean;
    category_ids?: number[];
}

/**
 * Product Update Input
 */
export interface ProductUpdateInput {
    sku?: string;
    name?: string;
    description?: string;
    price?: number;
    compare_at_price?: number;
    cost_price?: number;
    weight?: number;
    weight_unit?: string;
    featured?: boolean;
    is_active?: boolean;
    category_ids?: number[];
}

/**
 * Product Image Interface
 */
export interface ProductImage extends BaseModel {
    id: number;
    product_id: number;
    image_url: string;
    alt_text?: string;
    is_primary: boolean;
    sort_order: number;
}

/**
 * Product Image Create Input
 */
export interface ProductImageCreateInput {
    product_id: number;
    image_url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
}

/**
 * Product Variant Interface
 */
export interface ProductVariant extends BaseModel {
    id: number;
    product_id: number;
    sku: string;
    name: string;
    price: number;
    compare_at_price?: number;
    is_active: boolean;
    attributes?: ProductVariantAttribute[];
    inventory?: InventoryItem;
}

/**
 * Product Variant Create Input
 */
export interface ProductVariantCreateInput {
    product_id: number;
    sku: string;
    name: string;
    price: number;
    compare_at_price?: number;
    is_active?: boolean;
    attribute_value_ids?: number[];
    initial_inventory?: number;
}

/**
 * Product Variant Update Input
 */
export interface ProductVariantUpdateInput {
    sku?: string;
    name?: string;
    price?: number;
    compare_at_price?: number;
    is_active?: boolean;
    attribute_value_ids?: number[];
}

/**
 * Product Attribute Interface
 */
export interface ProductAttribute extends BaseModel {
    id: number;
    name: string;
    values?: ProductAttributeValue[];
}

/**
 * Product Attribute Create Input
 */
export interface ProductAttributeCreateInput {
    name: string;
}

/**
 * Product Attribute Value Interface
 */
export interface ProductAttributeValue extends BaseModel {
    id: number;
    attribute_id: number;
    value: string;
}

/**
 * Product Attribute Value Create Input
 */
export interface ProductAttributeValueCreateInput {
    attribute_id: number;
    value: string;
}

/**
 * Product Variant Attribute Interface
 */
export interface ProductVariantAttribute {
    variant_id: number;
    attribute_value_id: number;
    attribute_name?: string;
    attribute_value?: string;
}

/**
 * Inventory Item Interface
 */
export interface InventoryItem extends BaseModel {
    id: number;
    product_variant_id: number;
    quantity: number;
    reserved_quantity: number;
    reorder_level: number;
    reorder_quantity: number;
}

/**
 * Inventory Update Input
 */
export interface InventoryUpdateInput {
    quantity?: number;
    reserved_quantity?: number;
    reorder_level?: number;
    reorder_quantity?: number;
}

/**
 * Product Query Filters
 */
export interface ProductQueryFilters {
    category_id?: number;
    featured?: boolean;
    min_price?: number;
    max_price?: number;
    is_active?: boolean;
    search?: string;
    sort_by?: 'price' | 'name' | 'created_at';
    sort_direction?: 'asc' | 'desc';
}