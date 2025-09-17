import { BaseRepository } from './base.repository';
import { Env, D1Database } from '../../models/common.model';
import {
    BlogCategory, BlogCategoryCreateInput, BlogCategoryUpdateInput,
    BlogPost, BlogPostCreateInput, BlogPostQueryFilters,
    BlogPostStatus, BlogPostUpdateInput
} from '../../models/blog.model';

/**
 * Repository for blog-related operations
 */
export class BlogRepository extends BaseRepository<BlogPost | BlogCategory> {
    protected db: D1Database;

    constructor(env: Env) {
        super(env.DB, 'blog_posts'); // Default table name to blog_posts
        this.db = env.DB;
    }

    /**
     * Create a new blog category
     */
    async createCategory(data: BlogCategoryCreateInput): Promise<BlogCategory> {
        const now = Date.now();

        const { results } = await this.db
            .prepare(`
        INSERT INTO blog_categories (name, slug, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `)
            .bind(data.name, data.slug, data.description || null, now, now)
            .all();

        if (!results || results.length === 0) {
            throw new Error('Failed to create blog category');
        }

        return results[0] as BlogCategory;
    }

    /**
     * Update an existing blog category
     */
    async updateCategory(id: number, data: BlogCategoryUpdateInput): Promise<BlogCategory> {
        const now = Date.now();
        const updates: string[] = [];
        const bindings: any[] = [];

        // Add fields to update
        if (data.name !== undefined) {
            updates.push('name = ?');
            bindings.push(data.name);
        }

        if (data.slug !== undefined) {
            updates.push('slug = ?');
            bindings.push(data.slug);
        }

        if (data.description !== undefined) {
            updates.push('description = ?');
            bindings.push(data.description);
        }

        updates.push('updated_at = ?');
        bindings.push(now);

        // Add ID to bindings
        bindings.push(id);

        const { results } = await this.db
            .prepare(`
        UPDATE blog_categories
        SET ${updates.join(', ')}
        WHERE id = ?
        RETURNING *
      `)
            .bind(...bindings)
            .all();

        if (!results || results.length === 0) {
            throw new Error(`Category with ID ${id} not found`);
        }

        return results[0] as BlogCategory;
    }

    /**
     * Delete a blog category
     */
    async deleteCategory(id: number): Promise<boolean> {
        const result = await this.db
            .prepare(`DELETE FROM blog_categories WHERE id = ?`)
            .bind(id)
            .run();

        return result.success;
    }

    /**
     * Get all blog categories
     */
    async getAllCategories(): Promise<BlogCategory[]> {
        const { results } = await this.db
            .prepare(`SELECT * FROM blog_categories ORDER BY name ASC`)
            .all();

        return results as BlogCategory[];
    }

    /**
     * Get a blog category by ID
     */
    async getCategoryById(id: number): Promise<BlogCategory | null> {
        const { results } = await this.db
            .prepare(`SELECT * FROM blog_categories WHERE id = ?`)
            .bind(id)
            .all();

        return results && results.length > 0 ? (results[0] as BlogCategory) : null;
    }

    /**
     * Get a blog category by slug
     */
    async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
        const { results } = await this.db
            .prepare(`SELECT * FROM blog_categories WHERE slug = ?`)
            .bind(slug)
            .all();

