import { IRequest } from 'itty-router';
import { AuthRequest } from '../middleware/auth';
import { Env } from '../models/common.model';
import { errorResponse, successResponse } from '../utils/response';
import { BlogRepository } from '../data/repositories/blog.repository';
import { BlogPostQueryFilters, BlogPostStatus } from '../models/blog.model';
import { validateInput } from '../utils/input-validation';

/**
 * Controller for blog management
 */
export class BlogController {
    private blogRepository: BlogRepository;

    constructor(private env: Env) {
        this.blogRepository = new BlogRepository(env);
    }

    /**
     * Create a new blog category
     */
    async createCategory(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can create categories
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const data = await request.json() as {
                name: string;
                slug: string;
                description?: string;
            };

            // Validate input
            const validationResult = validateInput(data, [
                { field: 'name', type: 'string', required: true },
                { field: 'slug', type: 'string', required: true },
                { field: 'description', type: 'string', required: false }
            ]);

            if (!validationResult.valid) {
                return errorResponse(validationResult.message, 400);
            }

            // Check for duplicate slug
            const existingCategory = await this.blogRepository.getCategoryBySlug(data.slug);
            if (existingCategory) {
                return errorResponse('Category slug already exists', 400);
            }

            const category = await this.blogRepository.createCategory({
                name: data.name,
                slug: data.slug,
                description: data.description
            });

            return successResponse({
                message: 'Category created successfully',
                category
            });
        } catch (error) {
            console.error('Error creating category:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to create category', 500);
        }
    }

    /**
     * Update a blog category
     */
    async updateCategory(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can update categories
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const categoryId = request.params?.id;
            if (!categoryId) {
                return errorResponse('Category ID is required', 400);
            }

            const categoryIdNumber = parseInt(categoryId);
            if (isNaN(categoryIdNumber)) {
                return errorResponse('Invalid category ID', 400);
            }

            const data = await request.json() as {
                name?: string;
                slug?: string;
                description?: string;
            };

            // Validate input
            const validationResult = validateInput(data, [
                { field: 'name', type: 'string', required: false },
                { field: 'slug', type: 'string', required: false },
                { field: 'description', type: 'string', required: false }
            ]);

            if (!validationResult.valid) {
                return errorResponse(validationResult.message, 400);
            }

            // Check if category exists
            const existingCategory = await this.blogRepository.getCategoryById(categoryIdNumber);
            if (!existingCategory) {
                return errorResponse('Category not found', 404);
            }

            // Check for duplicate slug if updating slug
            if (data.slug && data.slug !== existingCategory.slug) {
                const duplicateSlug = await this.blogRepository.getCategoryBySlug(data.slug);
                if (duplicateSlug) {
                    return errorResponse('Category slug already exists', 400);
                }
            }

            const updatedCategory = await this.blogRepository.updateCategory(categoryIdNumber, {
                name: data.name,
                slug: data.slug,
                description: data.description
            });

            return successResponse({
                message: 'Category updated successfully',
                category: updatedCategory
            });
        } catch (error) {
            console.error('Error updating category:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update category', 500);
        }
    }

    /**
     * Delete a blog category
     */
    async deleteCategory(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can delete categories
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const categoryId = request.params?.id;
            if (!categoryId) {
                return errorResponse('Category ID is required', 400);
            }

            const categoryIdNumber = parseInt(categoryId);
            if (isNaN(categoryIdNumber)) {
                return errorResponse('Invalid category ID', 400);
            }

            const deleted = await this.blogRepository.deleteCategory(categoryIdNumber);
            if (!deleted) {
                return errorResponse('Category not found or could not be deleted', 404);
            }

            return successResponse({
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to delete category', 500);
        }
    }

    /**
     * Get all blog categories
     */
    async getAllCategories(request: IRequest): Promise<Response> {
        try {
            const categories = await this.blogRepository.getAllCategories();
            return successResponse(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch categories', 500);
        }
    }

    /**
     * Get a blog category by ID
     */
    async getCategoryById(request: IRequest): Promise<Response> {
        try {
            const categoryId = request.params?.id;
            if (!categoryId) {
                return errorResponse('Category ID is required', 400);
            }

            const categoryIdNumber = parseInt(categoryId);
            if (isNaN(categoryIdNumber)) {
                return errorResponse('Invalid category ID', 400);
            }

            const category = await this.blogRepository.getCategoryById(categoryIdNumber);
            if (!category) {
                return errorResponse('Category not found', 404);
            }

            return successResponse(category);
        } catch (error) {
            console.error('Error fetching category:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch category', 500);
        }
    }

    /**
     * Create a new blog post
     */
    async createPost(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can create blog posts
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const data = await request.json() as {
                title: string;
                slug: string;
                content: string;
                excerpt?: string;
                featured_image?: string;
                status?: BlogPostStatus;
                category_ids?: number[];
            };

            // Validate input
            const validationResult = validateInput(data, [
                { field: 'title', type: 'string', required: true },
                { field: 'slug', type: 'string', required: true },
                { field: 'content', type: 'string', required: true },
                { field: 'excerpt', type: 'string', required: false },
                { field: 'featured_image', type: 'string', required: false },
                { field: 'status', type: 'string', required: false },
                { field: 'category_ids', type: 'array', required: false }
            ]);

            if (!validationResult.valid) {
                return errorResponse(validationResult.message, 400);
            }

            // Validate status if provided
            if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
                return errorResponse('Invalid status. Must be one of: draft, published, archived', 400);
            }

            // Check for duplicate slug
            try {
                await this.blogRepository.getPostBySlug(data.slug);
                return errorResponse('Blog post slug already exists', 400);
            } catch (error) {
                // Slug doesn't exist, continue
            }

            if (!request.userId) {
                return errorResponse('User ID not found in request', 400);
            }

            const post = await this.blogRepository.createPost({
                title: data.title,
                slug: data.slug,
                content: data.content,
                excerpt: data.excerpt,
                featured_image: data.featured_image,
                author_id: request.userId,
                status: data.status as BlogPostStatus,
                category_ids: data.category_ids
            });

            return successResponse({
                message: 'Blog post created successfully',
                post
            });
        } catch (error) {
            console.error('Error creating blog post:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to create blog post', 500);
        }
    }

    /**
     * Update a blog post
     */
    async updatePost(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can update blog posts
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const postId = request.params?.id;
            if (!postId) {
                return errorResponse('Post ID is required', 400);
            }

            const postIdNumber = parseInt(postId);
            if (isNaN(postIdNumber)) {
                return errorResponse('Invalid post ID', 400);
            }

            const data = await request.json() as {
                title?: string;
                slug?: string;
                content?: string;
                excerpt?: string;
                featured_image?: string;
                status?: BlogPostStatus;
                category_ids?: number[];
            };

            // Validate input
            const validationResult = validateInput(data, [
                { field: 'title', type: 'string', required: false },
                { field: 'slug', type: 'string', required: false },
                { field: 'content', type: 'string', required: false },
                { field: 'excerpt', type: 'string', required: false },
                { field: 'featured_image', type: 'string', required: false },
                { field: 'status', type: 'string', required: false },
                { field: 'category_ids', type: 'array', required: false }
            ]);

            if (!validationResult.valid) {
                return errorResponse(validationResult.message, 400);
            }

            // Validate status if provided
            if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
                return errorResponse('Invalid status. Must be one of: draft, published, archived', 400);
            }

            // Check if post exists
            try {
                await this.blogRepository.getPostById(postIdNumber);
            } catch (error) {
                return errorResponse('Blog post not found', 404);
            }

            // Check for duplicate slug if updating slug
            if (data.slug) {
                try {
                    const existingPost = await this.blogRepository.getPostBySlug(data.slug);
                    if (existingPost && existingPost.id !== postIdNumber) {
                        return errorResponse('Blog post slug already exists', 400);
                    }
                } catch (error) {
                    // Slug doesn't exist or belongs to this post, continue
                }
            }

            const updatedPost = await this.blogRepository.updatePost(postIdNumber, {
                title: data.title,
                slug: data.slug,
                content: data.content,
                excerpt: data.excerpt,
                featured_image: data.featured_image,
                status: data.status as BlogPostStatus,
                category_ids: data.category_ids
            });

            return successResponse({
                message: 'Blog post updated successfully',
                post: updatedPost
            });
        } catch (error) {
            console.error('Error updating blog post:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update blog post', 500);
        }
    }

    /**
     * Delete a blog post
     */
    async deletePost(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can delete blog posts
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const postId = request.params?.id;
            if (!postId) {
                return errorResponse('Post ID is required', 400);
            }

            const postIdNumber = parseInt(postId);
            if (isNaN(postIdNumber)) {
                return errorResponse('Invalid post ID', 400);
            }

            const deleted = await this.blogRepository.deletePost(postIdNumber);
            if (!deleted) {
                return errorResponse('Blog post not found or could not be deleted', 404);
            }

            return successResponse({
                message: 'Blog post deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting blog post:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to delete blog post', 500);
        }
    }

    /**
     * Get a blog post by ID
     */
    async getPostById(request: IRequest): Promise<Response> {
        try {
            const postId = request.params?.id;
            if (!postId) {
                return errorResponse('Post ID is required', 400);
            }

            const postIdNumber = parseInt(postId);
            if (isNaN(postIdNumber)) {
                return errorResponse('Invalid post ID', 400);
            }

            try {
                const post = await this.blogRepository.getPostById(postIdNumber);
                return successResponse(post);
            } catch (error) {
                return errorResponse('Blog post not found', 404);
            }
        } catch (error) {
            console.error('Error fetching blog post:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch blog post', 500);
        }
    }

    /**
     * Get a blog post by slug
     */
    async getPostBySlug(request: IRequest): Promise<Response> {
        try {
            const slug = request.params?.slug;
            if (!slug) {
                return errorResponse('Post slug is required', 400);
            }

            try {
                const post = await this.blogRepository.getPostBySlug(slug);
                return successResponse(post);
            } catch (error) {
                return errorResponse('Blog post not found', 404);
            }
        } catch (error) {
            console.error('Error fetching blog post:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch blog post', 500);
        }
    }

    /**
     * List blog posts with filtering and pagination
     */
    async listPosts(request: IRequest): Promise<Response> {
        try {
            // Parse query parameters
            const url = new URL(request.url);

            const page = parseInt(url.searchParams.get('page') || '1');
            const pageSize = parseInt(url.searchParams.get('limit') || '10');

            const filters: BlogPostQueryFilters = {
                category_id: url.searchParams.has('category_id') ?
                    parseInt(url.searchParams.get('category_id') || '0') : undefined,
                author_id: url.searchParams.has('author_id') ?
                    url.searchParams.get('author_id') || undefined : undefined,
                status: url.searchParams.has('status') ?
                    url.searchParams.get('status') as BlogPostStatus : undefined,
                search: url.searchParams.has('search') ?
                    url.searchParams.get('search') || undefined : undefined,
                sort_by: url.searchParams.has('sort_by') ?
                    url.searchParams.get('sort_by') as 'published_at' | 'created_at' | 'title' : undefined,
                sort_direction: url.searchParams.has('sort_direction') ?
                    url.searchParams.get('sort_direction') as 'asc' | 'desc' : undefined
            };

            // If not admin, only show published posts
            const isAdminRequest = (request as AuthRequest).userRole === 'admin';
            if (!isAdminRequest) {
                filters.status = 'published';
            }

            const result = await this.blogRepository.getPosts(filters, page, pageSize);

            return successResponse({
                posts: result.posts,
                meta: {
                    total: result.total,
                    page,
                    page_size: pageSize,
                    total_pages: Math.ceil(result.total / pageSize)
                }
            });
        } catch (error) {
            console.error('Error listing blog posts:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to list blog posts', 500);
        }
    }

    /**
     * Update blog post status
     */
    async updatePostStatus(request: AuthRequest): Promise<Response> {
        try {
            // Only admins can update post status
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const postId = request.params?.id;
            if (!postId) {
                return errorResponse('Post ID is required', 400);
            }

            const postIdNumber = parseInt(postId);
            if (isNaN(postIdNumber)) {
                return errorResponse('Invalid post ID', 400);
            }

            const data = await request.json() as {
                status: BlogPostStatus;
            };
            const { status } = data;

            if (!status || !['draft', 'published', 'archived'].includes(status)) {
                return errorResponse('Invalid status. Must be one of: draft, published, archived', 400);
            }

            try {
                const updatedPost = await this.blogRepository.updatePostStatus(
                    postIdNumber,
                    status as BlogPostStatus
                );

                return successResponse({
                    message: 'Blog post status updated successfully',
                    post: updatedPost
                });
            } catch (error) {
                return errorResponse('Blog post not found', 404);
            }
        } catch (error) {
            console.error('Error updating blog post status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update blog post status', 500);
        }
    }
}