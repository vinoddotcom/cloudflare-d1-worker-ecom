import { BaseModel } from './common.model';

/**
 * Blog Category Interface
 */
export interface BlogCategory extends BaseModel {
    id: number;
    name: string;
    slug: string;
    description?: string;
}

/**
 * Blog Category Create Input
 */
export interface BlogCategoryCreateInput {
    name: string;
    slug: string;
    description?: string;
}

/**
 * Blog Category Update Input
 */
export interface BlogCategoryUpdateInput {
    name?: string;
    slug?: string;
    description?: string;
}

/**
 * Blog Post Status
 */
export type BlogPostStatus = 'draft' | 'published' | 'archived';

/**
 * Blog Post Interface
 */
export interface BlogPost extends BaseModel {
    id: number;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featured_image?: string;
    author_id: string;
    status: BlogPostStatus;
    published_at?: number;
    categories?: BlogCategory[];
}

/**
 * Blog Post Create Input
 */
export interface BlogPostCreateInput {
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featured_image?: string;
    author_id: string;
    status?: BlogPostStatus;
    published_at?: number;
    category_ids?: number[];
}

/**
 * Blog Post Update Input
 */
export interface BlogPostUpdateInput {
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    status?: BlogPostStatus;
    published_at?: number;
    category_ids?: number[];
}

/**
 * Blog Post Category Relationship
 */
export interface BlogPostCategory {
    post_id: number;
    category_id: number;
}

/**
 * Blog Post Query Filters
 */
export interface BlogPostQueryFilters {
    category_id?: number;
    author_id?: string;
    status?: BlogPostStatus;
    search?: string;
    sort_by?: 'published_at' | 'created_at' | 'title';
    sort_direction?: 'asc' | 'desc';
}