        return results && results.length > 0 ? (results[0] as BlogCategory) : null;
    }

    /**
     * Create a new blog post
     */
    async createPost(data: BlogPostCreateInput): Promise<BlogPost> {
        const now = Date.now();

        // Start a transaction to handle post and categories
        const post = await this.db.prepare(`
      INSERT INTO blog_posts (
        title, slug, content, excerpt, featured_image,
        author_id, status, published_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
            data.title,
            data.slug,
            data.content,
            data.excerpt || null,
            data.featured_image || null,
            data.author_id,
            data.status || 'draft',
            data.published_at || null,
            now,
            now
        ).first<BlogPost>();

        // Check if post was created successfully
        if (!post) {
            throw new Error('Failed to create blog post');
        }

        // If categories are provided, add them
        if (data.category_ids && data.category_ids.length > 0) {
            await this.updatePostCategories(post.id, data.category_ids);
        }

        // Return the full post with categories
        return await this.getPostById(post.id);
    }

    /**
     * Update an existing blog post
     */
    async updatePost(id: number, data: BlogPostUpdateInput): Promise<BlogPost> {
        const now = Date.now();
        const updates: string[] = [];
        const bindings: any[] = [];

        // Add fields to update
        if (data.title !== undefined) {
            updates.push('title = ?');
            bindings.push(data.title);
        }

        if (data.slug !== undefined) {
            updates.push('slug = ?');
            bindings.push(data.slug);
        }

        if (data.content !== undefined) {
            updates.push('content = ?');
            bindings.push(data.content);
        }

        if (data.excerpt !== undefined) {
            updates.push('excerpt = ?');
            bindings.push(data.excerpt);
        }

        if (data.featured_image !== undefined) {
            updates.push('featured_image = ?');
            bindings.push(data.featured_image);
        }

        if (data.status !== undefined) {
            updates.push('status = ?');
            bindings.push(data.status);

            // If status is being set to published and no published_at date is set
            if (data.status === 'published' && !data.published_at) {
                updates.push('published_at = ?');
                bindings.push(now);
            }
        }

        if (data.published_at !== undefined) {
            updates.push('published_at = ?');
            bindings.push(data.published_at);
        }

        updates.push('updated_at = ?');
        bindings.push(now);

        // Add ID to bindings
        bindings.push(id);

        // Update the post
        const { results } = await this.db
            .prepare(`
        UPDATE blog_posts
        SET ${updates.join(', ')}
        WHERE id = ?
        RETURNING *
      `)
            .bind(...bindings)
            .all();

        if (!results || results.length === 0) {
            throw new Error(`Blog post with ID ${id} not found`);
        }

        // If categories are provided, update them
        if (data.category_ids) {
            await this.updatePostCategories(id, data.category_ids);
        }

        // Return the updated post with categories
        return await this.getPostById(id);
    }

    /**
     * Delete a blog post
     */
    async deletePost(id: number): Promise<boolean> {
        // Delete post categories (cascade will handle this but being explicit)
        await this.db
            .prepare(`DELETE FROM blog_post_categories WHERE post_id = ?`)
            .bind(id)
            .run();

        // Delete the post
        const result = await this.db
            .prepare(`DELETE FROM blog_posts WHERE id = ?`)
            .bind(id)
            .run();

        return result.success;
    }

    /**
     * Get a blog post by ID with categories
     */
    async getPostById(id: number): Promise<BlogPost> {
        // Get the post
        const post = await this.db
            .prepare(`SELECT * FROM blog_posts WHERE id = ?`)
            .bind(id)
            .first<BlogPost>();

        if (!post) {
            throw new Error(`Blog post with ID ${id} not found`);
        }

        // Get the categories for this post
        const categories = await this.getPostCategories(id);
        post.categories = categories;

        return post;
    }

    /**
     * Get a blog post by slug with categories
     */
    async getPostBySlug(slug: string): Promise<BlogPost> {
        // Get the post
        const post = await this.db
            .prepare(`SELECT * FROM blog_posts WHERE slug = ?`)
            .bind(slug)
            .first<BlogPost>();

        if (!post) {
            throw new Error(`Blog post with slug '${slug}' not found`);
        }

        // Get the categories for this post
        const categories = await this.getPostCategories(post.id);
        post.categories = categories;

        return post;
    }

    /**
     * Update the categories for a post
     */
    private async updatePostCategories(postId: number, categoryIds: number[]): Promise<void> {
        // Delete existing categories
        const deleteResult = await this.db
            .prepare(`DELETE FROM blog_post_categories WHERE post_id = ?`)
            .bind(postId)
            .run();

        if (!deleteResult.success) {
            throw new Error(`Failed to update categories for post ${postId}`);
        }

        // Add new categories
        if (categoryIds.length > 0) {
            const now = Date.now();

            const insertPromises = categoryIds.map(categoryId =>
                this.db.prepare(`
          INSERT INTO blog_post_categories (post_id, category_id, created_at)
          VALUES (?, ?, ?)
        `).bind(postId, categoryId, now).run()
            );

            const results = await Promise.all(insertPromises);

            // Check if any insert failed
            const allSuccessful = results.every(result => result.success);
            if (!allSuccessful) {
                throw new Error(`Failed to insert some categories for post ${postId}`);
            }
        }
    }

    /**
     * Get categories for a specific post
     */
    private async getPostCategories(postId: number): Promise<BlogCategory[]> {
        const { results } = await this.db
            .prepare(`
        SELECT c.* 
        FROM blog_categories c
        JOIN blog_post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = ?
      `)
            .bind(postId)
            .all();

        return results as BlogCategory[];
    }

    /**
     * Get blog posts with pagination and filtering
     */
    async getPosts(filters: BlogPostQueryFilters, page = 1, pageSize = 10): Promise<{ posts: BlogPost[], total: number }> {
        const offset = (page - 1) * pageSize;
        const conditions: string[] = [];
        const bindings: any[] = [];

        // Add filters
        if (filters.category_id !== undefined) {
            conditions.push(`
        p.id IN (
          SELECT post_id FROM blog_post_categories WHERE category_id = ?
        )
      `);
            bindings.push(filters.category_id);
        }

        if (filters.author_id !== undefined) {
            conditions.push('p.author_id = ?');
            bindings.push(filters.author_id);
        }

        if (filters.status !== undefined) {
            conditions.push('p.status = ?');
            bindings.push(filters.status);
        } else {
            // Default to published posts only
            conditions.push('p.status = ?');
            bindings.push('published');
        }

        if (filters.search) {
            conditions.push('(p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            bindings.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // Determine sort column and direction
        const sortBy = filters.sort_by || 'published_at';
        const sortDirection = filters.sort_direction || 'desc';

        // Get count of total matching posts
        const totalCountQuery = `
      SELECT COUNT(*) as count 
      FROM blog_posts p
      ${whereClause}
    `;

        const totalCount = await this.db
            .prepare(totalCountQuery)
            .bind(...bindings)
            .first<{ count: number }>();

        // Get paginated posts
        const postsQuery = `
      SELECT * 
      FROM blog_posts p
      ${whereClause}
      ORDER BY p.${sortBy} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

        const paginatedBindings = [...bindings, pageSize, offset];
        const { results } = await this.db
            .prepare(postsQuery)
            .bind(...paginatedBindings)
            .all();

        const posts = (results || []) as BlogPost[];

        // Get categories for each post
        for (const post of posts) {
            post.categories = await this.getPostCategories(post.id);
        }

        return {
            posts,
            total: totalCount?.count || 0
        };
    }

    /**
     * Update blog post status
     */
    async updatePostStatus(id: number, status: BlogPostStatus): Promise<BlogPost> {
        const now = Date.now();
        let publishedAt = null;

        // If setting to published and not already published, set published_at
        if (status === 'published') {
            const post = await this.db
                .prepare(`SELECT published_at FROM blog_posts WHERE id = ?`)
                .bind(id)
                .first<{ published_at: number | null }>();

            if (!post?.published_at) {
                publishedAt = now;
            }
        }

        const { results } = await this.db
            .prepare(`
        UPDATE blog_posts
        SET status = ?, 
            ${publishedAt ? 'published_at = ?,' : ''} 
            updated_at = ?
        WHERE id = ?
        RETURNING *
      `)
            .bind(
                status,
                ...(publishedAt ? [publishedAt] : []),
                now,
                id
            )
            .all();

        if (!results || results.length === 0) {
            throw new Error(`Blog post with ID ${id} not found`);
        }

        return await this.getPostById(id);
    }
}